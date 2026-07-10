#!/usr/bin/env node
/**
 * build-manifest.js
 *
 * Walks all .md files inside a profile folder, reads their YAML frontmatter
 * using gray-matter, and emits a manifest.json at the profile root.
 *
 * Usage:
 *   node scripts/build-manifest.js <profile-dir> [profile-name]
 *
 * Examples:
 *   node scripts/build-manifest.js knowledge-base/company   company
 *   node scripts/build-manifest.js knowledge-base/personal  personal
 *   node scripts/build-manifest.js knowledge-base/freelance freelance
 *
 * Or build all three at once:
 *   node scripts/build-manifest.js --all
 */

import matter from "gray-matter";
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const PROFILES = ["company", "personal", "freelance"];

// ── Required frontmatter fields ───────────────────────────────────────────────
const REQUIRED = ["id", "title", "type", "summary", "tags", "keywords"];

/**
 * Walk a directory recursively and return all .md file paths.
 */
function walkMd(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "manifest.json") continue; // skip the output file itself
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkMd(full));
    } else if (extname(entry) === ".md") {
      results.push(full);
    }
  }
  return results;
}

/**
 * Parse a single .md file and return a DocumentMeta object.
 * Throws if required frontmatter fields are missing.
 */
function parseDoc(filePath, profileDir) {
  const raw = readFileSync(filePath, "utf8");
  const { data } = matter(raw);

  const missing = REQUIRED.filter((f) => !data[f]);
  if (missing.length > 0) {
    throw new Error(
      `[${relative(ROOT, filePath)}] Missing frontmatter fields: ${missing.join(", ")}`
    );
  }

  return {
    id: String(data.id),
    path: relative(profileDir, filePath).replace(/\\/g, "/"),
    title: String(data.title),
    type: String(data.type),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
    related: Array.isArray(data.related) ? data.related.map(String) : [],
    summary: String(data.summary),
    priority: typeof data.priority === "number" ? data.priority : 5,
    updated_at: data.updated_at ? String(data.updated_at) : new Date().toISOString().split("T")[0],
  };
}

/**
 * Build the manifest.json for a single profile directory.
 */
function buildManifest(profileDir, profileName) {
  console.log(`\n📂 Building manifest for: ${profileName} (${profileDir})`);

  const mdFiles = walkMd(profileDir);
  if (mdFiles.length === 0) {
    console.warn(`  ⚠️  No .md files found in ${profileDir}`);
  }

  const documents = [];
  const errors = [];

  for (const file of mdFiles) {
    try {
      const doc = parseDoc(file, profileDir);
      documents.push(doc);
      console.log(`  ✅ ${doc.id}  →  ${doc.path}`);
    } catch (err) {
      errors.push(err.message);
      console.error(`  ❌ ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(`\n  ${errors.length} file(s) had errors — fix them before deploying.`);
    process.exitCode = 1;
  }

  const manifest = {
    profile: profileName,
    version: new Date().toISOString(),
    documents,
  };

  const outputPath = join(profileDir, "manifest.json");
  writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`  📄 Written: ${outputPath}  (${documents.length} docs)`);
  return manifest;
}

// ── CLI entry point ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args[0] === "--all") {
  for (const profile of PROFILES) {
    const profileDir = join(ROOT, "knowledge-base", profile);
    try {
      buildManifest(profileDir, profile);
    } catch (err) {
      console.error(`\nFailed to build manifest for ${profile}:`, err.message);
      process.exitCode = 1;
    }
  }
} else if (args.length >= 1) {
  const profileDir = join(ROOT, args[0]);
  const profileName = args[1] ?? args[0].split("/").pop();
  buildManifest(profileDir, profileName);
} else {
  console.error(`
Usage:
  node scripts/build-manifest.js <profile-dir> [profile-name]
  node scripts/build-manifest.js --all

Examples:
  node scripts/build-manifest.js knowledge-base/company company
  node scripts/build-manifest.js --all
`);
  process.exit(1);
}
