# MCP Knowledge Server — UI Verification Plan for AI Agent

> **How to use this file:** Give this file to GPT / Claude / any coding AI working on this repo. It is a build and behavior guide. The AI must follow this document carefully, inspect the existing code first, and implement only what is requested here without over-building.

---

## 0. Goal

You are working inside an existing Cloudflare Worker project called `mcp-knowledge-server`.

This project already has a working MCP endpoint, a Cloudflare KV / GitHub-backed indexing flow, and a console-style UI route in the codebase.

The user's main problem is:

- they need to **trust and verify what data is currently present in Cloudflare**
- they need to **know what exact indexed data GPT / Claude are using**
- they want the existing UI on the same Worker URL to clearly verify:
    - latest indexed data
    - profile-wise data
    - search results
    - document contents
    - reindex status
    - whether Cloudflare is stale vs GitHub manifest

The user wants a **modern, simple, dark matte UI** with a **greyish aesthetic**, similar to the mood of the screenshot they shared.

The UI must be hosted on the **same Cloudflare Worker URL** currently used by the MCP server.

- Keep MCP endpoint at `/mcp`
- Add a UI route like `/console` or `/dashboard`
- Preferred route: `/console`

Example:

- MCP: `https://<worker-url>/mcp`
- UI: `https://<worker-url>/console`

---

## 1. Current project reality — inspect before changing anything

Before editing code, inspect these files carefully:

- `README.md`
- `wrangler.jsonc`
- `src/index.ts`
- `src/types.ts`
- `src/mcp/tools/index.ts`
- `src/registry/registry.ts`
- `src/indexer/buildIndex.ts`
- `src/fetcher/github.ts`
- `src/cache/kv.ts`
- `src/oauth/handler.ts`

Important: this repo already contains:

- Cloudflare Worker entrypoint
- `/mcp` route
- `/console` route
- `/api/console/*` routes
- OAuth routes
- KV storage
- profile support:
    - `company`
    - `personal`
    - `freelance`
- shared search/document logic used by both MCP and console
- search index stored in KV as:
    - `index:{profile}`
- registry stored in KV as:
    - `config:registry`
- manifest cache:
    - `manifest:{profile}`
- content cache:
    - `content:{profile}:{id}`

Do **not** assume the codebase matches an old PRD exactly. The real source of truth is the current code.

---

## 2. Core problem to solve

The MCP tools and console exist, but the user needs a trustworthy verification workflow and aligned documentation.

The user needs to answer these questions reliably:

1. What data is currently indexed in Cloudflare KV?
2. Which profile data is currently available?
3. What manifest version is GitHub currently serving?
4. Is Cloudflare stale compared to GitHub?
5. What exact results will GPT / Claude get when they search?
6. What exact document content will `get_document` return?
7. Can I manually reindex and verify it worked?

The UI must solve these questions directly.

---

## 3. Non-negotiable product requirements

You must implement the following:

### Required

- Keep `/mcp` working
- Keep existing OAuth routes working
- Keep the UI route on the same Worker URL working correctly
- Add profile selector at the top
- Show exact data currently used by MCP from Cloudflare KV
- Show GitHub manifest source information
- Show stale / fresh / missing state
- Allow manual reindex from UI
- Allow search using current Cloudflare index
- Allow opening documents and viewing content
- Use a dark, modern, simple, matte UI
- Keep implementation minimal, maintainable, and consistent with the existing repo

### Preferred UI route

- `/console`

### Required profiles

- `company`
- `personal`
- `freelance`

---

## 4. Non-negotiable engineering constraints

Do **not** do any of the following unless absolutely necessary:

- Do not break `/mcp`
- Do not remove existing OAuth flow
- Do not move the MCP endpoint away from `/mcp`
- Do not introduce a separate deployed frontend app
- Do not introduce D1, SQL, Vectorize, Durable Objects, or extra infrastructure for this feature
- Do not create fake or guessed data
- Do not build a totally separate admin backend
- Do not overcomplicate routing
- Do not replace the current search/index logic unless there is a clear bug
- Do not redesign the repo unnecessarily

Preferred implementation style:

- same Worker
- same deployment
- UI served by Worker
- lightweight frontend
- small internal JSON endpoints

---

## 5. AI behavior rules

When working on this task, behave like this:

1. **Inspect first**
    - Read relevant files before changing code
    - Understand current routes and KV usage
    - Confirm how search currently works

