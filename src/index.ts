import { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${env.AUTH_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (request.method === "POST" && new URL(request.url).pathname === "/mcp") {
      // TODO: implement MCP handler routing
      return new Response("MCP handler not fully implemented", { status: 501 });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // TODO: loop profiles and buildIndex
    console.log("cron trigger fired");
  }
};
