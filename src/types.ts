export interface Env {
	AUTH_TOKEN: string;
	KNOWLEDGE_CACHE: KVNamespace;
	// OAuth 2.1 (GitHub-backed)
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	GITHUB_OWNER_LOGIN: string; // your GitHub username — only you can OAuth in
	WORKER_URL: string; // e.g. https://mcp-knowledge-server.ashish-biller.workers.dev
}

export const PROFILES = ["company", "personal", "freelance"] as const;
export type Profile = (typeof PROFILES)[number];

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
