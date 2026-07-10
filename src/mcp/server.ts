import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Env } from "../types";
import { registerTools } from "./tools/index";

/**
 * Create and configure the MCP server with all tools registered.
 * NOTE: This is kept for reference but the server is instantiated inline
 * in src/index.ts to ensure a fresh instance per request (stateless Workers model).
 */
export function createServer(env: Env): McpServer {
  const server = new McpServer({
    name: "mcp-knowledge-server",
    version: "1.0.0",
  });

  registerTools(server, env);

  return server;
}
