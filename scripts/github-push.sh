#!/usr/bin/env bash
# ============================================================
# github-push.sh — Push current workspace to GitHub
#
# Usage:
#   ./scripts/github-push.sh              # auto commit + push
#   ./scripts/github-push.sh "my message" # custom commit message
#
# Runs automatically via a periodic workflow.
# Requires GITHUB_TOKEN in the environment.
# ============================================================

set -euo pipefail

REPO_URL="https://${GITHUB_TOKEN}@github.com/JBlizzard-sketch/nairobi-flash-deals.git"
BRANCH="main"
COMMIT_MSG="${1:-"chore: auto-sync $(date -u '+%Y-%m-%d %H:%M UTC')"}"

# ── Configure git identity (idempotent) ──────────────────────
git config user.email "bot@nairobi-flash-deals.dev" 2>/dev/null || true
git config user.name  "Nairobi Flash Deals Bot"     2>/dev/null || true

# ── Ensure remote is set correctly ──────────────────────────
if git remote get-url github &>/dev/null; then
  git remote set-url github "$REPO_URL"
else
  git remote add github "$REPO_URL"
fi

# ── Stage all changes ────────────────────────────────────────
git add -A

# ── Commit only if there's something new ────────────────────
if git diff --cached --quiet; then
  echo "✓ Nothing new to commit — workspace is clean."
else
  git commit -m "$COMMIT_MSG"
  echo "✓ Committed: $COMMIT_MSG"
fi

# ── Push ─────────────────────────────────────────────────────
git push github "$BRANCH" --force-with-lease 2>&1 | grep -v "$GITHUB_TOKEN" || \
git push github "$BRANCH" --force 2>&1 | grep -v "$GITHUB_TOKEN"

echo "✓ Pushed to github.com/JBlizzard-sketch/nairobi-flash-deals ($BRANCH)"
