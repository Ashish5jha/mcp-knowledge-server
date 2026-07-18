import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Env, PROFILES } from "./types";
import { registerTools } from "./mcp/tools/index";
import { buildIndex } from "./indexer/buildIndex";
import {
	handleOAuthDiscovery,
	handleAuthorize,
	handleCallback,
	handleToken,
	handleRegister,
	isValidToken,
} from "./oauth/handler";
import {
	handleConsoleCompare,
	handleConsoleDocument,
	handleConsolePage,
	handleConsoleProfiles,
	handleConsoleReindex,
	handleConsoleSearch,
	handleConsoleStatus,
} from "./console/handler";

function corsHeaders(): HeadersInit {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
		"Access-Control-Allow-Headers":
			"Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
	};
}

async function unauthorizedResponse(env: Env): Promise<Response> {
	return new Response(
		JSON.stringify({
			error: "unauthorized",
			error_description:
				"Provide a valid Bearer token or complete the OAuth 2.1 flow.",
			oauth_discovery: `${env.WORKER_URL}/.well-known/oauth-authorization-server`,
		}),
		{
			status: 401,
			headers: {
				"Content-Type": "application/json",
				"WWW-Authenticate": `Bearer realm="${env.WORKER_URL}", error="unauthorized"`,
				...corsHeaders(),
			},
		},
	);
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders() });
		}

		if (url.pathname === "/.well-known/oauth-authorization-server") {
			return handleOAuthDiscovery(env.WORKER_URL);
		}

		if (url.pathname === "/oauth/register" && request.method === "POST") {
			return handleRegister(request, env);
		}

		if (url.pathname === "/oauth/authorize") {
			return handleAuthorize(request, env);
		}

		if (url.pathname === "/oauth/callback") {
			return handleCallback(request, env);
		}

		if (url.pathname === "/oauth/token") {
			return handleToken(request, env);
		}

		if (url.pathname === "/") {
			return Response.redirect(new URL("/console", url.origin).href, 302);
		}

		if (url.pathname === "/console" && request.method === "GET") {
			return handleConsolePage();
		}

		if (
			url.pathname === "/api/console/profiles" &&
			request.method === "GET"
		) {
			return handleConsoleProfiles(env);
		}

		const protectedConsoleRoute = url.pathname.startsWith("/api/console/");
		const protectedMcpRoute = url.pathname === "/mcp";

		if (protectedConsoleRoute || protectedMcpRoute) {
			const authHeader = request.headers.get("Authorization");
			const authenticated = await isValidToken(authHeader, env);
			if (!authenticated) {
				return unauthorizedResponse(env);
			}
		}

		if (
			url.pathname === "/api/console/status" &&
			request.method === "GET"
		) {
			return handleConsoleStatus(request, env);
		}

		if (
			url.pathname === "/api/console/compare" &&
			request.method === "GET"
		) {
			return handleConsoleCompare(request, env);
		}

		if (
			url.pathname === "/api/console/search" &&
			request.method === "GET"
		) {
			return handleConsoleSearch(request, env);
		}

		if (
			url.pathname === "/api/console/document" &&
			request.method === "GET"
		) {
			return handleConsoleDocument(request, env);
		}

		if (
			url.pathname === "/api/console/reindex" &&
			request.method === "POST"
		) {
			return handleConsoleReindex(request, env);
		}

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

			if (
				request.method === "GET" &&
				response.status === 200 &&
				response.body
			) {
				const { readable, writable } = new TransformStream();

				ctx.waitUntil(
					(async () => {
						try {
							const writer = writable.getWriter();
							const endpointEvent = `event: endpoint\ndata: /mcp?sessionId=${sessionId}\n\n`;
							await writer.write(
								new TextEncoder().encode(endpointEvent),
							);
							writer.releaseLock();
							await response.body!.pipeTo(writable);
						} catch (error) {
							console.error("SSE stream patch error:", error);
						}
					})(),
				);

				response = new Response(readable, {
					status: response.status,
					headers: {
						...Object.fromEntries(response.headers),
						...corsHeaders(),
					},
				});
			} else {
				const headers = new Headers(response.headers);
				Object.entries(corsHeaders()).forEach(([key, value]) =>
					headers.set(key, value),
				);
				response = new Response(response.body, {
					status: response.status,
					headers,
				});
			}

			ctx.waitUntil(server.close());
			return response;
		}

		return new Response("Not found", {
			status: 404,
			headers: corsHeaders(),
		});
	},

	async scheduled(
		_event: ScheduledEvent,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<void> {
		for (const profile of PROFILES) {
			try {
				await buildIndex(env, profile);
				console.log(`[cron] Reindexed profile: ${profile}`);
			} catch (error) {
				console.error(
					`[cron] Failed to reindex profile "${profile}":`,
					error,
				);
			}
		}
	},
};