2. **Preserve existing behavior**
    - Existing MCP behavior must keep working
    - Existing auth/OAuth behavior must not regress

3. **Be precise**
    - Do only what is needed for this dashboard
    - Avoid unrelated cleanup

4. **Be transparent**
    - If something in current code conflicts with older docs, trust the code and mention the mismatch
    - If a route or auth decision is risky, explain it

5. **Do not invent**
    - If data is missing, show missing
    - If manifest fetch fails, show failure
    - If index is stale, show stale
    - Never mask backend problems with fake success states

6. **Prefer simple implementation**
    - Vanilla HTML/CSS/JS is preferred for v1 dashboard
    - A framework is allowed only if clearly justified, but likely unnecessary here

7. **Validate**
    - After changes, run typecheck and any available validation
    - Confirm that `/mcp` route remains intact
    - Confirm new UI route works

---

## 6. Expected end result

Build a dashboard that lets the user verify the state of the knowledge system.

The UI should answer:

### A. What Cloudflare is serving now

For selected profile, show:

- whether `index:{profile}` exists
- index version
- builtAt
- document count
- sample docs or recent docs
- latest `updated_at` values if available

### B. What GitHub currently has

For selected profile, show:

- manifest URL
- raw base URL
- manifest version
- manifest document count
- fetch status

### C. Whether they match

Compare:

- current KV index data
- current GitHub manifest data

Show:

- in sync / stale / missing / error
- added docs
- removed docs
- changed docs

### D. How search behaves now

Search should use the same indexed data MCP uses.

Show:

- title
- id
- type
- summary
- tags
- path
- score
- confidence

### E. Exact document content

For selected document, show:

- metadata
- raw markdown
- rendered preview if practical

### F. Manual controls

Provide:

- refresh
- reindex
- maybe force-refresh / force-reindex if implemented safely

---

## 7. Recommended route structure

Keep current routes.

Add:

- `GET /` → redirect to `/console`
- `GET /console` → dashboard HTML
- `GET /api/console/profiles`
- `GET /api/console/status?profile=personal`
- `GET /api/console/compare?profile=personal`
- `GET /api/console/search?profile=personal&q=query&limit=10`
- `GET /api/console/document?profile=personal&id=doc-id`
- `POST /api/console/reindex`
- optional future route: `POST /api/console/reindex/force`

Do not remove:

- `/mcp`
- `/.well-known/oauth-authorization-server`
- `/oauth/register`
- `/oauth/authorize`
- `/oauth/callback`
- `/oauth/token`

---

## 8. Authentication approach for the UI

Choose the simplest safe approach first.

### Recommended v1 approach

- `/console` can load the HTML shell
- API calls require `Authorization: Bearer <token>`
- UI allows user to paste token into an input
- Store token in `localStorage`
- Include token in fetch headers

Why this is preferred:

- minimal changes
- compatible with existing auth model
- no cookie/session complexity
- low risk

Do not weaken security for convenience.

If browser/OAuth login is added later, treat it as a follow-up, not v1 scope.

---

## 9. Recommended file structure

The current implementation already uses a `src/console/` area. Keep that structure unless there is a strong reason to change it.

Example structure:

```txt
src/
  index.ts
  console/
    handler.ts
    logic.ts
```

Alternative:

- if the console grows later, it may be split into more files under `src/console/`
- embed HTML/CSS/JS directly from TypeScript if that remains the simplest approach for this repo

Keep the implementation maintainable and small.

---

## 10. Data contract expectations for dashboard APIs

### `GET /api/console/status?profile=personal`

Return something like:

```json
{
	"profile": "personal",
	"registry": {
		"manifestUrl": "https://...",
		"rawBase": "https://..."
	},
	"cloudflareIndex": {
		"exists": true,
		"version": "2026-07-18T10:00:00Z",
		"builtAt": "2026-07-18T10:01:00Z",
		"documentCount": 42
	},
	"githubManifest": {
		"reachable": true,
		"version": "2026-07-18T12:00:00Z",
		"documentCount": 44
	},
	"freshness": {
		"state": "stale",
		"reason": "manifest version differs from current index version"
	}
}
```

### `GET /api/console/compare?profile=personal`

Return something like:

```json
{
	"profile": "personal",
	"summary": {
		"state": "out_of_sync",
		"added": 2,
		"removed": 1,
		"changed": 4
	},
	"addedDocs": [],
	"removedDocs": [],
	"changedDocs": []
}
```

### `GET /api/console/search?...`

