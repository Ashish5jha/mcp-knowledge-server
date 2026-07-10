# 📖 MCP Knowledge Server — Operations Playbook

This document serves as a cheat sheet for everyday operations, troubleshooting, and extending your MCP Knowledge Server.

---

## 📂 File Directory Quick Links
- ⚙️ **Wrangler Configuration:** [wrangler.jsonc](file:///c:/Users/Ashish%20jha/Desktop/mcp-knowledge-server/wrangler.jsonc)
- 🛠️ **MCP Tools Register:** [src/mcp/tools/index.ts](file:///c:/Users/Ashish%20jha/Desktop/mcp-knowledge-server/src/mcp/tools/index.ts)
- 📄 **Main Entrypoint:** [src/index.ts](file:///c:/Users/Ashish%20jha/Desktop/mcp-knowledge-server/src/index.ts)
- 🗂️ **Types Definition:** [src/types.ts](file:///c:/Users/Ashish%20jha/Desktop/mcp-knowledge-server/src/types.ts)
- ⚙️ **Local Manifest Script:** [scripts/build-manifest.js](file:///c:/Users/Ashish%20jha/Desktop/mcp-knowledge-server/scripts/build-manifest.js)
- 🚀 **GitHub CI Workflow:** [.github/workflows/build-manifest.yml](file:///c:/Users/Ashish%20jha/Desktop/mcp-knowledge-server/.github/workflows/build-manifest.yml)

---

## 🏃‍♂️ Scenario 1: I added, edited, or deleted a document

When you add new `.md` files or modify existing ones under the [knowledge-base/](file:///c:/Users/Ashish%20jha/Desktop/mcp-knowledge-server/knowledge-base/) directory, follow these steps to make them searchable by the AI:

### 1. Build Manifests Locally (Optional, for verification)
Run this command to make sure there are no syntax or frontmatter errors in your new files:
```bash
npm run build:manifests
```
*If a document is missing any required frontmatter fields (`id`, `title`, `type`, `summary`, `tags`, `keywords`), the script will fail and tell you exactly which file has issues.*

### 2. Push to GitHub
Commit and push your changes to your `main` branch. This triggers the GitHub Action [.github/workflows/build-manifest.yml](file:///c:/Users/Ashish%20jha/Desktop/mcp-knowledge-server/.github/workflows/build-manifest.yml), which automatically regenerates the `manifest.json` files on GitHub and commits them:
```bash
git add .
git commit -m "feat: add notes on new API architecture"
git push origin main
```

### 3. Reindex the Profile (Crucial)
The Cloudflare Worker caches search indexes to avoid hitting GitHub on every single query. To force the server to load your new manifests immediately, call the `reindex_profile` tool from your AI assistant (e.g. Cursor, Claude Code) or run:
```bash
# To trigger a reindex on the deployed server:
# Call the "reindex_profile" tool with parameters:
# { "profile": "personal" } (or "company" / "freelance")
```

---

## 🔗 Scenario 2: Connecting a new AI assistant (Claude Code / Cursor / VS Code)

To link your remote knowledge base to any IDE/CLI assistant, use the following connection credentials:

- **Server URL Endpoint:** `https://mcp-knowledge-server.ashish-biller.workers.dev/mcp`
- **Required Headers:**
  - `Authorization: Bearer MyrelaSecret123Ashish@`
  - `Content-Type: application/json`

### Example: Claude Code Connection Command
```bash
claude mcp add --transport http knowledge \
  https://mcp-knowledge-server.ashish-biller.workers.dev/mcp \
  --header "Authorization: Bearer MyrelaSecret123Ashish@"
```

### Example: Cursor Settings Config
Add a new HTTP MCP server in **Cursor settings (MCP section)**:
- **Name:** `knowledge`
- **Type:** `SSE`
- **URL:** `https://mcp-knowledge-server.ashish-biller.workers.dev/mcp`
- Click `+ Headers` and add:
  - Key: `Authorization` / Value: `Bearer MyrelaSecret123Ashish@`

---

## 🌐 Scenario 3: Changing where documents are stored (Registry Update)

If you move your knowledge base to a different GitHub repository or branch, you **do not** need to redeploy the worker code. You only need to update the `config:registry` key in Cloudflare KV.

### 1. Prepare your Registry JSON
Update the URL fields matching your new repository:
```json
{
  "company": {
    "manifestUrl": "https://raw.githubusercontent.com/<YOUR_USER>/<YOUR_REPO>/<BRANCH>/company/manifest.json",
    "rawBase": "https://raw.githubusercontent.com/<YOUR_USER>/<YOUR_REPO>/<BRANCH>/company/"
  },
  "personal": {
    "manifestUrl": "https://raw.githubusercontent.com/<YOUR_USER>/<YOUR_REPO>/<BRANCH>/personal/manifest.json",
    "rawBase": "https://raw.githubusercontent.com/<YOUR_USER>/<YOUR_REPO>/<BRANCH>/personal/"
  },
  "freelance": {
    "manifestUrl": "https://raw.githubusercontent.com/<YOUR_USER>/<YOUR_REPO>/<BRANCH>/freelance/manifest.json",
    "rawBase": "https://raw.githubusercontent.com/<YOUR_USER>/<YOUR_REPO>/<BRANCH>/freelance/"
  }
}
```

### 2. Update local and production KV
Save your new registry configuration to local cache and production Cloudflare:
```bash
# Save to a temporary file registry.json, then run:

# For Local Development testing:
npx wrangler kv key put --binding=KNOWLEDGE_CACHE "config:registry" --local --file=registry.json

# For Production (Live server):
npx wrangler kv key put --binding=KNOWLEDGE_CACHE "config:registry" --remote --file=registry.json
```

---

## 🛠️ Scenario 4: Adding a new profile (e.g., adding `academic`)

If you want to add a fourth profile category (like `academic` or `projects`), you need to update a few lines in the code:

### 1. Update Types and Arrays
In [src/index.ts](file:///c:/Users/Ashish%20jha/Desktop/mcp-knowledge-server/src/index.ts#L7), [src/types.ts](file:///c:/Users/Ashish%20jha/Desktop/mcp-knowledge-server/src/types.ts#L6), and [src/mcp/tools/index.ts](file:///c:/Users/Ashish%20jha/Desktop/mcp-knowledge-server/src/mcp/tools/index.ts#L10), add your new profile:
```typescript
// Add "academic" to the profiles array
const PROFILES = ["company", "personal", "freelance", "academic"] as const;
```

### 2. Add Registry Configuration
In your `registry.json` (from Scenario 3), add the configuration for the new profile:
```json
"academic": {
  "manifestUrl": "https://raw.githubusercontent.com/Ashish5jha/mcp-knowledge-server/main/knowledge-base/academic/manifest.json",
  "rawBase": "https://raw.githubusercontent.com/Ashish5jha/mcp-knowledge-server/main/knowledge-base/academic/"
}
```
*Save this to KV using the `wrangler kv key put` commands.*

### 3. Build & Deploy
Deploy the updated code to Cloudflare:
```bash
npm run typecheck
npx wrangler deploy
```

---

## 🔀 Scenario 5: Hosting your documents in a completely different GitHub repository

If your Markdown documents live in a completely different repository (not in the `mcp-knowledge-server` repository), you need to set up the build scripts there so the manifest gets generated automatically when you push.

### 1. Copy the build scripts to your other repository
From this project, copy the following items into the root of your *other* repository where your documents live:
- The `scripts/build-manifest.js` file
- The `scripts/package.json` file (creates a `scripts` folder if needed)
- The GitHub workflow file `.github/workflows/build-manifest.yml`

### 2. Update the workflow file
In your new repository's `.github/workflows/build-manifest.yml`, make sure the paths match where you are storing the documents (e.g. `knowledge-base/**`).

### 3. Update the Server Registry
Back in this project (or via the terminal), update the KV registry to point to your *other* repository's raw URLs (as described in **Scenario 3**). You do *not* need to redeploy the worker.

### 4. Trigger a Reindex
Once the GitHub Action runs in your other repository and creates the `manifest.json`, call the `reindex_profile` MCP tool from your AI assistant to force the Cloudflare Worker to pull the new data.

---

## 🔍 How to check logs or troubleshoot issues

If your server is failing to respond, run the Cloudflare tail tool to inspect incoming traffic and errors in real-time:

```bash
# View real-time error logs for the live worker:
npx wrangler tail
```
