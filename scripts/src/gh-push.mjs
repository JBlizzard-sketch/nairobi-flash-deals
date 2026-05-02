#!/usr/bin/env node
/**
 * gh-push.mjs — Push workspace to GitHub via Git Contents + Tree API
 * Handles empty repos by bootstrapping with a single file first.
 * Requires GITHUB_TOKEN env var.
 * Usage: node scripts/src/gh-push.mjs [commit message]
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

const COMMIT_MSG =
  process.argv[2] ||
  "feat: initial platform scaffold — Nairobi Flash Deals\n\nFull monorepo scaffold including:\n- Express 5 API server (TypeScript, Express 5, Drizzle ORM)\n- OpenAPI contract-first codegen (Orval)\n- Zod v4 validation schemas\n- pnpm workspace monorepo structure\n- Mockup sandbox (Vite + React + shadcn/ui)\n- README, LICENSE, automated GitHub push script\n- 20-phase development roadmap";

const HEADERS = {
  Authorization: `token ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
  "User-Agent": "nairobi-flash-deals-push-script",
};

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

const EXECUTABLE_FILES = new Set(["scripts/github-push.sh", "scripts/src/gh-push.mjs"]);

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

async function ghFetch(endpoint, options = {}, expectStatuses = []) {
  const url = `https://api.github.com${endpoint}`;
  const res = await fetch(url, { ...options, headers: HEADERS });
  const data = await res.json();
  if (!res.ok && !expectStatuses.includes(res.status)) {
    throw new Error(`GitHub API ${res.status} on ${endpoint}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return { status: res.status, data };
}

/** Bootstrap an empty repo by uploading README.md via Contents API */
async function bootstrapEmptyRepo() {
  console.log("Bootstrapping empty repo with initial README commit...");
  const content = fs.readFileSync(path.join(BASE, "README.md")).toString("base64");
  const { data } = await ghFetch(`/repos/${OWNER}/${REPO}/contents/README.md`, {
    method: "PUT",
    body: JSON.stringify({
      message: "chore: initialize repository",
      content,
      branch: BRANCH,
    }),
  });
  return data.commit.sha;
}

/** Get current HEAD sha for the branch (returns null if empty or not found) */
async function getHeadSha() {
  const { status, data } = await ghFetch(
    `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`,
    {},
    [404, 409]
  );
  if (status === 404 || status === 409) return null;
  return data.object.sha;
}

/** Get the tree sha from a commit sha */
async function getCommitTreeSha(commitSha) {
  const { data } = await ghFetch(`/repos/${OWNER}/${REPO}/git/commits/${commitSha}`);
  return data.tree.sha;
}

/** Create a blob and return its sha */
async function createBlob(content) {
  const { data } = await ghFetch(`/repos/${OWNER}/${REPO}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content, encoding: "base64" }),
  });
  return data.sha;
}

async function main() {
  console.log("Scanning workspace files...");
  const files = walkDir(BASE);
  console.log(`Found ${files.length} files to push`);

  // Step 1: Check if repo has any commits — 409 means truly empty
  let headSha = await getHeadSha();
  if (!headSha) {
    // Bootstrap via Contents API (works even on empty repos)
    headSha = await bootstrapEmptyRepo();
    console.log(`✓ Bootstrapped repo, HEAD: ${headSha.slice(0, 7)}`);
    // Small delay to let GitHub register the new commit
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Step 2: Get base tree sha
  const baseTreeSha = await getCommitTreeSha(headSha);

  // Step 3: Create blobs for all files in parallel batches
  const treeEntries = [];
  const BATCH = 8;

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (absPath) => {
        const relPath = path.relative(BASE, absPath);
        try {
          const buf = fs.readFileSync(absPath);
          const content = buf.toString("base64");
          const sha = await createBlob(content);
          const mode = EXECUTABLE_FILES.has(relPath) ? "100755" : "100644";
          return { path: relPath, mode, type: "blob", sha };
        } catch (err) {
          console.warn(`  ⚠ Skipped ${relPath}: ${err.message}`);
          return null;
        }
      })
    );
    for (const entry of results) {
      if (entry) {
        treeEntries.push(entry);
        process.stdout.write(`\r  Uploaded ${treeEntries.length}/${files.length} blobs...`);
      }
    }
  }
  console.log("");

  // Step 4: Create tree on top of base tree
  console.log(`Creating tree with ${treeEntries.length} entries...`);
  const { data: tree } = await ghFetch(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });

  // Step 5: Create commit
  console.log("Creating commit...");
  const { data: commit } = await ghFetch(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: COMMIT_MSG,
      tree: tree.sha,
      parents: [headSha],
      author: {
        name: "Nairobi Flash Deals Bot",
        email: "bot@nairobi-flash-deals.dev",
        date: new Date().toISOString(),
      },
    }),
  });

  // Step 6: Update branch ref
  console.log("Updating branch ref...");
  await ghFetch(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: true }),
  });

  console.log(`\n✓ Pushed ${treeEntries.length} files`);
  console.log(`✓ Commit: ${commit.sha.slice(0, 7)} — ${COMMIT_MSG.split("\n")[0]}`);
  console.log(`✓ Repo:   https://github.com/${OWNER}/${REPO}`);
}

main().catch((err) => {
  console.error("\nPush failed:", err.message);
  process.exit(1);
});
