import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Env, SearchIndex } from "../../types";
import { getCache } from "../../cache/kv";
import { getRegistry } from "../../registry/registry";
import { fetchRawDoc } from "../../fetcher/github";
import { buildIndex } from "../../indexer/buildIndex";
import { tokenize } from "../../indexer/buildIndex";

const PROFILES = ["company", "personal", "freelance"] as const;
type Profile = (typeof PROFILES)[number];

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
    }
  );

  // ─── search_knowledge ────────────────────────────────────────────────────────
  server.tool(
    "search_knowledge",
    "Search the indexed knowledge base for a given profile by keyword.",
    {
      profile: z.enum(PROFILES).describe("Which knowledge profile to search"),
      query: z.string().describe("Keywords, a title, or a topic to search for"),
      limit: z.number().min(1).max(20).default(5).describe("Max number of results to return"),
    },
    async ({ profile, query, limit }) => {
      const index = await getCache<SearchIndex>(env, `index:${profile}`);
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

      const queryTerms = tokenize(query);
      if (queryTerms.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No matching documents in profile "${profile}" for query: "${query}"`,
            },
          ],
        };
      }

      // Score each doc by term overlap
      const scores: Record<string, number> = {};

      for (const term of queryTerms) {
        const matchingIds = index.termIndex[term] ?? [];
        for (const id of matchingIds) {
          scores[id] = (scores[id] ?? 0) + 1;
        }
      }

      if (Object.keys(scores).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No matching documents in profile "${profile}" for query: "${query}"`,
            },
          ],
        };
      }

      const maxScore = Math.max(...Object.values(scores));

      const results = Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([id, score]) => {
          const doc = index.documents.find((d) => d.id === id)!;
          const ratio = score / queryTerms.length;
          const confidence =
            ratio >= 1 ? "exact" : ratio >= 0.5 ? "partial" : "related-only";
          return {
            id: doc.id,
            title: doc.title,
            type: doc.type,
            summary: doc.summary,
            tags: doc.tags,
            related: doc.related,
            path: doc.path,
            confidence,
          };
        });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ profile, query, results }, null, 2),
          },
        ],
      };
    }
  );

  // ─── get_document ────────────────────────────────────────────────────────────
  server.tool(
    "get_document",
    "Retrieve the full Markdown content of a document by its ID.",
    {
      profile: z.enum(PROFILES).describe("Which knowledge profile the document belongs to"),
      id: z.string().describe("Document ID, as returned by search_knowledge"),
    },
    async ({ profile, id }) => {
      const index = await getCache<SearchIndex>(env, `index:${profile}`);
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

      const doc = index.documents.find((d) => d.id === id);
      if (!doc) {
        return {
          content: [
            {
              type: "text",
              text: `Document "${id}" not found in profile "${profile}".`,
            },
          ],
        };
      }

      let body: string;
      try {
        body = await fetchRawDoc(env, profile, doc.path, doc.id);
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

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: doc.id,
                title: doc.title,
                type: doc.type,
                tags: doc.tags,
                summary: doc.summary,
                updated_at: doc.updated_at,
                body,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ─── reindex_profile ─────────────────────────────────────────────────────────
  server.tool(
    "reindex_profile",
    "Force a rebuild of the search index for a profile from the latest GitHub manifest.",
    {
      profile: z.enum(PROFILES).describe("Which knowledge profile to reindex"),
    },
    async ({ profile }) => {
      try {
        await buildIndex(env, profile);
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
    }
  );
}
