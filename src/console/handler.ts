import { Env, PROFILES, Profile } from "../types";
import {
  compareProfile,
  getConsoleProfiles,
  getConsoleStatus,
  getDocument,
  getSearchResults,
  reindexProfile,
} from "./logic";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function htmlPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MCP Knowledge Console</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #141619;
      --panel: #1b1f24;
      --panel-2: #20262d;
      --border: #313842;
      --border-2: #454e59;
      --text: #e6e9ee;
      --muted: #97a0ac;
      --muted-2: #7d8793;
      --accent: #7e95ad;
      --accent-2: #607187;
      --ok: #4c7f68;
      --warn: #94764b;
      --bad: #9b5d5d;
      --shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
      --radius: 18px;
    }

    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top, rgba(120, 140, 160, 0.06), transparent 30%),
        linear-gradient(180deg, #16191d 0%, #121417 100%);
      color: var(--text);
    }

    button, input, select, textarea {
      font: inherit;
      color: inherit;
    }

    .shell {
      max-width: 1600px;
      margin: 0 auto;
      padding: 20px;
      display: grid;
      gap: 16px;
    }

    .topbar, .panel, .card {
      background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)), var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    .topbar {
      display: grid;
      gap: 16px;
      padding: 18px 20px;
    }

    .brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 11px;
      color: var(--muted-2);
      margin-bottom: 6px;
    }

    h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
    }

    .subtitle {
      color: var(--muted);
      margin-top: 4px;
      max-width: 880px;
    }

    .controls {
      display: grid;
      grid-template-columns: minmax(180px, 220px) minmax(220px, 1fr) auto auto auto;
      gap: 10px;
      align-items: end;
    }

    .field {
      display: grid;
      gap: 6px;
    }

    .field label {
      font-size: 12px;
      color: var(--muted);
    }

    input, select, textarea {
      width: 100%;
      border: 1px solid var(--border);
      background: var(--panel-2);
      border-radius: 12px;
      padding: 11px 12px;
      outline: none;
      transition: border-color 0.15s ease, transform 0.12s ease, background 0.15s ease;
    }

    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
      background: #252b32;
    }

    button {
      border: 1px solid var(--border);
      background: linear-gradient(180deg, #2a3138, #222830);
      border-radius: 12px;
      padding: 11px 14px;
      cursor: pointer;
      transition: transform 0.12s ease, border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
      white-space: nowrap;
    }

    button:hover:not(:disabled) {
      transform: translateY(-1px);
      border-color: var(--border-2);
      background: linear-gradient(180deg, #313840, #262c34);
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .ghost {
      background: transparent;
    }

    .statusline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 12px;
    }

    .token-state {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 26px;
    }

    .dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: #596372;
      box-shadow: 0 0 0 3px rgba(89, 99, 114, 0.15);
    }

    .dot.ok { background: var(--ok); box-shadow: 0 0 0 3px rgba(76, 127, 104, 0.14); }
    .dot.warn { background: var(--warn); box-shadow: 0 0 0 3px rgba(148, 118, 75, 0.16); }
    .dot.bad { background: var(--bad); box-shadow: 0 0 0 3px rgba(155, 93, 93, 0.16); }

    .grid {
      display: grid;
      gap: 16px;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }

    .card {
      padding: 16px;
      min-height: 126px;
    }

    .card h2, .panel h2 {
      margin: 0 0 10px;
      font-size: 14px;
      letter-spacing: 0.02em;
      color: #f0f2f6;
    }

    .metric {
      display: grid;
      gap: 4px;
      margin-top: 8px;
    }

    .metric .value {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .metric .label, .small-muted {
      color: var(--muted);
      font-size: 12px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      color: var(--muted);
      background: rgba(255,255,255,0.02);
    }

    .badge.ok { color: #b8d9c5; border-color: rgba(76, 127, 104, 0.4); background: rgba(76, 127, 104, 0.12); }
    .badge.warn { color: #ebd0a6; border-color: rgba(148, 118, 75, 0.38); background: rgba(148, 118, 75, 0.12); }
    .badge.bad { color: #f0baba; border-color: rgba(155, 93, 93, 0.4); background: rgba(155, 93, 93, 0.12); }

    .main {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 16px;
      align-items: start;
    }

    .panel {
      padding: 16px;
    }

    .stack {
      display: grid;
      gap: 12px;
    }

    .kvlist {
      display: grid;
      gap: 10px;
    }

    .kv {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.02);
    }

    .kv .key {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .kv .value {
      overflow-wrap: anywhere;
      color: #e9edf2;
    }

    .list {
      display: grid;
      gap: 10px;
    }

    .item {
      display: grid;
      gap: 6px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.02);
    }

    .item-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .item-title {
      font-weight: 650;
    }

    .item-meta {
      color: var(--muted);
      font-size: 12px;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chip {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 12px;
      color: #c8d0da;
      background: rgba(255, 255, 255, 0.02);
    }

    .search-layout {
      display: grid;
      gap: 16px;
      grid-template-columns: 1fr;
    }

    .search-bar {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 10px;
    }

    .doc-viewer {
      display: grid;
      gap: 10px;
      min-height: 240px;
    }

    .doc-body {
      border: 1px solid var(--border);
      border-radius: 14px;
      background: #161a1f;
      padding: 14px;
      overflow: auto;
      max-height: 520px;
    }

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font: 13px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #d8dde5;
    }

    .footer-note {
      color: var(--muted-2);
      font-size: 12px;
    }

    .muted-box {
      padding: 12px;
      border: 1px dashed var(--border);
      border-radius: 14px;
      color: var(--muted);
      background: rgba(255,255,255,0.01);
    }

    @media (max-width: 1200px) {
      .cards, .main { grid-template-columns: 1fr; }
      .controls, .search-bar { grid-template-columns: 1fr; }
      .kv { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <div>
          <div class="eyebrow">Cloudflare Worker console</div>
          <h1>MCP Knowledge Console</h1>
          <div class="subtitle">Inspect the exact Cloudflare KV index, GitHub manifest state, search results, and document bodies served by this worker.</div>
        </div>
        <div class="token-state" id="tokenState"><span class="dot warn" id="tokenDot"></span><span id="tokenStateText">Token not loaded</span></div>
      </div>

      <div class="controls">
        <div class="field">
          <label for="profileSelect">Profile</label>
          <select id="profileSelect" disabled></select>
        </div>
        <div class="field">
          <label for="tokenInput">Bearer token</label>
          <input id="tokenInput" type="password" placeholder="Paste AUTH_TOKEN or OAuth token" autocomplete="off" spellcheck="false" />
        </div>
        <button id="saveTokenBtn">Save token</button>
        <button class="ghost" id="clearTokenBtn">Clear</button>
        <button id="refreshBtn">Refresh</button>
      </div>

      <div class="statusline">
        <div id="profileSummary">Loading profiles…</div>
        <div class="footer-note">API calls are token-gated; the console shell itself loads without auth.</div>
      </div>
    </header>

    <section class="cards">
      <article class="card">
        <h2>Cloudflare index</h2>
        <div class="metric"><div class="value" id="indexVersion">—</div><div class="label" id="indexBuiltAt">Built at —</div></div>
        <div class="small-muted" id="indexCount">No data loaded</div>
      </article>
      <article class="card">
        <h2>GitHub manifest</h2>
        <div class="metric"><div class="value" id="manifestVersion">—</div><div class="label" id="manifestSource">Source —</div></div>
        <div class="small-muted" id="manifestCount">No data loaded</div>
      </article>
      <article class="card">
        <h2>Freshness</h2>
        <div class="metric"><div class="value" id="freshnessState">—</div><div class="label" id="freshnessReason">Waiting for status</div></div>
      </article>
      <article class="card">
        <h2>Compare</h2>
        <div class="metric"><div class="value" id="compareState">—</div><div class="label" id="compareSummary">Waiting for comparison</div></div>
      </article>
    </section>

    <section class="main">
      <div class="panel stack">
        <div>
          <h2>Source state</h2>
          <div class="kvlist" id="statusDetails"></div>
        </div>

        <div>
          <h2>Document inventory</h2>
          <div class="list" id="recentDocs"></div>
        </div>

        <div>
          <h2>Comparison details</h2>
          <div class="list" id="compareDetails"></div>
        </div>
      </div>

      <div class="panel search-layout">
        <div>
          <h2>Search</h2>
          <div class="search-bar">
            <input id="searchInput" placeholder="Search the current Cloudflare index" />
            <button id="searchBtn">Search</button>
            <button class="ghost" id="reindexBtn">Reindex</button>
          </div>
        </div>

        <div>
          <h2>Search results</h2>
          <div class="list" id="searchResults"></div>
        </div>

        <div class="doc-viewer">
          <h2>Document viewer</h2>
          <div class="muted-box" id="docMeta">Choose a search result or recent document to inspect the exact content returned by `get_document`.</div>
          <div class="doc-body"><pre id="docBody">No document selected.</pre></div>
        </div>
      </div>
    </section>
  </div>

  <script>
    const TOKEN_KEY = "mcp-console-token";
    const API_BASE = "/api/console";

    const state = {
      profiles: [],
      profile: "",
      token: sessionStorage.getItem(TOKEN_KEY) || "",
      status: null,
      compare: null,
      searchQuery: "",
      searchResults: [],
      document: null,
    };

    const els = {
      tokenStateText: document.getElementById("tokenStateText"),
      tokenDot: document.getElementById("tokenDot"),
      tokenInput: document.getElementById("tokenInput"),
      saveTokenBtn: document.getElementById("saveTokenBtn"),
      clearTokenBtn: document.getElementById("clearTokenBtn"),
      refreshBtn: document.getElementById("refreshBtn"),
      reindexBtn: document.getElementById("reindexBtn"),
      profileSelect: document.getElementById("profileSelect"),
      profileSummary: document.getElementById("profileSummary"),
      indexVersion: document.getElementById("indexVersion"),
      indexBuiltAt: document.getElementById("indexBuiltAt"),
      indexCount: document.getElementById("indexCount"),
      manifestVersion: document.getElementById("manifestVersion"),
      manifestSource: document.getElementById("manifestSource"),
      manifestCount: document.getElementById("manifestCount"),
      freshnessState: document.getElementById("freshnessState"),
      freshnessReason: document.getElementById("freshnessReason"),
      compareState: document.getElementById("compareState"),
      compareSummary: document.getElementById("compareSummary"),
      statusDetails: document.getElementById("statusDetails"),
      recentDocs: document.getElementById("recentDocs"),
      compareDetails: document.getElementById("compareDetails"),
      searchInput: document.getElementById("searchInput"),
      searchBtn: document.getElementById("searchBtn"),
      searchResults: document.getElementById("searchResults"),
      docMeta: document.getElementById("docMeta"),
      docBody: document.getElementById("docBody"),
    };

    function setToken(token) {
      state.token = token.trim();
      if (state.token) {
        sessionStorage.setItem(TOKEN_KEY, state.token);
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
      }
      syncTokenState();
    }

    function syncTokenState() {
      const connected = Boolean(state.token);
      els.tokenInput.value = state.token;
      els.tokenDot.className = connected ? "dot ok" : "dot warn";
      els.tokenStateText.textContent = connected ? "Token loaded" : "Token not loaded";
      els.searchBtn.disabled = !connected;
      els.reindexBtn.disabled = !connected;
      els.refreshBtn.disabled = !connected;
      els.saveTokenBtn.textContent = connected ? "Update token" : "Save token";
    }

    function authHeaders() {
      return state.token ? { Authorization: "Bearer " + state.token } : {};
    }

    async function requestJson(path, options = {}) {
      const headers = Object.assign({ "Content-Type": "application/json" }, authHeaders(), options.headers || {});
      const response = await fetch(path, Object.assign({}, options, { headers }));
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (!response.ok) {
        const message = data && typeof data === "object" ? (data.error_description || data.error || text) : text;
        throw new Error(message || ("HTTP " + response.status));
      }
      return data;
    }

    function badgeClass(state) {
      if (state === "fresh" || state === "in_sync" || state === "ok") return "ok";
      if (state === "stale" || state === "missing") return "warn";
      if (state === "error" || state === "out_of_sync") return "bad";
      return "";
    }

    function renderProfileList() {
      els.profileSelect.innerHTML = state.profiles.map((profile) => {
        const selected = profile.profile === state.profile ? "selected" : "";
        return `<option value="${profile.profile}" ${selected}>${profile.profile}</option>`;
      }).join("");
      els.profileSelect.disabled = state.profiles.length === 0;
      if (!state.profile && state.profiles.length > 0) {
        state.profile = state.profiles[0].profile;
        els.profileSelect.value = state.profile;
      }
      const current = state.profiles.find((entry) => entry.profile === state.profile);
      els.profileSummary.textContent = current
        ? current.manifestUrl
          ? `${current.profile} · ${current.manifestUrl}`
          : `${current.profile} · registry unavailable`
        : "No profile selected";
    }

    function renderStatus(status) {
      state.status = status;
      if (!status) return;

      els.indexVersion.textContent = status.cloudflareIndex.exists ? (status.cloudflareIndex.version || "unknown") : "missing";
      els.indexBuiltAt.textContent = status.cloudflareIndex.exists && status.cloudflareIndex.builtAt ? `Built at ${status.cloudflareIndex.builtAt}` : "Built at —";
      els.indexCount.textContent = status.cloudflareIndex.exists
        ? `${status.cloudflareIndex.documentCount} documents in Cloudflare KV`
        : "No Cloudflare index found";

      els.manifestVersion.textContent = status.githubManifest.reachable ? (status.githubManifest.version || "unknown") : "error";
      els.manifestSource.textContent = status.githubManifest.manifestUrl ? status.githubManifest.manifestUrl : "Source unavailable";
      els.manifestCount.textContent = status.githubManifest.reachable
        ? `${status.githubManifest.documentCount} documents in GitHub manifest`
        : `GitHub manifest unavailable${status.githubManifest.error ? ` · ${status.githubManifest.error}` : ""}`;

      els.freshnessState.textContent = status.freshness.state;
      els.freshnessState.className = "value badge " + badgeClass(status.freshness.state);
      els.freshnessReason.textContent = status.freshness.reason;

      const registry = status.registry;
      els.statusDetails.innerHTML = [
        registry ? {
          key: "Registry manifest URL",
          value: registry.manifestUrl,
        } : {
          key: "Registry",
          value: "Missing",
        },
        registry ? {
          key: "Registry raw base",
          value: registry.rawBase,
        } : {
          key: "Raw base",
          value: "Missing",
        },
        {
          key: "Cloudflare index",
          value: status.cloudflareIndex.exists
            ? `${status.cloudflareIndex.documentCount} docs · version ${status.cloudflareIndex.version || "unknown"}`
            : "Missing",
        },
        {
          key: "GitHub manifest",
          value: status.githubManifest.reachable
            ? `${status.githubManifest.documentCount} docs · version ${status.githubManifest.version || "unknown"}`
            : `Error${status.githubManifest.error ? ` · ${status.githubManifest.error}` : ""}`,
        },
        {
          key: "Freshness",
          value: `${status.freshness.state} · ${status.freshness.reason}`,
        },
      ].map((row) => `<div class="kv"><div class="key">${row.key}</div><div class="value">${escapeHtml(row.value)}</div></div>`).join("");

      els.recentDocs.innerHTML = status.cloudflareIndex.recentDocs.length
        ? status.cloudflareIndex.recentDocs.map((doc) => `
            <div class="item">
              <div class="item-head">
                <div class="item-title">${escapeHtml(doc.title)}</div>
                <button class="ghost" data-doc-id="${escapeHtml(doc.id)}">Open</button>
              </div>
              <div class="item-meta">${escapeHtml(doc.id)} · ${escapeHtml(doc.type)} · ${escapeHtml(doc.path)} · updated ${escapeHtml(doc.updated_at || "unknown")}</div>
              <div class="chips">${doc.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}</div>
            </div>`).join("")
        : `<div class="muted-box">No indexed documents are available for this profile.</div>`;

      els.recentDocs.querySelectorAll("button[data-doc-id]").forEach((button) => {
        button.addEventListener("click", () => openDocument(button.getAttribute("data-doc-id") || ""));
      });
    }

    function renderCompare(compare) {
      state.compare = compare;
      if (!compare) return;

      els.compareState.textContent = compare.summary.state;
      els.compareState.className = "value badge " + badgeClass(compare.summary.state);
      els.compareSummary.textContent = `${compare.summary.added} added · ${compare.summary.removed} removed · ${compare.summary.changed} changed`;

      const rows = [];
      if (compare.error) {
        rows.push(`<div class="muted-box">${escapeHtml(compare.error)}</div>`);
      }

      rows.push(`
        <div class="item">
          <div class="item-head"><div class="item-title">Added documents</div><div class="item-meta">${compare.addedDocs.length}</div></div>
          <div class="list">${compare.addedDocs.length ? compare.addedDocs.map(renderMiniDoc).join("") : `<div class="small-muted">None</div>`}</div>
        </div>
      `);

      rows.push(`
        <div class="item">
          <div class="item-head"><div class="item-title">Removed documents</div><div class="item-meta">${compare.removedDocs.length}</div></div>
          <div class="list">${compare.removedDocs.length ? compare.removedDocs.map(renderMiniDoc).join("") : `<div class="small-muted">None</div>`}</div>
        </div>
      `);

      rows.push(`
        <div class="item">
          <div class="item-head"><div class="item-title">Changed documents</div><div class="item-meta">${compare.changedDocs.length}</div></div>
          <div class="list">${compare.changedDocs.length ? compare.changedDocs.map(renderChangeDoc).join("") : `<div class="small-muted">None</div>`}</div>
        </div>
      `);

      els.compareDetails.innerHTML = rows.join("");
    }

    function renderMiniDoc(doc) {
      return `
        <div class="item">
          <div class="item-head">
            <div class="item-title">${escapeHtml(doc.title)}</div>
            <button class="ghost" data-open-doc="${escapeHtml(doc.id)}">Open</button>
          </div>
          <div class="item-meta">${escapeHtml(doc.id)} · ${escapeHtml(doc.type)} · ${escapeHtml(doc.path)}</div>
          <div class="small-muted">${escapeHtml(doc.summary || "")}</div>
        </div>
      `;
    }

    function renderChangeDoc(doc) {
      const changes = doc.changes.map((change) => `
        <div class="chip">${escapeHtml(change.field)} changed</div>
      `).join("");
      return `
        <div class="item">
          <div class="item-head">
            <div class="item-title">${escapeHtml(doc.title)}</div>
            <button class="ghost" data-open-doc="${escapeHtml(doc.id)}">Open</button>
          </div>
          <div class="item-meta">${escapeHtml(doc.id)} · ${escapeHtml(doc.type)} · ${escapeHtml(doc.path)}</div>
          <div class="chips">${changes}</div>
        </div>
      `;
    }

    function renderSearch(results) {
      state.searchResults = results || [];
      els.searchResults.innerHTML = results && results.length
        ? results.map((result) => `
            <div class="item">
              <div class="item-head">
                <div>
                  <div class="item-title">${escapeHtml(result.title)}</div>
                  <div class="item-meta">${escapeHtml(result.id)} · ${escapeHtml(result.type)} · score ${escapeHtml(String(result.score))} · ${escapeHtml(result.confidence)}</div>
                </div>
                <button class="ghost" data-open-doc="${escapeHtml(result.id)}">Open</button>
              </div>
              <div class="small-muted">${escapeHtml(result.summary || "")}</div>
              <div class="chips">${result.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}</div>
            </div>
          `).join("")
        : `<div class="muted-box">Run a search to inspect the exact indexed data used by MCP.</div>`;

      els.searchResults.querySelectorAll("button[data-open-doc]").forEach((button) => {
        button.addEventListener("click", () => openDocument(button.getAttribute("data-open-doc") || ""));
      });
    }

    function renderDocument(document) {
      state.document = document;
      if (!document) return;
      els.docMeta.innerHTML = `<strong>${escapeHtml(document.metadata.title)}</strong><br>${escapeHtml(document.metadata.id)} · ${escapeHtml(document.metadata.type)} · ${escapeHtml(document.metadata.path)}`;
      els.docBody.textContent = document.body || "";
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    async function loadProfiles() {
      const data = await requestJson(`${API_BASE}/profiles`);
      state.profiles = data.profiles || [];
      renderProfileList();
    }

    async function loadOverview() {
      if (!state.profile) return;
      if (!state.token) {
        els.profileSummary.textContent = "Token required to load profile data";
        els.statusDetails.innerHTML = `<div class="muted-box">Enter a bearer token to load Cloudflare and GitHub state.</div>`;
        return;
      }

      const [status, compare] = await Promise.all([
        requestJson(`${API_BASE}/status?profile=${encodeURIComponent(state.profile)}`),
        requestJson(`${API_BASE}/compare?profile=${encodeURIComponent(state.profile)}`),
      ]);
      renderStatus(status);
      renderCompare(compare);
      els.profileSummary.textContent = `${state.profile} · ${status.cloudflareIndex.documentCount} indexed docs`;
    }

    async function runSearch() {
      if (!state.profile) return;
      const query = els.searchInput.value.trim();
      state.searchQuery = query;
      if (!query) {
        renderSearch([]);
        return;
      }
      const data = await requestJson(`${API_BASE}/search?profile=${encodeURIComponent(state.profile)}&q=${encodeURIComponent(query)}&limit=10`);
      renderSearch(data.results || []);
    }

    async function openDocument(id) {
      if (!id) return;
      const data = await requestJson(`${API_BASE}/document?profile=${encodeURIComponent(state.profile)}&id=${encodeURIComponent(id)}`);
      renderDocument(data);
    }

    async function reindex() {
      const result = await requestJson(`${API_BASE}/reindex`, {
        method: "POST",
        body: JSON.stringify({ profile: state.profile }),
      });
      await loadOverview();
      els.profileSummary.textContent = `Reindexed ${result.profile} · ${result.documentCount} docs`;
    }

    els.saveTokenBtn.addEventListener("click", async () => {
      setToken(els.tokenInput.value);
      try {
        await loadOverview();
      } catch (error) {
        showError(error);
      }
    });

    els.clearTokenBtn.addEventListener("click", () => {
      setToken("");
      els.statusDetails.innerHTML = `<div class="muted-box">Token cleared. Re-enter a bearer token to inspect live data.</div>`;
      els.compareDetails.innerHTML = `<div class="muted-box">Comparison data is hidden until a token is provided.</div>`;
      renderSearch([]);
    });

    els.refreshBtn.addEventListener("click", async () => {
      try {
        await loadOverview();
      } catch (error) {
        showError(error);
      }
    });

    els.reindexBtn.addEventListener("click", async () => {
      try {
        await reindex();
      } catch (error) {
        showError(error);
      }
    });

    els.searchBtn.addEventListener("click", async () => {
      try {
        await runSearch();
      } catch (error) {
        showError(error);
      }
    });

    els.searchInput.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        try {
          await runSearch();
        } catch (error) {
          showError(error);
        }
      }
    });

    els.profileSelect.addEventListener("change", async () => {
      state.profile = els.profileSelect.value;
      els.profileSummary.textContent = state.profile;
      try {
        await loadOverview();
        if (state.searchQuery) {
          await runSearch();
        }
      } catch (error) {
        showError(error);
      }
    });

    function showError(error) {
      const message = error instanceof Error ? error.message : String(error);
      els.profileSummary.textContent = message;
      els.freshnessReason.textContent = message;
      els.tokenDot.className = "dot bad";
      els.tokenStateText.textContent = "Request failed";
    }

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const docId = target.getAttribute("data-open-doc");
      if (!docId) return;
      openDocument(docId).catch(showError);
    });

    async function init() {
      syncTokenState();
      els.tokenInput.value = state.token;
      try {
        await loadProfiles();
        if (state.token && state.profile) {
          await loadOverview();
        } else {
          els.statusDetails.innerHTML = `<div class="muted-box">Load a bearer token to inspect Cloudflare KV, GitHub manifest state, and compare output.</div>`;
          els.compareDetails.innerHTML = `<div class="muted-box">Comparison data will appear here after a token is saved.</div>`;
        }
      } catch (error) {
        showError(error);
      }
    }

    init();
  </script>
</body>
</html>`;
}

function parseProfile(value: string | null): Profile {
  if (!value || !PROFILES.includes(value as Profile)) {
    throw new Error(`Invalid profile. Expected one of: ${PROFILES.join(", ")}`);
  }
  return value as Profile;
}

export function handleConsolePage(): Response {
  return new Response(htmlPage(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function handleConsoleProfiles(env: Env): Promise<Response> {
  try {
    const profiles = await getConsoleProfiles(env);
    return json({ profiles });
  } catch (error) {
    return json(
      {
        error: "failed_to_load_profiles",
        error_description: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

export async function handleConsoleStatus(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const profile = parseProfile(url.searchParams.get("profile"));
    const status = await getConsoleStatus(env, profile);
    return json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: "failed_to_load_status", error_description: message }, 400);
  }
}

export async function handleConsoleCompare(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const profile = parseProfile(url.searchParams.get("profile"));
    const compare = await compareProfile(env, profile);
    return json(compare);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: "failed_to_compare", error_description: message }, 400);
  }
}

export async function handleConsoleSearch(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const profile = parseProfile(url.searchParams.get("profile"));
    const query = url.searchParams.get("q")?.trim() || "";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "10") || 10, 1), 20);
    if (!query) {
      return json({ profile, query, total: 0, results: [], state: "empty" });
    }

    const { index, results } = await getSearchResults(env, profile, query, limit);
    if (!index) {
      return json({
        profile,
        query,
        total: 0,
        results: [],
        state: "missing",
        message: `No search index found for profile \"${profile}\"`,
      });
    }

    return json({
      profile,
      query,
      total: results.length,
      results,
      state: "ok",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: "failed_to_search", error_description: message }, 400);
  }
}

export async function handleConsoleDocument(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const profile = parseProfile(url.searchParams.get("profile"));
    const id = url.searchParams.get("id")?.trim();
    if (!id) {
      return json({ error: "invalid_request", error_description: "id is required" }, 400);
    }

    const document = await getDocument(env, profile, id);
    return json(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not found") ? 404 : 400;
    return json({ error: "failed_to_load_document", error_description: message }, status);
  }
}

export async function handleConsoleReindex(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json().catch(() => null)) as { profile?: string } | null;
    const profile = parseProfile(body?.profile ?? null);
    const index = await reindexProfile(env, profile);
    return json({
      ok: true,
      profile,
      version: index.version,
      builtAt: index.builtAt,
      documentCount: index.documents.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: "failed_to_reindex", error_description: message }, 400);
  }
}
