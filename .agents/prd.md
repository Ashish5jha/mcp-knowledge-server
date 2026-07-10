# MCP Knowledge Server — Agent Build Guide (v1 / MVP)

> **How to use this file:** Paste this into the project root as `CLAUDE.md` (if using Claude Code) or reference it directly in your first prompt to your VS Code AI agent. It is written as a literal build runbook — follow the phases in order, in one sitting if possible. Do not skip Section 1 (constraints); it exists specifically to stop the agent from over-building.

---

## 0. Purpose (read this first)

You are building **one Cloudflare Worker** that acts as a remote MCP server. It gives AI assistants (Claude Code, Cursor, VS Code Copilot, etc.) read-only, structured access to a personal knowledge base stored as Markdown in GitHub, split into three isolated profiles: `company`, `personal`, `freelance`.

The server's job is narrow and specific:

1. Know where each profile's content lives (a registry, not a hardcoded URL).
2. Fetch a pre-built manifest of documents for a profile.
3. Search that manifest's metadata and return the best matches.
4. Fetch and return one document's full content on request.
5. Never invent an answer if the content isn't there — return "not found" instead.

That's the whole product. Everything else is explicitly deferred (see Section 1).

---

## 1. Non-negotiable constraints — do NOT build these in v1

An agent left unsupervised will want to "improve" this. Don't. Each of these was deliberately cut:

- **No OAuth.** This is a single-user personal server. Use one static bearer token checked in the fetch handler. OAuth is real Cloudflare-supported functionality, but it's the wrong tool for a server with one user.
- **No Durable Objects, no per-session state.** The server is stateless — every tool call is independent. Use `createMcpHandler` from the Agents SDK, not the stateful `McpAgent` class.
- **No semantic/vector search (Vectorize) in v1.** Keyword + tag + substring matching against pre-indexed metadata is enough at this scale. Note this for v2, don't build it now.
- **No live full-text parsing of Markdown bodies at request time.** All ranking happens against metadata (title, tags, keywords, summary) that lives in `manifest.json`. Full document bodies are only fetched when a specific document is explicitly requested.
- **No D1 / SQL database.** KV is sufficient for a registry, an index, and a content cache.
- **No multi-repo-per-profile, no versioned history, no link validation, no confidence scoring.** One repo (or one folder per profile) per environment variable is enough.

If you (the agent) find yourself about to add any of the above, stop and flag it to the user instead of building it silently.

---

## 2. Architecture overview

Two separate lifecycles — keep them separate in code:

**A. Offline / periodic (cheap, runs occasionally):**
Cron Trigger (or manual `reindex_profile` tool call) → fetch `manifest.json` for a profile from GitHub → build a small in-memory index (doc list + term→docIds map) from metadata only → store as one JSON blob in KV at `index:{profile}`.

**B. Online / per-request (must stay under Workers' 10ms CPU budget on the free plan):**
MCP tool call → auth check → read `index:{profile}` from KV (I/O, not CPU) → do a cheap lookup against the already-built index → return results. `get_document` additionally fetches one raw Markdown file from GitHub (cached in KV with a TTL) and strips its frontmatter before returning.

This split exists because Cloudflare's Workers Free plan gives 10ms of **CPU time** per request (not wall-clock — network waits don't count), and doing full parsing + fuzzy ranking over raw Markdown on every request would blow through that as the knowledge base grows. Precomputing the index sidesteps this entirely.

---

## 3. Content repository contract

The Worker doesn't own your knowledge content — it reads it from GitHub. Content can live in one repo or three; the Worker only cares about the registry (Section 5).

### Folder structure (per profile)

```
company/
  skills/
  projects/
  domains/
  glossary/
  architecture/
  flows/
  snippets/
  troubleshooting/
  manifest.json        <- generated, see below
personal/
  ...same structure...
freelance/
  ...same structure...
```

### Frontmatter contract (every `.md` file)

```markdown
---
id: proj-mcp-server
title: MCP Knowledge Server
type: project
tags: [mcp, cloudflare, workers]
keywords: [mcp, retrieval, knowledge, cloudflare]
related: [skill-typescript, domain-ai-tools]
summary: A Cloudflare Worker that serves personal knowledge over MCP.
priority: 1
updated_at: 2026-07-01
---

# MCP Knowledge Server

Full markdown body goes here...
```

### `manifest.json` — auto-generate this, never hand-maintain it

Hand-maintained manifests drift from the actual files. Instead, add a small Node script to the content repo:

```
scripts/build-manifest.js   (uses the `gray-matter` package)
```

It should: walk every `.md` file under a profile folder → read frontmatter → emit `manifest.json` at the profile root:

