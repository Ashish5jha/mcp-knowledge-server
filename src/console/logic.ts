import {
	Env,
	Manifest,
	PROFILES,
	Profile,
	SearchIndex,
	DocumentMeta,
} from "../types";
import { getCache } from "../cache/kv";
import { getRegistry } from "../registry/registry";
import { buildIndex, tokenize } from "../indexer/buildIndex";
import { fetchRawDoc } from "../fetcher/github";

export interface ProfileSource {
	profile: Profile;
	manifestUrl: string;
	rawBase: string;
}

export interface CloudflareIndexState {
	exists: boolean;
	version: string | null;
	builtAt: string | null;
	documentCount: number;
	recentDocs: DocumentMeta[];
}

export interface GitHubManifestState {
	reachable: boolean;
	manifestUrl: string;
	rawBase: string;
	version: string | null;
	documentCount: number;
	documents: DocumentMeta[];
	error?: string;
}

export interface FreshnessState {
	state: "fresh" | "stale" | "missing" | "error";
	reason: string;
}

export interface ConsoleStatus {
	profile: Profile;
	registry: ProfileSource | null;
	cloudflareIndex: CloudflareIndexState;
	githubManifest: GitHubManifestState;
	freshness: FreshnessState;
}

export interface SearchHit {
	id: string;
	title: string;
	type: string;
	summary: string;
	tags: string[];
	related: string[];
	path: string;
	score: number;
	confidence: "exact" | "partial" | "related-only";
}

export interface CompareDocChange {
	id: string;
	path: string;
	title: string;
	type: string;
	changes: Array<{
		field: string;
		from: unknown;
		to: unknown;
	}>;
}

export interface CompareResult {
	profile: Profile;
	summary: {
		state: "in_sync" | "out_of_sync" | "missing" | "error";
		added: number;
		removed: number;
		changed: number;
	};
	addedDocs: DocumentMeta[];
	removedDocs: DocumentMeta[];
	changedDocs: CompareDocChange[];
	error?: string;
}

export interface ConsoleDocument {
	profile: Profile;
	metadata: DocumentMeta;
	body: string;
}

const WEIGHT_TITLE = 3;
const WEIGHT_TAGS = 2;
const WEIGHT_SUMMARY = 1;

function sortByRecentUpdate(docs: DocumentMeta[]): DocumentMeta[] {
	return [...docs].sort((a, b) => {
		const aTime = Date.parse(a.updated_at);
		const bTime = Date.parse(b.updated_at);
		return (
			(Number.isNaN(bTime) ? 0 : bTime) -
			(Number.isNaN(aTime) ? 0 : aTime)
		);
	});
}

function normalizeForCompare(doc: DocumentMeta): Record<string, unknown> {
	return {
		id: doc.id,
		path: doc.path,
		title: doc.title,
		type: doc.type,
		tags: [...doc.tags].sort(),
		keywords: [...doc.keywords].sort(),
		related: [...doc.related].sort(),
		summary: doc.summary,
		priority: doc.priority,
		updated_at: doc.updated_at,
	};
}

function diffDocs(
	current: DocumentMeta,
	next: DocumentMeta,
): CompareDocChange["changes"] {
	const currentDoc = normalizeForCompare(current);
	const nextDoc = normalizeForCompare(next);
	const fields: Array<keyof typeof currentDoc> = [
		"path",
		"title",
		"type",
		"tags",
		"keywords",
		"related",
		"summary",
		"priority",
		"updated_at",
	];

	return fields
		.filter(
			(field) =>
				JSON.stringify(currentDoc[field]) !==
				JSON.stringify(nextDoc[field]),
		)
		.map((field) => ({
			field,
			from: currentDoc[field],
			to: nextDoc[field],
		}));
}

async function getProfileSource(
	env: Env,
	profile: Profile,
): Promise<ProfileSource> {
	const registry = await getRegistry(env);
	const config = registry[profile];
	if (!config) {
		throw new Error(`Profile "${profile}" not found in registry`);
	}
	return {
		profile,
		manifestUrl: config.manifestUrl,
		rawBase: config.rawBase,
	};
}

