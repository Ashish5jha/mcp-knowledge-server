import { Env, RegistryConfig } from "../types";
import { getCache } from "../cache/kv";

export async function getRegistry(env: Env): Promise<RegistryConfig> {
  // Read config:registry from KV
  const registry = await getCache<RegistryConfig>(env, "config:registry");
  if (!registry) {
    throw new Error("Registry config not found in KV (config:registry)");
  }
  return registry;
}