Return search results based on current index.

### `GET /api/console/document?...`

Return document metadata + body for selected profile/doc.

---

## 11. UI design direction

The user explicitly wants:

- modern
- simplicity
- dark mode
- matte finish
- greyish color palette
- similar visual mood to the screenshot

### Visual guidelines

Use:

- charcoal background
- muted grey panels
- soft borders
- low-glow accents
- clean spacing
- rounded panels
- subtle depth
- minimal clutter

### Suggested palette

- background: near-black charcoal
- cards: dark graphite
- borders: soft slate grey
- text: off-white / cool grey
- accents: muted blue-grey or desaturated steel
- warning: soft amber
- success: restrained green
- error: muted red

### Layout recommendation

Top bar:

- title
- profile selector
- token input/status
- refresh button
- reindex button

Main content:

- status cards
- source/registry panel
- compare panel
- search panel
- result list
- document viewer

### UX quality bar

The UI should feel like a real admin tool, not a quick debug page.

---

## 12. Feature-by-feature implementation plan

### Phase 1 — Discovery

- Read current code
- Confirm route behavior in `src/index.ts`
- Confirm auth logic
- Confirm search/index/document flow
- Confirm KV keys

### Phase 2 — Route scaffolding

- Verify `/console` and `/api/console/*` routes match the intended behavior
- Keep route logic clean and non-invasive
- Do not duplicate business logic between MCP and console

### Phase 3 — Status backend

Implement endpoint(s) to expose:

- registry info
- current KV index info
- current manifest info
- freshness summary

### Phase 4 — Search + document backend

Implement:

- search endpoint using current index
- document endpoint using existing fetch logic

### Phase 5 — Compare logic

Implement:

- index vs manifest comparison
- added / removed / changed document reporting

### Phase 6 — Reindex controls

Implement:

- manual reindex trigger
- clear success/error feedback

### Phase 7 — Frontend UI

Build:

- dark dashboard shell
- profile switcher
- token input
- status cards
- search/results
- document view
- compare display

### Phase 8 — Polish

Improve:

- loading states
- error states
- badges
- timestamps
- empty states
- visual quality

### Phase 9 — Validation

Verify:

- `/mcp` still works
- dashboard loads
- profile switching works
- search matches current MCP index behavior
- reindex works
- status reflects real backend state

---

## 13. Important implementation details

### A. Preserve current search logic

The dashboard search should reflect what MCP does now.
Do not silently replace ranking behavior unless fixing a clear bug.

### B. Compare real live sources

If comparing manifest vs index:

- index = from KV
- manifest = from current registry source

### C. Show stale data honestly

If index version differs from manifest version, show stale.
If fetch fails, show error.
If KV entry is missing, show missing.

### D. Reuse current helpers where practical

Prefer reusing:

- registry code
- fetcher code
- indexer code
- cache helpers

### E. Keep Worker-friendly performance

Do not make UI requests excessively heavy.
Prefer concise JSON responses.

---

## 14. Optional but high-value enhancements

These are good if they stay simple:

- last reindex metadata in KV
- show last successful/failed reindex time
- show doc count changes after reindex
- show latest updated docs first
- raw/preview tabs in document viewer
- copy buttons for IDs, URLs, manifest URL, raw path
- search mode toggle:
    - current index
    - live manifest simulation

Only do these if they remain clean and within scope.

---

## 15. Out of scope unless clearly necessary

Do not add these in this task:

- separate frontend deployment
- React/Vite app unless absolutely justified
- database migration
- vector search
- semantic embeddings
- full-text indexing of document bodies
- multi-user admin system
- analytics pipeline
- large refactors unrelated to dashboard
- redesign of OAuth architecture

---

## 16. Definition of done

This task is done only when all of these are true:

- `/mcp` still works
- existing OAuth routes still work
- `/console` works on the same Worker URL
- user can choose profile at the top
- dashboard shows exact Cloudflare index state for selected profile
- dashboard shows current GitHub manifest state
- dashboard clearly shows stale/fresh/missing/error status
- dashboard can search current indexed data
- dashboard can open a selected document
- dashboard can trigger reindex
- dashboard looks polished in dark matte style
- validation is run and reported honestly

---

## 17. Final delivery expectations from the AI

When done, report:

1. What files were added or changed
2. What new routes were added
3. How the UI auth works
4. How the dashboard determines freshness
5. What validation was run
6. Any known limitations

Do not claim something works unless it was actually verified.
