# AI Step-by-Step Implementation Plan for MCP Knowledge Server

This document outlines the step-by-step tasks for an AI agent to build the MVP of the MCP Knowledge Server, as specified in the PRD.

## Phase 1: Scaffold
- [ ] Initialize Cloudflare Workers project using the template (run `pnpm create cloudflare@latest . --template=cloudflare/ai/demos/remote-mcp-authless` in the root).
- [ ] Install dependencies: `pnpm add zod`.
- [ ] Scaffold folder structure inside `src/`: `mcp/tools`, `registry`, `indexer`, `fetcher`, `cache`.
- [ ] Add `types.ts` for data contracts.

## Phase 2: KV Namespaces & Registry setup
- [ ] Configure `wrangler.jsonc` to include `KNOWLEDGE_CACHE` KV namespace binding.
- [ ] Implement `src/cache/kv.ts` for get/set/ttl helpers.
- [ ] Implement `src/registry/registry.ts` to read `config:registry` from KV.

## Phase 3: Content Fetcher (`src/fetcher/github.ts`)
- [ ] Implement `fetchManifest(profile)`: Fetch from GitHub URL defined in registry, handle caching/ETags.
- [ ] Implement `fetchRawDoc(profile, path)`: Fetch markdown file from GitHub, strip frontmatter, handle caching/ETags.

## Phase 4: Indexer (`src/indexer/buildIndex.ts`)
- [ ] Implement `buildIndex(profile)`: Fetch manifest, lowercase/tokenize metadata (`title`, `tags`, `keywords`, `summary`), build term index, store `index:{profile}` in KV.
- [ ] Add Cron Trigger in `wrangler.jsonc` to run index builder periodically.

## Phase 5: MCP Tools (`src/mcp/tools/*`)
- [ ] Implement `list_profiles`: Returns available profiles.
- [ ] Implement `search_knowledge`: Tokenizes query, matches against cached `index:{profile}`, and returns top N results.
- [ ] Implement `get_document`: Looks up path from index, calls `fetchRawDoc`, returns markdown content.
- [ ] Implement `reindex_profile`: Manually triggers `buildIndex`.
- [ ] Register all tools using `createMcpHandler` in `src/mcp/server.ts`.

## Phase 6: Auth Check (`src/index.ts`)
- [ ] Add standard Bearer token authorization check: `request.headers.get("Authorization") === Bearer ${env.AUTH_TOKEN}`.

## Phase 7: Local Testing readiness
- [ ] Provide instructions to start dev server (`wrangler dev`) and configure inspector.
- [ ] Validate "not found" behavior for missing queries.
