// src/oauth/handler.ts
// Implements OAuth 2.1 + PKCE backed by GitHub as the identity provider.
// Tokens are minted by this worker and stored in KV with a 24h TTL.
// The spec-required discovery document is served at /.well-known/oauth-authorization-server

import { Env } from "../types";

const TOKEN_TTL_SECONDS = 86400; // 24 hours

// ── Discovery document (MCP spec §3.1) ────────────────────────────────────────
export function handleOAuthDiscovery(workerUrl: string): Response {
  const base = workerUrl.replace(/\/$/, "");
  const doc = {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  };
  return new Response(JSON.stringify(doc), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

// ── /oauth/authorize ───────────────────────────────────────────────────────────
// Validates the PKCE request, saves state in KV, then redirects to GitHub.
export async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");

  if (!redirectUri || !state || !codeChallenge || codeChallengeMethod !== "S256") {
    return new Response("Bad Request: missing required OAuth parameters (redirect_uri, state, code_challenge, code_challenge_method=S256)", {
      status: 400,
    });
  }

  // Store PKCE state in KV so we can verify it in the callback (5 min TTL)
  const oauthState = JSON.stringify({ redirectUri, state, codeChallenge });
  await env.KNOWLEDGE_CACHE.put(`oauth:state:${state}`, oauthState, { expirationTtl: 300 });

  // Redirect to GitHub OAuth
  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set("redirect_uri", new URL("/oauth/callback", url.origin).href);
  githubUrl.searchParams.set("state", state);
  githubUrl.searchParams.set("scope", "read:user");

  return Response.redirect(githubUrl.href, 302);
}

// ── /oauth/callback ────────────────────────────────────────────────────────────
// GitHub redirects here. We exchange the code for a GitHub token, verify the
// user is you, then mint an opaque internal token and redirect back to the client.
export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response("Bad Request: missing code or state", { status: 400 });
  }

  // Retrieve and validate stored PKCE state
  const rawState = await env.KNOWLEDGE_CACHE.get(`oauth:state:${state}`);
  if (!rawState) {
    return new Response("Invalid or expired state parameter", { status: 400 });
  }
  const { redirectUri, codeChallenge } = JSON.parse(rawState);
  await env.KNOWLEDGE_CACHE.delete(`oauth:state:${state}`);

  // Exchange GitHub code for GitHub access token
  const ghTokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: new URL("/oauth/callback", url.origin).href,
    }),
  });

  if (!ghTokenRes.ok) {
    return new Response("Failed to exchange GitHub code for token", { status: 502 });
  }

  const ghToken = (await ghTokenRes.json()) as { access_token?: string; error?: string };
  if (!ghToken.access_token) {
    return new Response(`GitHub token error: ${ghToken.error ?? "unknown"}`, { status: 400 });
  }

  // Verify the GitHub user is the owner (matches your GitHub login)
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${ghToken.access_token}`,
      "User-Agent": "mcp-knowledge-server",
    },
  });
  if (!userRes.ok) {
    return new Response("Failed to fetch GitHub user", { status: 502 });
  }
  const ghUser = (await userRes.json()) as { login?: string };

  if (ghUser.login?.toLowerCase() !== env.GITHUB_OWNER_LOGIN.toLowerCase()) {
    return new Response("Forbidden: This MCP server is private.", { status: 403 });
  }

  // Mint an opaque internal token and store it in KV
  const token = crypto.randomUUID();
  const authCode = crypto.randomUUID(); // intermediate authorization code
  await env.KNOWLEDGE_CACHE.put(
    `oauth:code:${authCode}`,
    JSON.stringify({ token, codeChallenge }),
    { expirationTtl: 60 } // code expires in 60 seconds
  );

  // Redirect back to the MCP client with the authorization code
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", authCode);
  callbackUrl.searchParams.set("state", state);

  return Response.redirect(callbackUrl.href, 302);
}

// ── /oauth/token ───────────────────────────────────────────────────────────────
// Client POSTs here to exchange the authorization code for an access token.
// PKCE verifier is validated here.
export async function handleToken(request: Request, env: Env, workerUrl: string): Promise<Response> {
  let body: Record<string, string>;

  const ct = request.headers.get("Content-Type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  } else {
    body = (await request.json()) as Record<string, string>;
  }

  const { grant_type, code, code_verifier, redirect_uri } = body;

  if (grant_type !== "authorization_code" || !code || !code_verifier) {
    return jsonError(400, "invalid_request", "Missing grant_type, code, or code_verifier");
  }

  // Retrieve stored code
  const rawCode = await env.KNOWLEDGE_CACHE.get(`oauth:code:${code}`);
  if (!rawCode) {
    return jsonError(400, "invalid_grant", "Authorization code expired or invalid");
  }
  const { token, codeChallenge } = JSON.parse(rawCode);
  await env.KNOWLEDGE_CACHE.delete(`oauth:code:${code}`);

  // Verify PKCE: SHA-256(code_verifier) base64url == code_challenge
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code_verifier));
  const computedChallenge = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  if (computedChallenge !== codeChallenge) {
    return jsonError(400, "invalid_grant", "PKCE verification failed");
  }

  // Store the final access token in KV
  await env.KNOWLEDGE_CACHE.put(`oauth:token:${token}`, "1", { expirationTtl: TOKEN_TTL_SECONDS });

  return new Response(
    JSON.stringify({
      access_token: token,
      token_type: "Bearer",
      expires_in: TOKEN_TTL_SECONDS,
      scope: "mcp",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    }
  );
}

// ── Token validation helper ────────────────────────────────────────────────────
// Returns true if the given token is a valid OAuth token OR the static Bearer secret.
export async function isValidToken(token: string | null, env: Env): Promise<boolean> {
  if (!token) return false;
  const bare = token.startsWith("Bearer ") ? token.slice(7) : token;

  // 1. Static Bearer secret (existing clients: Antigravity, Cursor, CLI)
  if (bare === env.AUTH_TOKEN) return true;

  // 2. OAuth token stored in KV
  const kv = await env.KNOWLEDGE_CACHE.get(`oauth:token:${bare}`);
  return kv !== null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function jsonError(status: number, error: string, description: string): Response {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
