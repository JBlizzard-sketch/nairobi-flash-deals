#!/usr/bin/env node
/**
 * github-scheduler.mjs — Cron-like scheduler for GitHub auto-sync
 *
 * Runs scripts/github-push.sh every 30 minutes using setInterval.
 * Executes once immediately on start, then on schedule.
 *
 * Usage: node scripts/src/github-scheduler.mjs
 */

import { execFile } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUSH_SCRIPT = path.resolve(__dirname, "../../scripts/github-push.sh");
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function runPush() {
  const ts = new Date().toUTCString();
  console.log(`\n── ${ts} ──────────────────────────────`);
  console.log("Running github-push.sh...");

  execFile("bash", [PUSH_SCRIPT], { timeout: 120_000 }, (err, stdout, stderr) => {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    if (err) {
      console.error(`⚠ Push error (will retry in 30 min): ${err.message}`);
    }
    console.log(`Next sync at ${new Date(Date.now() + INTERVAL_MS).toUTCString()}`);
  });
}

console.log("GitHub auto-scheduler started.");
console.log(`Schedule: every ${INTERVAL_MS / 60_000} minutes`);
console.log(`Script:   ${PUSH_SCRIPT}`);

// Run immediately on start, then every 30 minutes
runPush();
setInterval(runPush, INTERVAL_MS);
