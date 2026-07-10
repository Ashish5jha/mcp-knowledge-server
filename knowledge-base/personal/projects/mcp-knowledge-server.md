---
id: proj-mcp-knowledge-server
title: MCP Knowledge Server
type: project
tags: [mcp, cloudflare, workers, ai, knowledge-base]
keywords: [mcp, model-context-protocol, cloudflare, worker, knowledge, retrieval, ai, llm]
related: [skill-typescript, skill-cloudflare-workers]
summary: A Cloudflare Worker that acts as a remote MCP server, giving AI assistants structured read-only access to a personal knowledge base stored as Markdown in GitHub.
priority: 1
updated_at: 2026-07-10
---

# MCP Knowledge Server

A remote MCP (Model Context Protocol) server running on Cloudflare Workers that exposes personal knowledge to AI assistants like Claude, Cursor, and Copilot.

## How It Works

1. Markdown files with YAML frontmatter live in a GitHub repo
2. A GitHub Action runs `build-manifest.js` on every push, generating `manifest.json`
3. The Cloudflare Worker fetches the manifest and builds a search index in KV
4. MCP tools (`list_profiles`, `search_knowledge`, `get_document`, `reindex_profile`) expose the knowledge over HTTP

## Tech Stack

- Cloudflare Workers (Typescript)
- Cloudflare KV (cache + index)
- MCP SDK `@modelcontextprotocol/sdk`
- Zod for input validation
- GitHub Pages / raw.githubusercontent.com for content hosting

## Profiles

| Profile | Purpose |
|---------|---------|
| `personal` | Side projects, learning, personal notes |
| `company` | Work skills, company projects, architecture docs |
| `freelance` | Client work, proposals, domain expertise |