```json
{
	"profile": "personal",
	"version": "2026-07-10T00:00:00Z",
	"documents": [
		{
			"id": "proj-mcp-server",
			"path": "projects/mcp-knowledge-server.md",
			"title": "MCP Knowledge Server",
			"type": "project",
			"tags": ["mcp", "cloudflare", "workers"],
			"keywords": ["mcp", "retrieval", "knowledge", "cloudflare"],
			"related": ["skill-typescript", "domain-ai-tools"],
			"summary": "A Cloudflare Worker that serves personal knowledge over MCP.",
			"priority": 1,
			"updated_at": "2026-07-01"
		}
	]
}
```

Run this script via a GitHub Action on every push to `main`, committing the updated `manifest.json`. This guarantees the manifest and the files never disagree.

---

## 4. Worker project structure

```
mcp-knowledge-server/
  src/
    index.ts                 # entry: auth check -> createMcpHandler
    mcp/
      server.ts               # tool registration
      tools/
        searchKnowledge.ts
        getDocument.ts
        listProfiles.ts
        reindexProfile.ts
    registry/
      registry.ts              # reads profile->source mapping from KV
    indexer/
      buildIndex.ts            # fetch manifest -> build term index -> store in KV
    fetcher/
      github.ts                 # fetch manifest.json / raw doc content, with KV caching + conditional requests
    cache/
      kv.ts                     # get/set/ttl helpers
    types.ts
  wrangler.jsonc
  package.json
  tsconfig.json
  README.md
```

---

## 5. Data contracts in KV

**Registry** — `config:registry` (edit this to move content without redeploying code):

```json
{
	"company": {
		"manifestUrl": "https://raw.githubusercontent.com/<user>/<repo>/main/company/manifest.json",
		"rawBase": "https://raw.githubusercontent.com/<user>/<repo>/main/company/"
	},
	"personal": {
		"manifestUrl": "https://raw.githubusercontent.com/<user>/<repo>/main/personal/manifest.json",
		"rawBase": "https://raw.githubusercontent.com/<user>/<repo>/main/personal/"
	},
	"freelance": {
		"manifestUrl": "https://raw.githubusercontent.com/<user>/<repo>/main/freelance/manifest.json",
		"rawBase": "https://raw.githubusercontent.com/<user>/<repo>/main/freelance/"
	}
}
```

**Search index** — `index:{profile}`:

```json
{
	"version": "<manifest version>",
	"builtAt": "2026-07-10T12:00:00Z",
	"documents": [/* same shape as manifest documents */],
	"termIndex": {
		"mcp": ["proj-mcp-server"],
		"cloudflare": ["proj-mcp-server", "skill-workers"]
	}
}
```

`termIndex` is built by lowercasing and tokenizing each doc's `title`, `tags`, `keywords`, and `summary` at index-build time — never at request time.

**Manifest fetch cache** — `manifest:{profile}` — raw manifest + ETag, TTL ~10 minutes, so the cron job and manual reindex don't hammer GitHub.

**Document content cache** — `content:{profile}:{id}` — fetched Markdown body (frontmatter stripped) + ETag, TTL ~1 hour via KV `expirationTtl`.

---

## 6. MCP tool specifications

Keep the tool count small — fewer, well-scoped tools beat many granular ones for both latency and agent context budget.

### `list_profiles`

No input. Returns the three profile names plus a one-line description of each (from the registry). Lets a client discover what's available without guessing.

### `search_knowledge`

```ts
{
  profile: z.enum(["company", "personal", "freelance"]),
  query: z.string().describe("Keywords, a title, or a topic"),
  limit: z.number().min(1).max(20).default(5)
}
```

Reads `index:{profile}` from KV, tokenizes the query the same way the index was built, scores documents by term overlap (title/tag matches weighted higher than summary matches), and returns the top `limit` results: `id`, `title`, `type`, `summary`, `tags`, `related`, `path`, and a `confidence` label (`exact` / `partial` / `related-only`). If nothing matches, return an explicit "no matching documents in this profile" result — never fall back to a different profile and never fabricate a summary.

### `get_document`

```ts
{
  profile: z.enum(["company", "personal", "freelance"]),
  id: z.string().describe("Document id, as returned by search_knowledge")
}
```

Looks up the doc's `path` from the cached index, fetches raw content (cache-first), strips the frontmatter block, and returns the Markdown body plus its metadata. If the id isn't found in that profile's index, say so — don't search other profiles.

### `reindex_profile` (admin/manual)

```ts
{
	profile: z.enum(["company", "personal", "freelance"]);
}
```

Forces an immediate rebuild of `index:{profile}` from the current manifest, bypassing the cron schedule. Useful right after publishing new content. Gated by the same bearer-token auth as every other call — no separate admin permission system needed at this scale.

---

## 7. Auth

One secret, one check, done:

