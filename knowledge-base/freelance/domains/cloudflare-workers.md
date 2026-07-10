---
id: domain-cloudflare-workers
title: Cloudflare Workers & Edge Computing
type: domain
tags: [cloudflare, workers, edge, serverless, kv, wrangler]
keywords: [cloudflare, worker, edge, serverless, kv, durable-objects, wrangler, deploy]
related: [proj-mcp-knowledge-server]
summary: Domain expertise in Cloudflare Workers platform — building, deploying, and optimizing edge serverless functions with KV storage, Cron Triggers, and the Workers runtime.
priority: 1
updated_at: 2026-07-05
---

# Cloudflare Workers & Edge Computing

## Platform Knowledge

- Workers runtime (V8 isolates, 10ms CPU budget, no filesystem)
- KV Namespace — key-value storage with TTL, ETag caching
- Durable Objects — stateful coordination (not needed for this use case)
- Cron Triggers — scheduled background jobs
- `wrangler` CLI — dev, deploy, kv operations, secrets, tail

## Patterns

### Cache-first data fetching

```typescript
const cached = await kv.get(key, "json");
if (cached) return cached;
const fresh = await fetch(url);
await kv.put(key, JSON.stringify(fresh), { expirationTtl: 600 });
return fresh;
```

### Stateless MCP server

```typescript
// One transport instance per request — no session state
const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true,
});
```

## Pricing Context (Free Plan)

| Resource | Free Limit |
|----------|-----------|
| Requests | 100K/day |
| CPU time | 10ms/request |
| KV reads | 100K/day |
| KV writes | 1K/day |
