import { Env, Manifest, SearchIndex } from "../types";
import { getCache, setCache } from "../cache/kv";
import { fetchManifest } from "../fetcher/github";

/**
 * Tokenize a text string into lowercase terms for index building and query matching.
 * Strips non-alphanumeric characters and filters out short/empty tokens.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_,;:.!?()[\]{}\/\\]+/)
    .filter((t) => t.length > 1);
}

/**
 * Build the search index for a given profile by:
 * 1. Fetching the manifest from GitHub (via KV cache)
 * 2. Tokenizing each document's title, tags, keywords, and summary
 * 3. Building a termIndex: term -> [docId, ...]
 * 4. Storing the result in KV as `index:{profile}`
 */
export async function buildIndex(env: Env, profile: string): Promise<void> {
  const manifest = await fetchManifest(env, profile);

  const termIndex: Record<string, string[]> = {};

  for (const doc of manifest.documents) {
    const terms = new Set<string>([
      ...tokenize(doc.title),
      ...doc.tags.flatMap(tokenize),
      ...doc.keywords.flatMap(tokenize),
      ...tokenize(doc.summary),
    ]);

    for (const term of terms) {
      if (!termIndex[term]) termIndex[term] = [];
      if (!termIndex[term].includes(doc.id)) {
        termIndex[term].push(doc.id);
      }
    }
  }

  const index: SearchIndex = {
    version: manifest.version,
    builtAt: new Date().toISOString(),
    documents: manifest.documents,
    termIndex,
  };

  // Store for 24h — cron runs every 6h so this is always fresh
  await setCache(env, `index:${profile}`, index, 86400);
}
