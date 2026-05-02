#!/usr/bin/env node
/**
 * gh-push.mjs — Push workspace to GitHub via Git Tree API (single commit)
 * Requires GITHUB_TOKEN env var.
 * Usage: node scripts/src/gh-push.mjs
 */

import fs from "fs";
import path from "path";

const OWNER = "JBlizzard-sketch";
const REPO = "nairobi-flash-deals";
const BRANCH = "main";
const BASE = "/home/runner/workspace";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error("ERROR: GITHUB_TOKEN not set");
  process.exit(1);
}

const HEADERS = {
  Authorization: `token ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
  "User-Agent": "nairobi-flash-deals-push-script",
};

// Files to exclude
const EXCLUDE_PATTERNS = [
  /\/\.git\//,
  /\/node_modules\//,
  /\/\.local\//,
  /\/dist\//,
  /\/\.cache\//,
  /\/\.agents\//,
  /\/attached_assets\//,
  /\.lock$/,
  /\.map$/,
  /\.tsbuildinfo$/,
];

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((p) => p.test(filePath));
}

function walkDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (entry.isFile() && !shouldExclude(fullPath)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function ghFetch(endpoint, options = {}) {
  const url = `https://api.github.com${endpoint}`;
  const res = await fetch(url, { ...options, headers: HEADERS });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} on ${endpoint}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function createBlob(content, encoding = "base64") {
  const data = await ghFetch(`/repos/${OWNER}/${REPO}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content, encoding }),
  });
  return data.sha;
}

async function main() {
  console.log("Scanning workspace files...");
  const files = walkDir(BASE);
  console.log(`Found ${files.length} files to push`);

  // Create blobs in batches of 10 for speed
  const treeEntries = [];
  const BATCH = 10;

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (absPath) => {
        const relPath = path.relative(BASE, absPath);
        let content, encoding;
        try {
          const buf = fs.readFileSync(absPath);
          // Try to detect binary
          content = buf.toString("base64");
          encoding = "base64";
        } catch {
          return null;
        }
        const sha = await createBlob(content, encoding);
        return { path: relPath, mode: "100644", type: "blob", sha };
      })
    );
    for (const entry of results) {
      if (entry) {
        treeEntries.push(entry);
        process.stdout.write(`\r  Uploaded ${treeEntries.length}/${files.length} blobs...`);
      }
    }
  }

  // Make github-push.sh executable
  const pushScriptEntry = treeEntries.find((e) => e.path === "scripts/github-push.sh");
  if (pushScriptEntry) {
    pushScriptEntry.mode = "100755";
  }

  console.log(`\nCreating tree with ${treeEntries.length} entries...`);
  const tree = await ghFetch(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ tree: treeEntries }),
  });

  console.log("Creating initial commit...");
  const commit = await ghFetch(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: "feat: initial platform scaffold — Nairobi Flash Deals\n\nFull monorepo scaffold including:\n- Express 5 API server with TypeScript + Drizzle ORM\n- OpenAPI contract-first codegen (Orval)\n- Zod v4 validation schemas\n- pnpm workspace structure\n- Mockup sandbox (Vite + React)\n- README, LICENSE, automated push script",
      tree: tree.sha,
      parents: [], // empty repo — no parent
    }),
  });

  console.log("Creating main branch ref...");
  await ghFetch(`/repos/${OWNER}/${REPO}/git/refs`, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${BRANCH}`,
      sha: commit.sha,
    }),
  });

  console.log(`\n✓ Successfully pushed ${treeEntries.length} files`);
  console.log(`✓ Commit: ${commit.sha}`);
  console.log(`✓ Repo: https://github.com/${OWNER}/${REPO}`);
}

main().catch((err) => {
  console.error("Push failed:", err.message);
  process.exit(1);
});
