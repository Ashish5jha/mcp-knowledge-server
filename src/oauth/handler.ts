// src/oauth/handler.ts
// Implements OAuth 2.1 + PKCE backed by GitHub as the identity provider.
// Supports Dynamic Client Registration (RFC 7591) so clients like Claude.ai
// can self-register without needing a pre-shared Client ID.
// Tokens are minted by this worker and stored in KV with a 24h TTL.

import { Env } from "../types";

const TOKEN_TTL_SECONDS = 86400; // 24 hours
const CODE_TTL_SECONDS  = 60;    // auth code expires in 60 seconds
const STATE_TTL_SECONDS = 300;   // PKCE state expires in 5 minutes

// ── Discovery document (MCP spec §3.1 + RFC 8414) ─────────────────────────────
// MUST advertise registration_endpoint so clients like Claude.ai know
// they can self-register via Dynamic Client Registration (RFC 7591).
export function handleOAuthDiscovery(workerUrl: string): Response {
  const base = workerUrl.replace(/\/$/, "");
  const doc = {
    issuer: base,
    authorization_endpoint:   `${base}/oauth/authorize`,
    token_endpoint:            `${base}/oauth/token`,
    registration_endpoint:     `${base}/oauth/register`,   // ← RFC 7591 DCR
    response_types_supported:  ["code"],
    grant_types_supported:     ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  };
  return new Response(JSON.stringify(doc), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ── POST /oauth/register (RFC 7591 — Dynamic Client Registration) ──────────────
// Claude.ai, Copilot and other MCP clients POST here to get a client_id.
// Since this is a personal server, we accept all registrations and store the
// client's allowed redirect_uris so we can validate them at /oauth/authorize.
export async function handleRegister(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    // Some clients send with charset suffix or text/plain — handle all cases
    const text = await request.text();
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return jsonError(400, "invalid_request", "Request body must be valid JSON");
  }


  const redirectUris = body.redirect_uris as string[] | undefined;
  if (!redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
    return jsonError(400, "invalid_redirect_uri", "redirect_uris is required");
  }

  // Mint a stable client_id (deterministic from the sorted redirect URIs so
  // re-registering the same client returns the same ID)
  const fingerprint = redirectUris.slice().sort().join("|");
  const hashBuf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(fingerprint)
  );
  const clientId = Array.from(new Uint8Array(hashBuf))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Store the client metadata in KV (no expiry — clients stay registered)
  const clientMeta = {
    client_id: clientId,
    redirect_uris: redirectUris,
    client_name: (body.client_name as string) ?? "Unknown Client",
    registered_at: Date.now(),
  };
  await env.KNOWLEDGE_CACHE.put(`oauth:client:${clientId}`, JSON.stringify(clientMeta));

  // RFC 7591 §3.2.1 — respond with 201 Created
  return new Response(
    JSON.stringify({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

// ── GET /oauth/authorize ───────────────────────────────────────────────────────
// Validates the PKCE request and registered client, saves state, redirects to GitHub.
export async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const clientId           = url.searchParams.get("client_id");
  const redirectUri        = url.searchParams.get("redirect_uri");
  const state              = url.searchParams.get("state");
  const codeChallenge      = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");

  if (!redirectUri || !state || !codeChallenge || codeChallengeMethod !== "S256") {
    return new Response(
      "Bad Request: missing required OAuth parameters (redirect_uri, state, code_challenge, code_challenge_method=S256)",
      { status: 400 }
    );
  }

  // Validate client_id if provided (it should be, after DCR)
  if (clientId) {
    const rawClient = await env.KNOWLEDGE_CACHE.get(`oauth:client:${clientId}`);
    if (!rawClient) {
      return jsonError(400, "invalid_client", "Unknown client_id. Please register first via POST /oauth/register");
    }
    const client = JSON.parse(rawClient) as { redirect_uris: string[] };
    // Verify the redirect_uri is one the client registered
    if (!client.redirect_uris.includes(redirectUri)) {
      return jsonError(400, "invalid_redirect_uri", `redirect_uri not registered for this client`);
    }
  }

  // Store PKCE state in KV (5-min TTL)
  const oauthState = JSON.stringify({ redirectUri, state, codeChallenge, clientId });
  await env.KNOWLEDGE_CACHE.put(`oauth:state:${state}`, oauthState, {
    expirationTtl: STATE_TTL_SECONDS,
  });

  // Redirect to GitHub OAuth
  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id",    env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set("redirect_uri", new URL("/oauth/callback", url.origin).href);
  githubUrl.searchParams.set("state",        state);
  githubUrl.searchParams.set("scope",        "read:user");

  return Response.redirect(githubUrl.href, 302);
}

// ── GET /oauth/callback ────────────────────────────────────────────────────────
// GitHub redirects here with a code. We exchange it, verify it's the owner,
// then mint an auth code and redirect back to the MCP client.
export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url   = new URL(request.url);
  const code  = url.searchParams.get("code");
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

  // Exchange GitHub code → GitHub access token
  const ghTokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id:     env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri:  new URL("/oauth/callback", url.origin).href,
    }),
  });

  if (!ghTokenRes.ok) {
    return new Response("Failed to exchange GitHub code for token", { status: 502 });
  }

  const ghToken = (await ghTokenRes.json()) as { access_token?: string; error?: string };
  if (!ghToken.access_token) {
    return new Response(`GitHub token error: ${ghToken.error ?? "unknown"}`, { status: 400 });
  }

  // Verify the GitHub user is the owner
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${ghToken.access_token}`,
      "User-Agent":  "mcp-knowledge-server",
    },
  });
  if (!userRes.ok) {
    return new Response("Failed to fetch GitHub user", { status: 502 });
  }
  const ghUser = (await userRes.json()) as { login?: string };

  if (ghUser.login?.toLowerCase() !== env.GITHUB_OWNER_LOGIN.toLowerCase()) {
    return new Response("Forbidden: This MCP server is private.", { status: 403 });
  }

  // Mint an opaque auth code, store codeChallenge for token exchange
  const authCode = crypto.randomUUID();
  const token    = crypto.randomUUID(); // final access token, stored after PKCE verify
  await env.KNOWLEDGE_CACHE.put(
    `oauth:code:${authCode}`,
    JSON.stringify({ token, codeChallenge }),
    { expirationTtl: CODE_TTL_SECONDS }
  );

  // Redirect back to the MCP client
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code",  authCode);
  callbackUrl.searchParams.set("state", state);

  return Response.redirect(callbackUrl.href, 302);
}

// ── POST /oauth/token ──────────────────────────────────────────────────────────
// Client exchanges the auth code + PKCE verifier for an access token.
export async function handleToken(request: Request, env: Env): Promise<Response> {
  let body: Record<string, string>;

  const ct = request.headers.get("Content-Type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  } else {
    body = (await request.json()) as Record<string, string>;
  }

  const { grant_type, code, code_verifier } = body;

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

  // Verify PKCE S256: base64url(SHA-256(verifier)) == challenge
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code_verifier)
  );
  const computedChallenge = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  if (computedChallenge !== codeChallenge) {
    return jsonError(400, "invalid_grant", "PKCE verification failed");
  }

  // Store the final access token in KV with 24h TTL
  await env.KNOWLEDGE_CACHE.put(`oauth:token:${token}`, "1", {
    expirationTtl: TOKEN_TTL_SECONDS,
  });

  return new Response(
    JSON.stringify({
      access_token: token,
      token_type:   "Bearer",
      expires_in:   TOKEN_TTL_SECONDS,
      scope:        "mcp",
    }),
    {
      headers: {
        "Content-Type":               "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":              "no-store",
      },
    }
  );
}

// ── Token validation (dual-auth) ───────────────────────────────────────────────
// Accepts either the static Bearer secret OR a KV-stored OAuth token.
export async function isValidToken(token: string | null, env: Env): Promise<boolean> {
  if (!token) return false;
  const bare = token.startsWith("Bearer ") ? token.slice(7) : token;

  // 1. Static Bearer secret → Antigravity, Cursor, CLI tools
  if (bare === env.AUTH_TOKEN) return true;

  // 2. OAuth token stored in KV → Claude.ai, Copilot, etc.
  const kv = await env.KNOWLEDGE_CACHE.get(`oauth:token:${bare}`);
  return kv !== null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function jsonError(status: number, error: string, description: string): Response {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