```ts
// in src/index.ts, before routing to createMcpHandler
const auth = request.headers.get("Authorization");
if (auth !== `Bearer ${env.AUTH_TOKEN}`) {
	return new Response("Unauthorized", { status: 401 });
}
```

Set the secret with `wrangler secret put AUTH_TOKEN` (never commit it, never put it in `wrangler.jsonc`).

---

## 8. Caching & rate-limit strategy

- Every GitHub fetch (manifest or raw file) goes through the KV cache first. Only fetch from GitHub on a cache miss or expired TTL.
- Manifest TTL: ~10 minutes. Document content TTL: ~1 hour. Index rebuild: every 6 hours via Cron Trigger, or on-demand via `reindex_profile`.
- This keeps you comfortably inside both GitHub's rate limits and the Workers Free KV allowance (100K reads/day, 1K writes/day) even with frequent use.

---

## 9. Build phases — execute in order

**Phase 0 — Prerequisites**

- Cloudflare account, `wrangler` CLI installed and logged in (`wrangler login`).
- A GitHub repo (or repos) with `company/`, `personal/`, `freelance/` folders, each containing at least one frontmatter-tagged `.md` file and a generated `manifest.json` (Section 3).

**Phase 1 — Scaffold**

```bash
pnpm create cloudflare@latest mcp-knowledge-server --template=cloudflare/ai/demos/remote-mcp-authless
cd mcp-knowledge-server
pnpm add zod
```

**Phase 2 — Registry**

```bash
wrangler kv namespace create KNOWLEDGE_CACHE
# add the returned id to wrangler.jsonc as a KV binding named KNOWLEDGE_CACHE
wrangler kv key put --binding=KNOWLEDGE_CACHE "config:registry" '<registry JSON from Section 5>'
```

**Phase 3 — Content fetcher** (`src/fetcher/github.ts`)
Implement `fetchManifest(profile)` and `fetchRawDoc(profile, path)`, both cache-first against KV, both storing ETags for conditional requests.

**Phase 4 — Indexer** (`src/indexer/buildIndex.ts`)
Implement `buildIndex(profile)`: fetch manifest → tokenize metadata fields → write `index:{profile}` to KV. Wire it to a Cron Trigger in `wrangler.jsonc` (every 6 hours) and to the `reindex_profile` tool.

**Phase 5 — MCP tools**
Implement the four tools from Section 6 using `createMcpHandler` (stateless — no `McpAgent`, no Durable Objects needed for this use case).

**Phase 6 — Auth**
Add the bearer-token check from Section 7 in front of the MCP handler.

**Phase 7 — Local testing**

```bash
wrangler dev
npx @modelcontextprotocol/inspector
# Point Inspector at http://localhost:8788/mcp, transport = Streamable HTTP,
# add header Authorization: Bearer <your local test token>
```

Verify `list_profiles`, `search_knowledge`, and `get_document` all work and that a query with no matches returns "not found" rather than a guess.

**Phase 8 — Deploy**

```bash
wrangler deploy
```

Your server is live at `https://mcp-knowledge-server.<your-account>.workers.dev/mcp`.

---

## 10. Connect it from VS Code / Claude Code

Claude Code (CLI):

```bash
claude mcp add --transport http knowledge \
  https://mcp-knowledge-server.<your-account>.workers.dev/mcp \
  --header "Authorization: Bearer <your AUTH_TOKEN>"
```

Or via a project `.mcp.json`:

```json
{
	"mcpServers": {
		"knowledge": {
			"type": "http",
			"url": "https://mcp-knowledge-server.<your-account>.workers.dev/mcp",
			"headers": { "Authorization": "Bearer <your AUTH_TOKEN>" }
		}
	}
}
```

Run `claude mcp list` to confirm it's registered, then ask Claude Code to use it — e.g. "search my personal knowledge for notes on X."

---

## 11. Definition of done

- [ ] `list_profiles`, `search_knowledge`, `get_document`, `reindex_profile` all work against a deployed Worker, not just locally.
- [ ] A query with no matching content returns an explicit "not found," never a fabricated answer.
- [ ] Company, personal, and freelance results never mix unless the same query is run twice against different profiles explicitly.
- [ ] Changing the registry (KV `config:registry`) alone — no redeploy — lets you point a profile at a different GitHub location.
- [ ] The index rebuild runs on its Cron schedule without manual intervention, and `reindex_profile` can force it early.
- [ ] Everything in Section 1's "do not build" list is still absent.

---

## 12. Explicitly deferred to v2 (do not build now, just note them)

- Semantic search via Cloudflare Vectorize (free tier exists: 30M queried vector dimensions/month — genuinely feasible later, just not v1).
- Fuzzy string matching beyond simple substring/token overlap.
- OAuth, if this ever becomes multi-user.
- Cross-document relationship graphs beyond the flat `related` field already in the manifest.
