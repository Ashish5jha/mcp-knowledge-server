import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Env } from "./types";
import { registerTools } from "./mcp/tools/index";
import { buildIndex } from "./indexer/buildIndex";
import {
  handleOAuthDiscovery,
  handleAuthorize,
  handleCallback,
  handleToken,
  isValidToken,
} from "./oauth/handler";

const PROFILES = ["company", "personal", "freelance"] as const;

// CORS preflight helper — needed so browser-based MCP clients can connect
function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // ── CORS preflight ─────────────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ── OAuth public routes (no auth required) ─────────────────────────────────
    // These MUST be reachable before the auth check so clients can discover OAuth.

    if (url.pathname === "/.well-known/oauth-authorization-server") {
      return handleOAuthDiscovery(env.WORKER_URL);
    }

    if (url.pathname === "/oauth/authorize") {
      return handleAuthorize(request, env);
    }

    if (url.pathname === "/oauth/callback") {
      return handleCallback(request, env);
    }

    if (url.pathname === "/oauth/token") {
      return handleToken(request, env, env.WORKER_URL);
    }

    // ── Auth gate — Bearer (static) OR Bearer (OAuth token in KV) ─────────────
    const authHeader = request.headers.get("Authorization");
    const authenticated = await isValidToken(authHeader, env);

    if (!authenticated) {
      return new Response(
        JSON.stringify({
          error: "unauthorized",
          error_description: "Provide a valid Bearer token or complete the OAuth 2.1 flow.",
          // Hint clients to the discovery doc so they can auto-start OAuth
          oauth_discovery: `${env.WORKER_URL}/.well-known/oauth-authorization-server`,
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer realm="${env.WORKER_URL}", error="unauthorized"`,
            ...corsHeaders(),
          },
        }
      );
    }

    // ── MCP endpoint ───────────────────────────────────────────────────────────
    if (url.pathname === "/mcp") {
      const server = new McpServer({
        name: "mcp-knowledge-server",
        version: "1.0.0",
      });

      registerTools(server, env);

      const sessionId = crypto.randomUUID();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless — one transport per request
        enableJsonResponse: true,
      });

      await server.connect(transport);
      let response = await transport.handleRequest(request);

      // ── SSE compatibility patch ──────────────────────────────────────────────
      // Older SSE clients (Cursor, Claude Code, Antigravity) expect an
      // `event: endpoint` frame before the stream. The newer Streamable HTTP
      // transport doesn't emit it, so we inject it manually.
      if (request.method === "GET" && response.status === 200 && response.body) {
        const { readable, writable } = new TransformStream();

        ctx.waitUntil(
          (async () => {
            try {
              const writer = writable.getWriter();
              const endpointEvent = `event: endpoint\ndata: /mcp?sessionId=${sessionId}\n\n`;
              await writer.write(new TextEncoder().encode(endpointEvent));
              writer.releaseLock();
              await response.body!.pipeTo(writable);
            } catch (e) {
              console.error("SSE stream patch error:", e);
            }
          })()
        );

        response = new Response(readable, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), ...corsHeaders() },
        });
      } else {
        // Add CORS headers to non-SSE responses too
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
        response = new Response(response.body, { status: response.status, headers });
      }

      ctx.waitUntil(server.close());
      return response;
    }

    return new Response("Not found", { status: 404, headers: corsHeaders() });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Rebuild search index for all profiles every 6 hours
    for (const profile of PROFILES) {
      try {
        await buildIndex(env, profile);
        console.log(`[cron] Reindexed profile: ${profile}`);
      } catch (err) {
        console.error(`[cron] Failed to reindex profile "${profile}":`, err);
      }
    }
  },
};
