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
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%226%22 fill=%22%232563eb%22/><text x=%2216%22 y=%2222%22 font-size=%2218%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22sans-serif%22 font-weight=%22bold%22>K</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <title>MCP Knowledge Console</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:       #f1f5f9;
      --surface:  #ffffff;
      --border:   #e2e8f0;
      --border-2: #cbd5e1;
      --text:     #0f172a;
      --muted:    #64748b;
      --muted-2:  #94a3b8;
      --accent:   #2563eb;
      --accent-h: #1d4ed8;
      --ok:       #059669;
      --ok-bg:    #d1fae5;
      --warn:     #b45309;
      --warn-bg:  #fef3c7;
      --bad:      #dc2626;
      --bad-bg:   #fee2e2;
      --radius:   8px;
      --radius-lg:12px;
      --shadow:   0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06);
    }

    html, body { height: 100%; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      background: var(--bg);
      color: var(--text);
    }

    .shell {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      display: grid;
      gap: 16px;
    }

    /* ── topbar ── */
    .topbar {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 16px 20px;
      display: grid;
      gap: 14px;
    }
    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .brand-title { font-size: 17px; font-weight: 700; color: var(--text); }
    .brand-sub   { font-size: 12px; color: var(--muted); margin-top: 2px; }

    .token-pill {
      display: flex;
      align-items: center;
      gap: 7px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 5px 12px;
      font-size: 12px;
      color: var(--muted);
      font-weight: 500;
    }
    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--muted-2);
      flex-shrink: 0;
    }
    .dot.ok   { background: var(--ok); }
    .dot.warn { background: var(--warn); }
    .dot.bad  { background: var(--bad); }

    .controls-row {
      display: grid;
      grid-template-columns: minmax(160px,200px) 1fr auto auto auto;
      gap: 8px;
      align-items: end;
    }
    .field { display: grid; gap: 4px; }
    .field label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }

    input, select {
      width: 100%;
      border: 1px solid var(--border);
      background: var(--bg);
      border-radius: var(--radius);
      padding: 8px 10px;
      font-size: 13px;
      font-family: inherit;
      color: var(--text);
      outline: none;
      transition: border-color .15s;
    }
    input:focus, select:focus { border-color: var(--accent); background: #fff; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }

    button {
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      border: 1px solid var(--border-2);
      background: var(--surface);
      border-radius: var(--radius);
      padding: 8px 14px;
      cursor: pointer;
      color: var(--text);
      white-space: nowrap;
      transition: background .12s, border-color .12s, transform .1s;
    }
    button:hover:not(:disabled) { background: var(--bg); border-color: var(--muted-2); }
    button:active:not(:disabled) { transform: translateY(1px); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    .btn-primary:hover:not(:disabled) { background: var(--accent-h); border-color: var(--accent-h); }
    .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--muted); }
    .btn-ghost:hover:not(:disabled) { background: var(--bg); border-color: var(--border-2); color: var(--text); }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--muted);
    }

    /* ── stat cards ── */
    .cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 16px;
    }
    .card-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); margin-bottom: 8px; }
    .card-value { font-size: 26px; font-weight: 700; letter-spacing: -.03em; color: var(--text); line-height: 1; }
    .card-sub   { font-size: 12px; color: var(--muted); margin-top: 5px; }

    /* ── main two-col ── */
    .main { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 14px; align-items: start; }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 18px;
    }
    .panel-title { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
    .stack { display: grid; gap: 18px; }

    /* ── kv rows ── */
    .kvlist { display: grid; gap: 1px; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .kv {
      display: grid;
      grid-template-columns: 170px 1fr;
      gap: 12px;
      padding: 9px 12px;
      background: var(--surface);
      font-size: 13px;
    }
    .kv:nth-child(even) { background: var(--bg); }
    .kv .k { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); align-self: center; }
    .kv .v { color: var(--text); overflow-wrap: anywhere; }

    /* ── list items ── */
    .item-list { display: grid; gap: 8px; }
    .item {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 12px;
      display: grid;
      gap: 5px;
      background: var(--surface);
    }
    .item-row  { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .item-name { font-size: 13px; font-weight: 600; }
    .item-meta { font-size: 11px; color: var(--muted); }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px; }
    .chip {
      font-size: 11px;
      padding: 2px 8px;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--muted);
      background: var(--bg);
    }

    /* ── badge ── */
    .badge {
      display: inline-flex; align-items: center;
      font-size: 12px; font-weight: 600;
      padding: 3px 9px; border-radius: 999px;
    }
    .badge.ok   { background: var(--ok-bg);   color: var(--ok);   }
    .badge.warn { background: var(--warn-bg);  color: var(--warn); }
    .badge.bad  { background: var(--bad-bg);   color: var(--bad);  }

    /* ── muted box ── */
    .muted-box {
      font-size: 13px;
      color: var(--muted);
      padding: 12px;
      background: var(--bg);
      border: 1px dashed var(--border-2);
      border-radius: var(--radius);
    }

    /* ── search ── */
    .search-bar { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; }
    .doc-viewer { display: grid; gap: 10px; }
    .doc-body {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: #0f172a;
      padding: 14px;
      max-height: 480px;
      overflow: auto;
    }
    pre {
      font: 12.5px/1.65 ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
      color: #e2e8f0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    @media (max-width: 1100px) {
      .cards { grid-template-columns: repeat(2, 1fr); }
      .main  { grid-template-columns: 1fr; }
      .controls-row { grid-template-columns: 1fr; }
      .search-bar { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .cards { grid-template-columns: 1fr; }
      .kv { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
<div class="shell">

  <!-- topbar -->
  <header class="topbar">
    <div class="brand-row">
      <div>
        <div class="brand-title">MCP Knowledge Console</div>
        <div class="brand-sub">Inspect Cloudflare KV index, GitHub manifest state, search results, and document bodies served by this worker.</div>
      </div>
      <div class="token-pill">
        <span class="dot warn" id="tokenDot"></span>
        <span id="tokenStateText">Token not loaded</span>
      </div>
    </div>

    <div class="controls-row">
      <div class="field">
        <label for="profileSelect">Profile</label>
        <select id="profileSelect" disabled></select>
      </div>
      <div class="field">
        <label for="tokenInput">Bearer token</label>
        <input id="tokenInput" type="password" placeholder="Paste AUTH_TOKEN or OAuth token" autocomplete="off" spellcheck="false" />
      </div>
      <button class="btn-primary" id="saveTokenBtn">Save token</button>
      <button class="btn-ghost" id="clearTokenBtn">Clear</button>
      <button id="refreshBtn">Refresh</button>
    </div>

    <div class="status-row">
      <div id="profileSummary">Loading profiles…</div>
      <div>API calls are token-gated; the console shell itself loads without auth.</div>
    </div>
  </header>

  <!-- stat cards -->
  <section class="cards">
    <div class="card">
      <div class="card-label">Cloudflare index</div>
      <div class="card-value" id="indexVersion">—</div>
      <div class="card-sub" id="indexBuiltAt">Built at —</div>
      <div class="card-sub" id="indexCount">No data loaded</div>
    </div>
    <div class="card">
      <div class="card-label">GitHub manifest</div>
      <div class="card-value" id="manifestVersion">—</div>
      <div class="card-sub" id="manifestSource">Source —</div>
      <div class="card-sub" id="manifestCount">No data loaded</div>
    </div>
    <div class="card">
      <div class="card-label">Freshness</div>
      <div class="card-value" id="freshnessState">—</div>
      <div class="card-sub" id="freshnessReason">Waiting for status</div>
    </div>
    <div class="card">
      <div class="card-label">Compare</div>
      <div class="card-value" id="compareState">—</div>
      <div class="card-sub" id="compareSummary">Waiting for comparison</div>
    </div>
  </section>

  <!-- Source State as a separate full-length card above the columns -->
  <section class="panel" style="margin-bottom: 16px;">
    <div class="panel-title">Source state</div>
    <div id="statusDetails"></div>
  </section>

  <!-- main -->
  <section class="main">

    <!-- left: inventory + compare -->
    <div class="panel stack">
      <div>
        <div class="panel-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <span>Document inventory</span>
          <span class="item-meta" id="inventoryCountHeader"></span>
        </div>
        <div id="inventoryPagination" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px;"></div>
        <div class="item-list" id="recentDocs"></div>
      </div>
      <div>
        <div class="panel-title">Comparison details</div>
        <div class="item-list" id="compareDetails"></div>
      </div>
    </div>

    <!-- right: search + document viewer -->
    <div class="panel stack">
      <div>
        <div class="panel-title">Search</div>
        <div class="search-bar">
          <input id="searchInput" placeholder="Search the current Cloudflare index" />
          <button id="searchBtn">Search</button>
          <button class="btn-ghost" id="reindexBtn">Reindex</button>
        </div>
      </div>
      <div>
        <div class="panel-title">Search results</div>
        <div class="item-list" id="searchResults"></div>
      </div>
      <div class="doc-viewer">
        <div class="panel-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span>Document viewer</span>
          <button id="copyDocBtn" class="btn-ghost" style="font-size: 11px; padding: 4px 8px; display: none;">Copy Content</button>
        </div>
        <div class="muted-box" id="docMeta">Choose a search result or recent document to inspect the exact content returned by get_document.</div>
        <div class="doc-body"><pre id="docBody">No document selected.</pre></div>
      </div>
    </div>

  </section>

</div>

<script>
  const TOKEN_KEY   = "mcp-console-token";
  const PROFILE_KEY = "mcp-console-profile";
  const SEARCH_KEY  = "mcp-console-search";
  const API_BASE    = "/api/console";

  const state = {
    profiles:      [],
    profile:       localStorage.getItem(PROFILE_KEY) || "",
    token:         localStorage.getItem(TOKEN_KEY)   || "",
    status:        null,
    compare:       null,
    searchQuery:   localStorage.getItem(SEARCH_KEY)  || "",
    searchResults: [],
    document:      null,
    inventoryPage: 0,
  };

  const els = {
    tokenStateText: document.getElementById("tokenStateText"),
    tokenDot:       document.getElementById("tokenDot"),
    tokenInput:     document.getElementById("tokenInput"),
    saveTokenBtn:   document.getElementById("saveTokenBtn"),
    clearTokenBtn:  document.getElementById("clearTokenBtn"),
    refreshBtn:     document.getElementById("refreshBtn"),
    reindexBtn:     document.getElementById("reindexBtn"),
    profileSelect:  document.getElementById("profileSelect"),
    profileSummary: document.getElementById("profileSummary"),
    indexVersion:   document.getElementById("indexVersion"),
    indexBuiltAt:   document.getElementById("indexBuiltAt"),
    indexCount:     document.getElementById("indexCount"),
    manifestVersion:document.getElementById("manifestVersion"),
    manifestSource: document.getElementById("manifestSource"),
    manifestCount:  document.getElementById("manifestCount"),
    freshnessState: document.getElementById("freshnessState"),
    freshnessReason:document.getElementById("freshnessReason"),
    compareState:   document.getElementById("compareState"),
    compareSummary: document.getElementById("compareSummary"),
    statusDetails:  document.getElementById("statusDetails"),
    recentDocs:     document.getElementById("recentDocs"),
    compareDetails: document.getElementById("compareDetails"),
    searchInput:    document.getElementById("searchInput"),
    searchBtn:      document.getElementById("searchBtn"),
    searchResults:  document.getElementById("searchResults"),
    docMeta:        document.getElementById("docMeta"),
    docBody:        document.getElementById("docBody"),
  };

  function esc(v) {
    return String(v)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function badgeClass(n) {
    if (n==="fresh"||n==="in_sync"||n==="ok") return "ok";
    if (n==="stale"||n==="missing") return "warn";
    if (n==="error"||n==="out_of_sync") return "bad";
    return "";
  }

  function setToken(token) {
    state.token = token.trim();
    state.token ? localStorage.setItem(TOKEN_KEY, state.token) : localStorage.removeItem(TOKEN_KEY);
    syncTokenState();
  }

  function syncTokenState() {
    var ok = Boolean(state.token);
    els.tokenInput.value   = state.token;
    els.tokenDot.className = ok ? "dot ok" : "dot warn";
    els.tokenStateText.textContent = ok ? "Token loaded" : "Token not loaded";
    els.searchBtn.disabled  = !ok;
    els.reindexBtn.disabled = !ok;
    els.refreshBtn.disabled = !ok;
    els.saveTokenBtn.textContent = ok ? "Update token" : "Save token";
  }

  function authHeaders() {
    return state.token ? { Authorization: "Bearer " + state.token } : {};
  }

  async function requestJson(path, options) {
    var opts = options || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, authHeaders(), opts.headers || {});
    var response = await fetch(path, Object.assign({}, opts, { headers }));
    var text = await response.text();
    var data = null;
    if (text) { try { data = JSON.parse(text); } catch(e) { data = text; } }
    if (!response.ok) {
      var msg = data && typeof data==="object" ? (data.error_description||data.error||text) : text;
      throw new Error(msg || ("HTTP " + response.status));
    }
    return data;
  }

  function kvRow(key, value) {
    return '<div class="kv"><div class="k">'+esc(key)+'</div><div class="v">'+esc(value)+'</div></div>';
  }

  function formatVersion(v) {
    if (!v) return "—";
    if (v.includes("T") && v.endsWith("Z")) {
      try {
        var d = new Date(v);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ", " + 
                 d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
        }
      } catch(e) {}
    }
    return v;
  }

  function renderProfileList() {
    var html = "";
    for (var i=0; i<state.profiles.length; i++) {
      var p = state.profiles[i];
      var sel = p.profile===state.profile ? " selected" : "";
      html += '<option value="'+esc(p.profile)+'"'+sel+'>'+esc(p.profile)+'</option>';
    }
    els.profileSelect.innerHTML = html;
    els.profileSelect.disabled = state.profiles.length===0;
    if (!state.profile && state.profiles.length>0) {
      state.profile = state.profiles[0].profile;
      els.profileSelect.value = state.profile;
    } else if (state.profile) {
      els.profileSelect.value = state.profile;
    }
    if (state.profile) localStorage.setItem(PROFILE_KEY, state.profile);
    var cur = state.profiles.find(function(e){ return e.profile===state.profile; });
    els.profileSummary.textContent = cur
      ? (cur.manifestUrl ? cur.profile+" · "+cur.manifestUrl : cur.profile+" · registry unavailable")
      : "No profile selected";
  }

  function renderStatus(status) {
    state.status = status;
    if (!status) return;

    var indexVerStr = formatVersion(status.cloudflareIndex.version);
    var manifestVerStr = formatVersion(status.githubManifest.version);

    els.indexVersion.textContent = status.cloudflareIndex.exists ? indexVerStr : "missing";
    els.indexBuiltAt.textContent = status.cloudflareIndex.exists && status.cloudflareIndex.builtAt
      ? "Built at "+formatVersion(status.cloudflareIndex.builtAt) : "Built at —";
    els.indexCount.textContent = status.cloudflareIndex.exists
      ? status.cloudflareIndex.documentCount+" documents in Cloudflare KV" : "No Cloudflare index found";

    els.manifestVersion.textContent = status.githubManifest.reachable ? manifestVerStr : "error";
    els.manifestSource.textContent  = status.githubManifest.manifestUrl || "Source unavailable";
    els.manifestCount.textContent   = status.githubManifest.reachable
      ? status.githubManifest.documentCount+" documents in GitHub manifest"
      : "GitHub manifest unavailable"+(status.githubManifest.error ? " · "+status.githubManifest.error : "");

    els.freshnessState.textContent  = status.freshness.state;
    els.freshnessState.className    = "card-value badge "+badgeClass(status.freshness.state);
    els.freshnessReason.textContent = status.freshness.reason;

    var rows = [];
    rows.push(kvRow("Registry manifest URL", status.registry ? status.registry.manifestUrl : "Missing"));
    rows.push(kvRow("Registry raw base",     status.registry ? status.registry.rawBase     : "Missing"));
    rows.push(kvRow("Cloudflare index", status.cloudflareIndex.exists
      ? status.cloudflareIndex.documentCount+" docs · version "+indexVerStr : "Missing"));
    rows.push(kvRow("GitHub manifest", status.githubManifest.reachable
      ? status.githubManifest.documentCount+" docs · version "+manifestVerStr
      : "Error"+(status.githubManifest.error ? " · "+status.githubManifest.error : "")));
    rows.push(kvRow("Freshness", status.freshness.state+" · "+status.freshness.reason));
    els.statusDetails.innerHTML = '<div class="kvlist">'+rows.join("")+'</div>';

    var docs = status.cloudflareIndex.recentDocs || [];
    var totalDocs = docs.length;
    var pageSize = 5;
    var totalPages = Math.ceil(totalDocs / pageSize) || 1;

    if (state.inventoryPage >= totalPages) state.inventoryPage = totalPages - 1;
    if (state.inventoryPage < 0) state.inventoryPage = 0;

    var page = state.inventoryPage;
    var start = page * pageSize;
    var end = Math.min(start + pageSize, totalDocs);

    var countHeader = document.getElementById("inventoryCountHeader");
    if (countHeader) countHeader.textContent = totalDocs + " total files";

    if (totalDocs > 0) {
      var h = "";
      for (var i = start; i < end; i++) {
        var doc = docs[i];
        h += '<div class="item">';
        h += '<div class="item-row"><span class="item-name">'+esc(doc.title)+'</span>';
        h += '<button class="btn-ghost" style="font-size:12px;padding:4px 10px" data-open-doc="'+esc(doc.id)+'">Open</button></div>';
        h += '<div class="item-meta">'+esc(doc.id)+' · '+esc(doc.type)+' · '+esc(doc.path)+' · updated '+esc(doc.updated_at||"unknown")+'</div>';
        h += '<div class="chips">';
        for (var j=0; j<doc.tags.length; j++) h += '<span class="chip">'+esc(doc.tags[j])+'</span>';
        h += '</div></div>';
      }
      els.recentDocs.innerHTML = h;

      var pagHtml = "";
      pagHtml += '<button id="prevInvBtn" class="btn-ghost" style="padding:4px 8px;font-size:12px;"' + (page === 0 ? ' disabled' : '') + '>Previous</button>';
      pagHtml += '<span class="item-meta">Page ' + (page + 1) + ' of ' + totalPages + '</span>';
      pagHtml += '<button id="nextInvBtn" class="btn-ghost" style="padding:4px 8px;font-size:12px;"' + (page >= totalPages - 1 ? ' disabled' : '') + '>Next</button>';
      document.getElementById("inventoryPagination").innerHTML = pagHtml;
    } else {
      els.recentDocs.innerHTML = '<div class="muted-box">No indexed documents available for this profile.</div>';
      document.getElementById("inventoryPagination").innerHTML = '';
    }
  }

  function renderCompare(compare) {
    state.compare = compare;
    if (!compare) return;

    els.compareState.textContent  = compare.summary.state;
    els.compareState.className    = "card-value badge "+badgeClass(compare.summary.state);
    els.compareSummary.textContent = compare.summary.added+" added · "+compare.summary.removed+" removed · "+compare.summary.changed+" changed";

    var parts = [];
    if (compare.error) parts.push('<div class="muted-box">'+esc(compare.error)+'</div>');
    parts.push(renderDocSection("Added documents",   compare.addedDocs,   false));
    parts.push(renderDocSection("Removed documents", compare.removedDocs, false));
    parts.push(renderChangedSection(compare.changedDocs));
    els.compareDetails.innerHTML = parts.join("");
  }

  function renderDocSection(title, docs) {
    var h = '<div class="item"><div class="item-row"><span class="item-name">'+esc(title)+'</span><span class="item-meta">'+docs.length+'</span></div>';
    if (docs.length===0) { h += '<div class="item-meta">None</div>'; }
    else { h += '<div class="item-list" style="margin-top:6px">'; for(var i=0;i<docs.length;i++) h+=renderMiniDoc(docs[i]); h+='</div>'; }
    return h+'</div>';
  }

  function renderChangedSection(docs) {
    var h = '<div class="item"><div class="item-row"><span class="item-name">Changed documents</span><span class="item-meta">'+docs.length+'</span></div>';
    if (docs.length===0) { h += '<div class="item-meta">None</div>'; }
    else { h += '<div class="item-list" style="margin-top:6px">'; for(var i=0;i<docs.length;i++) h+=renderChangeDoc(docs[i]); h+='</div>'; }
    return h+'</div>';
  }

  function renderMiniDoc(doc) {
    return '<div class="item"><div class="item-row"><span class="item-name">'+esc(doc.title)+'</span>'
      +'<button class="btn-ghost" style="font-size:12px;padding:4px 10px" data-open-doc="'+esc(doc.id)+'">Open</button></div>'
      +'<div class="item-meta">'+esc(doc.id)+' · '+esc(doc.type)+' · '+esc(doc.path)+'</div>'
      +'<div class="item-meta">'+esc(doc.summary||"")+'</div></div>';
  }

  function renderChangeDoc(doc) {
    var chips = "";
    for (var i=0; i<doc.changes.length; i++) chips+='<span class="chip">'+esc(doc.changes[i].field)+' changed</span>';
    return '<div class="item"><div class="item-row"><span class="item-name">'+esc(doc.title)+'</span>'
      +'<button class="btn-ghost" style="font-size:12px;padding:4px 10px" data-open-doc="'+esc(doc.id)+'">Open</button></div>'
      +'<div class="item-meta">'+esc(doc.id)+' · '+esc(doc.type)+' · '+esc(doc.path)+'</div>'
      +'<div class="chips">'+chips+'</div></div>';
  }

  function renderSearch(results) {
    state.searchResults = results||[];
    if (!results||results.length===0) {
      els.searchResults.innerHTML='<div class="muted-box">Run a search to inspect the indexed data used by MCP.</div>';
      return;
    }
    var h = "";
    for (var i=0; i<results.length; i++) {
      var r = results[i];
      h += '<div class="item">';
      h += '<div class="item-row"><div><div class="item-name">'+esc(r.title)+'</div>';
      h += '<div class="item-meta">'+esc(r.id)+' · '+esc(r.type)+' · score '+esc(String(r.score))+' · '+esc(r.confidence)+'</div></div>';
      h += '<button class="btn-ghost" style="font-size:12px;padding:4px 10px" data-open-doc="'+esc(r.id)+'">Open</button></div>';
      h += '<div class="item-meta">'+esc(r.summary||"")+'</div><div class="chips">';
      for (var j=0; j<r.tags.length; j++) h+='<span class="chip">'+esc(r.tags[j])+'</span>';
      h += '</div></div>';
    }
    els.searchResults.innerHTML = h;
  }

  function renderDocument(doc) {
    state.document = doc;
    var copyBtn = document.getElementById("copyDocBtn");
    if (!doc) {
      if (copyBtn) copyBtn.style.display = "none";
      return;
    }
    if (copyBtn) copyBtn.style.display = "inline-block";
    els.docMeta.innerHTML = '<strong>'+esc(doc.metadata.title)+'</strong><br>'
      +esc(doc.metadata.id)+' · '+esc(doc.metadata.type)+' · '+esc(doc.metadata.path);
    els.docBody.textContent = doc.body||"";
  }

  async function loadProfiles() {
    var data = await requestJson(API_BASE+"/profiles");
    state.profiles = data.profiles||[];
    renderProfileList();
  }

  async function loadOverview() {
    if (!state.profile) return;
    if (!state.token) {
      els.profileSummary.textContent = "Token required to load profile data";
      els.statusDetails.innerHTML = '<div class="muted-box">Enter a bearer token to load Cloudflare and GitHub state.</div>';
      return;
    }
    els.profileSummary.textContent = "Loading overview data...";
    var results = await Promise.all([
      requestJson(API_BASE+"/status?profile="+encodeURIComponent(state.profile)),
      requestJson(API_BASE+"/compare?profile="+encodeURIComponent(state.profile)),
    ]);
    renderStatus(results[0]);
    renderCompare(results[1]);
    els.profileSummary.textContent = state.profile+" · "+results[0].cloudflareIndex.documentCount+" indexed docs";
  }

  async function runSearch() {
    if (!state.profile) return;
    var query = els.searchInput.value.trim();
    state.searchQuery = query;
    query ? localStorage.setItem(SEARCH_KEY, query) : localStorage.removeItem(SEARCH_KEY);
    if (!query) { renderSearch([]); return; }

    els.searchResults.innerHTML = '<div class="muted-box"><span style="display:inline-block;animation:spin 1s linear infinite;margin-right:8px;">⏳</span>Searching index...</div>';
    els.searchBtn.disabled = true;

    try {
      var data = await requestJson(API_BASE+"/search?profile="+encodeURIComponent(state.profile)+"&q="+encodeURIComponent(query)+"&limit=10");
      renderSearch(data.results||[]);
    } catch (e) {
      showError(e);
    } finally {
      els.searchBtn.disabled = false;
    }
  }

  async function openDocument(id) {
    if (!id) return;
    els.docBody.textContent = "Loading document...";
    try {
      var data = await requestJson(API_BASE+"/document?profile="+encodeURIComponent(state.profile)+"&id="+encodeURIComponent(id));
      renderDocument(data);
    } catch(e) {
      els.docBody.textContent = "Failed to load: " + e.message;
      showError(e);
    }
  }

  async function reindex() {
    els.profileSummary.textContent = "Reindexing profile. Please wait...";
    var btn = document.getElementById("reindexBtn");
    if (btn) btn.disabled = true;
    try {
      var result = await requestJson(API_BASE+"/reindex", { method:"POST", body:JSON.stringify({profile:state.profile}) });
      await loadOverview();
      els.profileSummary.textContent = "Reindexed "+result.profile+" · "+result.documentCount+" docs";
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function showError(err) {
    var msg = err instanceof Error ? err.message : String(err);
    els.profileSummary.textContent = msg;
    els.freshnessReason.textContent = msg;
    els.tokenDot.className = "dot bad";
    els.tokenStateText.textContent = "Request failed";
  }

  els.saveTokenBtn.addEventListener("click", async function() {
    setToken(els.tokenInput.value);
    try { await loadOverview(); } catch(e) { showError(e); }
  });

  els.clearTokenBtn.addEventListener("click", function() {
    setToken("");
    localStorage.removeItem(SEARCH_KEY);
    els.statusDetails.innerHTML = '<div class="muted-box">Token cleared. Re-enter a bearer token to inspect live data.</div>';
    els.compareDetails.innerHTML = '<div class="muted-box">Comparison data is hidden until a token is provided.</div>';
    renderSearch([]);
  });

  els.refreshBtn.addEventListener("click", async function() {
    try { await loadOverview(); } catch(e) { showError(e); }
  });

  els.reindexBtn.addEventListener("click", async function() {
    try { await reindex(); } catch(e) { showError(e); }
  });

  els.searchBtn.addEventListener("click", async function() {
    try { await runSearch(); } catch(e) { showError(e); }
  });

  els.searchInput.addEventListener("keydown", async function(ev) {
    if (ev.key==="Enter") { ev.preventDefault(); try { await runSearch(); } catch(e) { showError(e); } }
  });

  els.profileSelect.addEventListener("change", async function() {
    state.profile = els.profileSelect.value;
    state.inventoryPage = 0;
    localStorage.setItem(PROFILE_KEY, state.profile);
    els.profileSummary.textContent = state.profile;
    try {
      await loadOverview();
      if (state.searchQuery) await runSearch();
    } catch(e) { showError(e); }
  });

  document.addEventListener("click", function(ev) {
    var t = ev.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.id === "prevInvBtn") {
      state.inventoryPage--;
      if (state.status) renderStatus(state.status);
    }
    if (t.id === "nextInvBtn") {
      state.inventoryPage++;
      if (state.status) renderStatus(state.status);
    }

    var id = t.getAttribute("data-open-doc");
    if (id) openDocument(id).catch(showError);
  });

  async function init() {
    syncTokenState();
    els.tokenInput.value = state.token;
    if (state.searchQuery) els.searchInput.value = state.searchQuery;

    var copyBtn = document.getElementById("copyDocBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", function() {
        if (state.document && state.document.body) {
          navigator.clipboard.writeText(state.document.body).then(function() {
            copyBtn.textContent = "Copied!";
            setTimeout(function() { copyBtn.textContent = "Copy Content"; }, 1500);
          });
        }
      });
    }

    try {
      await loadProfiles();
      if (state.token && state.profile) {
        await loadOverview();
        if (state.searchQuery) await runSearch();
      } else {
        els.statusDetails.innerHTML  = '<div class="muted-box">Load a bearer token to inspect Cloudflare KV, GitHub manifest state, and compare output.</div>';
        els.compareDetails.innerHTML = '<div class="muted-box">Comparison data will appear here after a token is saved.</div>';
      }
    } catch(e) { showError(e); }
  }

  init();
</script>
</body>
</html>`;
}

function parseProfile(value: string | null): Profile {
	if (!value || !PROFILES.includes(value as Profile)) {
		throw new Error(
			`Invalid profile. Expected one of: ${PROFILES.join(", ")}`,
		);
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
				error_description:
					error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
}

export async function handleConsoleStatus(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const url = new URL(request.url);
		const profile = parseProfile(url.searchParams.get("profile"));
		const status = await getConsoleStatus(env, profile);
		return json(status);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return json(
			{ error: "failed_to_load_status", error_description: message },
			400,
		);
	}
}

export async function handleConsoleCompare(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const url = new URL(request.url);
		const profile = parseProfile(url.searchParams.get("profile"));
		const compare = await compareProfile(env, profile);
		return json(compare);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return json(
			{ error: "failed_to_compare", error_description: message },
			400,
		);
	}
}

export async function handleConsoleSearch(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const url = new URL(request.url);
		const profile = parseProfile(url.searchParams.get("profile"));
		const query = url.searchParams.get("q")?.trim() || "";
		const limit = Math.min(
			Math.max(Number(url.searchParams.get("limit") ?? "10") || 10, 1),
			20,
		);

		if (!query) {
			return json({
				profile,
				query,
				total: 0,
				results: [],
				state: "empty",
			});
		}

		const data = await getSearchResults(env, profile, query, limit);
		if (!data.index) {
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
			total: data.results.length,
			results: data.results,
			state: "ok",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return json(
			{ error: "failed_to_search", error_description: message },
			400,
		);
	}
}

export async function handleConsoleDocument(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const url = new URL(request.url);
		const profile = parseProfile(url.searchParams.get("profile"));
		const id = url.searchParams.get("id")?.trim();
		if (!id) {
			return json(
				{
					error: "invalid_request",
					error_description: "id is required",
				},
				400,
			);
		}

		const document = await getDocument(env, profile, id);
		return json(document);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const status = message.includes("not found") ? 404 : 400;
		return json(
			{ error: "failed_to_load_document", error_description: message },
			status,
		);
	}
}

export async function handleConsoleReindex(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const body = (await request.json().catch(() => null)) as {
			profile?: string;
		} | null;
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
		return json(
			{ error: "failed_to_reindex", error_description: message },
			400,
		);
	}
}
