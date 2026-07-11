import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Env } from "./types";
import { registerTools } from "./mcp/tools/index";
import { buildIndex } from "./indexer/buildIndex";

const PROFILES = ["company", "personal", "freelance"] as const;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // ── Auth check — must pass before any MCP routing ──────────────────────────
    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${env.AUTH_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);

    // ── MCP endpoint (stateless, one server instance per request) ──────────────
    if (url.pathname === "/mcp") {
      const server = new McpServer({
        name: "mcp-knowledge-server",
        version: "1.0.0",
      });

      registerTools(server, env);

      const sessionId = crypto.randomUUID();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      await server.connect(transport);
      let response = await transport.handleRequest(request);

      // Patch for older SSE clients (Cursor, Claude) that expect the 'endpoint' event
      // The new WebStandardStreamableHTTPServerTransport doesn't emit it by default.
      if (request.method === "GET" && response.status === 200 && response.body) {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        
        // Write the endpoint event first
        const endpointStr = `event: endpoint\ndata: /mcp?sessionId=${sessionId}\n\n`;
        writer.write(new TextEncoder().encode(endpointStr));
        writer.releaseLock();
        
        // Pipe the rest of the stream
        response.body.pipeTo(writable);
        
        response = new Response(readable, {
          status: response.status,
          headers: response.headers
        });
      }

      ctx.waitUntil(server.close());
      return response;
    }

    return new Response("Not found", { status: 404 });
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
