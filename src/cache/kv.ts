import { Env } from "../types";

export async function getCache<T>(env: Env, key: string): Promise<T | null> {
  const data = await env.KNOWLEDGE_CACHE.get(key, "json");
  return data as T | null;
}

export async function setCache(env: Env, key: string, value: any, ttlSeconds?: number): Promise<void> {
  const options: KVNamespacePutOptions = {};
  if (ttlSeconds) {
    options.expirationTtl = ttlSeconds;
  }
  await env.KNOWLEDGE_CACHE.put(key, JSON.stringify(value), options);
}

export async function getCacheString(env: Env, key: string): Promise<string | null> {
  return await env.KNOWLEDGE_CACHE.get(key);
}

export async function setCacheString(env: Env, key: string, value: string, ttlSeconds?: number): Promise<void> {
  const options: KVNamespacePutOptions = {};
  if (ttlSeconds) {
    options.expirationTtl = ttlSeconds;
  }
  await env.KNOWLEDGE_CACHE.put(key, value, options);
}
