export interface Env {
  AUTH_TOKEN: string;
  KNOWLEDGE_CACHE: KVNamespace;
}

export type Profile = "company" | "personal" | "freelance";

export interface RegistryConfig {
  [profile: string]: {
    manifestUrl: string;
    rawBase: string;
  };
}

export interface DocumentMeta {
  id: string;
  path: string;
  title: string;
  type: string;
  tags: string[];
  keywords: string[];
  related: string[];
  summary: string;
  priority: number;
  updated_at: string;
}

export interface Manifest {
  profile: string;
  version: string;
  documents: DocumentMeta[];
}

export interface SearchIndex {
  version: string;
  builtAt: string;
  documents: DocumentMeta[];
  termIndex: Record<string, string[]>;
}
