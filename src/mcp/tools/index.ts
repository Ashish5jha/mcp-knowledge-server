import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Env, PROFILES, Profile } from "../../types";
import { getRegistry } from "../../registry/registry";
import {
	getDocument,
	getSearchResults,
	reindexProfile,
} from "../../console/logic";

/**
 * Register all four MCP tools on the given McpServer instance.
 */
export function registerTools(server: McpServer, env: Env): void {
	// ─── list_profiles ──────────────────────────────────────────────────────────
	server.tool(
		"list_profiles",
		"List all available knowledge profiles and their descriptions.",
		{},
		async () => {
			const registry = await getRegistry(env);
			const profiles = PROFILES.map((p) => ({
				profile: p,
				manifestUrl: registry[p]?.manifestUrl ?? "(not configured)",
			}));
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ profiles }, null, 2),
					},
				],
			};
		},
	);

	// ─── search_knowledge ────────────────────────────────────────────────────────
	server.tool(
		"search_knowledge",
		"Search the indexed knowledge base for a given profile by keyword.",
		{
			profile: z
				.enum(PROFILES)
				.describe("Which knowledge profile to search"),
			query: z
				.string()
				.describe("Keywords, a title, or a topic to search for"),
			limit: z
				.number()
				.min(1)
				.max(20)
				.default(5)
				.describe("Max number of results to return"),
		},
		async ({ profile, query, limit }) => {
			const { index, results } = await getSearchResults(
				env,
				profile,
				query,
				limit,
			);
			if (!index) {
				return {
					content: [
						{
							type: "text",
							text: `No search index found for profile "${profile}". Run reindex_profile first.`,
						},
					],
				};
			}

			if (results.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `No matching documents in profile "${profile}" for query: "${query}"`,
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{ profile, query, total: results.length, results },
							null,
							2,
						),
					},
				],
			};
		},
	);

	// ─── get_document ────────────────────────────────────────────────────────────
	server.tool(
		"get_document",
		"Retrieve the full Markdown content of a document by its ID.",
		{
			profile: z
				.enum(PROFILES)
				.describe("Which knowledge profile the document belongs to"),
			id: z
				.string()
				.describe("Document ID, as returned by search_knowledge"),
		},
		async ({ profile, id }) => {
			try {
				const doc = await getDocument(env, profile, id);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									id: doc.metadata.id,
									title: doc.metadata.title,
									type: doc.metadata.type,
									tags: doc.metadata.tags,
									keywords: doc.metadata.keywords,
									related: doc.metadata.related,
									summary: doc.metadata.summary,
									updated_at: doc.metadata.updated_at,
									priority: doc.metadata.priority,
									profile,
								},
								null,
								2,
							),
						},
						{
							type: "text",
							text: doc.body,
						},
					],
				};
			} catch (err: any) {
				return {
					content: [
						{
							type: "text",
							text: `Failed to fetch document "${id}": ${err.message}`,
						},
					],
				};
			}
		},
	);

	// ─── reindex_profile ─────────────────────────────────────────────────────────
	server.tool(
		"reindex_profile",
		"Force a rebuild of the search index for a profile from the latest GitHub manifest.",
		{
			profile: z
				.enum(PROFILES)
				.describe("Which knowledge profile to reindex"),
		},
		async ({ profile }) => {
			try {
				await reindexProfile(env, profile);
				return {
					content: [
						{
							type: "text",
							text: `Successfully reindexed profile "${profile}".`,
						},
					],
				};
			} catch (err: any) {
				return {
					content: [
						{
							type: "text",
							text: `Failed to reindex profile "${profile}": ${err.message}`,
						},
					],
				};
			}
		},
	);
}
