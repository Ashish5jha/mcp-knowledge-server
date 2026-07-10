import { Env, Manifest } from "../types";
import { getCache, setCache, getCacheString, setCacheString } from "../cache/kv";
import { getRegistry } from "../registry/registry";

const MANIFEST_TTL = 60 * 10;  // 10 minutes
const DOC_TTL = 60 * 60;        // 1 hour

interface CachedManifest {
  manifest: Manifest;
  etag?: string;
}

interface CachedDoc {
  body: string;
  etag?: string;
}

/**
 * Fetch manifest.json for a profile from GitHub, using KV as a cache.
 * Uses ETags for conditional requests to avoid unnecessary GitHub bandwidth.
 */
export async function fetchManifest(env: Env, profile: string): Promise<Manifest> {
  const cacheKey = `manifest:${profile}`;
  const cached = await getCache<CachedManifest>(env, cacheKey);

  const registry = await getRegistry(env);
  const profileConfig = registry[profile];
  if (!profileConfig) {
    throw new Error(`Profile "${profile}" not found in registry`);
  }
  const { manifestUrl } = profileConfig;

  const headers: HeadersInit = {
    Accept: "application/json",
  };
  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }

  const response = await fetch(manifestUrl, { headers });

  if (response.status === 304 && cached) {
    // Not modified — return cached version, refresh TTL
    await setCache(env, cacheKey, cached, MANIFEST_TTL);
    return cached.manifest;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest for "${profile}": HTTP ${response.status}`);
  }

  const manifest = await response.json() as Manifest;
  const etag = response.headers.get("ETag") ?? undefined;

  await setCache(env, cacheKey, { manifest, etag }, MANIFEST_TTL);
  return manifest;
}

/**
 * Strip YAML frontmatter from a Markdown string.
 * Returns the body without the --- ... --- block.
 */
function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const endIndex = content.indexOf("---", 3);
  if (endIndex === -1) return content;
  return content.slice(endIndex + 3).trimStart();
}

/**
 * Fetch a raw Markdown document from GitHub, using KV as a cache.
 * Returns the body with frontmatter stripped.
 */
export async function fetchRawDoc(env: Env, profile: string, docPath: string, docId: string): Promise<string> {
  const cacheKey = `content:${profile}:${docId}`;
  const cached = await getCache<CachedDoc>(env, cacheKey);

  const registry = await getRegistry(env);
  const profileConfig = registry[profile];
  if (!profileConfig) {
    throw new Error(`Profile "${profile}" not found in registry`);
  }
  const { rawBase } = profileConfig;
  const url = rawBase + docPath;

  const headers: HeadersInit = {};
  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }

  const response = await fetch(url, { headers });

  if (response.status === 304 && cached) {
    await setCache(env, cacheKey, cached, DOC_TTL);
    return cached.body;
  }

  if (response.status === 404) {
    throw new Error(`Document "${docId}" not found in GitHub (path: ${docPath})`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch document "${docId}": HTTP ${response.status}`);
  }

  const raw = await response.text();
  const body = stripFrontmatter(raw);
  const etag = response.headers.get("ETag") ?? undefined;

  await setCache(env, cacheKey, { body, etag }, DOC_TTL);
  return body;
}