async function fetchLiveManifest(
	env: Env,
	profile: Profile,
): Promise<GitHubManifestState> {
	const source = await getProfileSource(env, profile);

	try {
		const response = await fetch(source.manifestUrl, {
			headers: {
				Accept: "application/json",
				"Cache-Control": "no-cache",
			},
		});

		if (!response.ok) {
			return {
				reachable: false,
				manifestUrl: source.manifestUrl,
				rawBase: source.rawBase,
				version: null,
				documentCount: 0,
				documents: [],
				error: `HTTP ${response.status}`,
			};
		}

		const manifest = (await response.json()) as Manifest;
		return {
			reachable: true,
			manifestUrl: source.manifestUrl,
			rawBase: source.rawBase,
			version: manifest.version ?? null,
			documentCount: Array.isArray(manifest.documents)
				? manifest.documents.length
				: 0,
			documents: Array.isArray(manifest.documents)
				? manifest.documents
				: [],
		};
	} catch (error) {
		return {
			reachable: false,
			manifestUrl: source.manifestUrl,
			rawBase: source.rawBase,
			version: null,
			documentCount: 0,
			documents: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function getCloudflareIndex(
	env: Env,
	profile: Profile,
): Promise<CloudflareIndexState> {
	const index = await getCache<SearchIndex>(env, `index:${profile}`);
	if (!index) {
		return {
			exists: false,
			version: null,
			builtAt: null,
			documentCount: 0,
			recentDocs: [],
		};
	}

	return {
		exists: true,
		version: index.version ?? null,
		builtAt: index.builtAt ?? null,
		documentCount: Array.isArray(index.documents)
			? index.documents.length
			: 0,
		recentDocs: sortByRecentUpdate(index.documents),
	};
}

function determineFreshness(
	index: CloudflareIndexState,
	manifest: GitHubManifestState,
): FreshnessState {
	if (!index.exists) {
		return {
			state: "missing",
			reason: "No Cloudflare index found for this profile",
		};
	}

	if (!manifest.reachable) {
		return {
			state: "error",
			reason: manifest.error
				? `Unable to fetch GitHub manifest: ${manifest.error}`
				: "Unable to fetch GitHub manifest",
		};
	}

	if (!index.version || !manifest.version) {
		return {
			state: "error",
			reason: "Missing version information on index or manifest",
		};
	}

	if (index.version !== manifest.version) {
		return {
			state: "stale",
			reason: `Cloudflare index version ${index.version} differs from GitHub manifest version ${manifest.version}`,
		};
	}

	if (index.documentCount !== manifest.documentCount) {
		return {
			state: "stale",
			reason: `Document count differs between Cloudflare (${index.documentCount}) and GitHub (${manifest.documentCount})`,
		};
	}

	return {
		state: "fresh",
		reason: "Cloudflare index matches the current GitHub manifest",
	};
}

export async function getConsoleProfiles(env: Env): Promise<ProfileSource[]> {
	const registry = await getRegistry(env);
	return PROFILES.map((profile) => ({
		profile,
		manifestUrl: registry[profile]?.manifestUrl ?? "",
		rawBase: registry[profile]?.rawBase ?? "",
	}));
}

export async function getConsoleStatus(
	env: Env,
	profile: Profile,
): Promise<ConsoleStatus> {
	const registry = await getProfileSource(env, profile);
	const [index, manifest] = await Promise.all([
		getCloudflareIndex(env, profile),
		fetchLiveManifest(env, profile),
	]);

	return {
		profile,
		registry,
		cloudflareIndex: index,
		githubManifest: manifest,
		freshness: determineFreshness(index, manifest),
	};
}

export async function compareProfile(
	env: Env,
	profile: Profile,
): Promise<CompareResult> {
	const index = await getCache<SearchIndex>(env, `index:${profile}`);
	const manifest = await fetchLiveManifest(env, profile);

	if (!index) {
		return {
			profile,
			summary: {
				state: "missing",
				added: 0,
				removed: 0,
				changed: 0,
			},
			addedDocs: [],
			removedDocs: [],
			changedDocs: [],
		};
	}

	if (!manifest.reachable) {
		return {
			profile,
			summary: {
				state: "error",
				added: 0,
				removed: 0,
				changed: 0,
			},
			addedDocs: [],
			removedDocs: [],
			changedDocs: [],
			error: manifest.error ?? "Unable to fetch GitHub manifest",
		};
	}

	const indexDocs = new Map(index.documents.map((doc) => [doc.id, doc]));
	const manifestDocs = new Map(
		manifest.documents.map((doc) => [doc.id, doc]),
	);

	const addedDocs = manifest.documents.filter(
		(doc) => !indexDocs.has(doc.id),
	);
	const removedDocs = index.documents.filter(
		(doc) => !manifestDocs.has(doc.id),
	);
	const changedDocs: CompareDocChange[] = [];

	for (const doc of manifest.documents) {
		const current = indexDocs.get(doc.id);
		if (!current) continue;
		const changes = diffDocs(current, doc);
		if (changes.length > 0) {
			changedDocs.push({
				id: doc.id,
				path: doc.path,
				title: doc.title,
				type: doc.type,
				changes,
			});
		}
	}

	return {
		profile,
		summary: {
			state:
				addedDocs.length === 0 &&
				removedDocs.length === 0 &&
				changedDocs.length === 0
					? "in_sync"
					: "out_of_sync",
			added: addedDocs.length,
			removed: removedDocs.length,
			changed: changedDocs.length,
		},
		addedDocs,
		removedDocs,
		changedDocs,
	};
}

export function searchProfile(
	index: SearchIndex,
	query: string,
	limit: number,
): SearchHit[] {
	const queryTerms = tokenize(query);
	if (queryTerms.length === 0) {
		return [];
	}

	const scores: Record<string, number> = {};

	for (const doc of index.documents) {
		let docScore = 0;

		const titleTerms = new Set(tokenize(doc.title));
		const tagTerms = new Set([
			...doc.tags.flatMap(tokenize),
			...doc.keywords.flatMap(tokenize),
		]);
		const summaryTerms = new Set(tokenize(doc.summary));

		for (const term of queryTerms) {
			if (titleTerms.has(term)) docScore += WEIGHT_TITLE;
			else if (tagTerms.has(term)) docScore += WEIGHT_TAGS;
			else if (summaryTerms.has(term)) docScore += WEIGHT_SUMMARY;
		}

		if (docScore > 0) {
			scores[doc.id] = docScore;
		}
	}

	const maxPossibleScore = queryTerms.length * WEIGHT_TITLE;

	return Object.entries(scores)
		.sort(([, a], [, b]) => b - a)
		.slice(0, limit)
		.map(([id, score]) => {
			const doc = index.documents.find((entry) => entry.id === id);
			if (!doc) {
				return null;
			}

			const ratio = score / maxPossibleScore;
			const confidence: SearchHit["confidence"] =
				ratio >= 0.8
					? "exact"
					: ratio >= 0.4
						? "partial"
						: "related-only";

			return {
				id: doc.id,
				title: doc.title,
				type: doc.type,
				summary: doc.summary,
				tags: doc.tags,
				related: doc.related,
				path: doc.path,
				score,
				confidence,
			} satisfies SearchHit;
		})
		.filter((entry): entry is SearchHit => entry !== null);
}

export async function getSearchResults(
	env: Env,
	profile: Profile,
	query: string,
	limit: number,
): Promise<{
	index: SearchIndex | null;
	results: SearchHit[];
}> {
	const index = await getCache<SearchIndex>(env, `index:${profile}`);
	if (!index) {
		return { index: null, results: [] };
	}

	return {
		index,
		results: searchProfile(index, query, limit),
	};
}

export async function getDocument(
	env: Env,
	profile: Profile,
	id: string,
): Promise<ConsoleDocument> {
	const index = await getCache<SearchIndex>(env, `index:${profile}`);
	if (!index) {
		throw new Error(`No search index found for profile "${profile}"`);
	}

	const metadata = index.documents.find((doc) => doc.id === id);
	if (!metadata) {
		throw new Error(`Document "${id}" not found in profile "${profile}"`);
	}

	const body = await fetchRawDoc(env, profile, metadata.path, metadata.id);
	return {
		profile,
		metadata,
		body,
	};
}

export async function reindexProfile(
	env: Env,
	profile: Profile,
): Promise<SearchIndex> {
	await buildIndex(env, profile);
	const index = await getCache<SearchIndex>(env, `index:${profile}`);
	if (!index) {
		throw new Error(`Reindex completed but index:${profile} is missing`);
	}
	return index;
}
