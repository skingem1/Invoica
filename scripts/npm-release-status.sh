#!/usr/bin/env bash
# scripts/npm-release-status.sh
#
# Prints a markdown summary of npm packages with unpublished changes.
# Run from the repo root. Called by the CEO agent as part of the daily report.
#
# Usage:  bash scripts/npm-release-status.sh
# Output: Markdown block ready to paste into the daily report.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TODAY="$(date '+%Y-%m-%d')"

echo "## npm Package Status — ${TODAY}"
echo ""

# ── Helper ──────────────────────────────────────────────────────────────────
commits_since() {
  local tag="$1"; shift          # git ref to compare from
  local dirs=("$@")              # directories / files to filter
  git log "${tag}..HEAD" --oneline -- "${dirs[@]}" 2>/dev/null || true
}

# ── 1. invoica-mcp ───────────────────────────────────────────────────────────
MCP_PUBLISHED="$(npm view invoica-mcp version 2>/dev/null || echo 'not_found')"
MCP_LOCAL="$(node -e "process.stdout.write(require('./mcp-package/package.json').version)")"
LAST_MCP_TAG="$(git tag --list 'npm-v*' --sort=-version:refname 2>/dev/null | head -1 || true)"

echo "### invoica-mcp"
echo "| | version |"
echo "|---|---|"
echo "| 📦 Published (npm) | \`${MCP_PUBLISHED}\` |"
echo "| 📁 Local (package.json) | \`${MCP_LOCAL}\` |"
echo "| 🏷️  Last publish tag | \`${LAST_MCP_TAG:-none}\` |"
echo ""

if [ -z "${LAST_MCP_TAG:-}" ]; then
  echo "> ⚠️  No npm-v* tags found — package may never have been released via CI."
else
  MCP_COMMITS="$(commits_since "$LAST_MCP_TAG" mcp-package/ src/mcp/ tsconfig.mcp.json)"
  if [ -z "$MCP_COMMITS" ]; then
    echo "> ✅ No changes since \`${LAST_MCP_TAG}\` — nothing to release."
  else
    COMMIT_COUNT="$(echo "$MCP_COMMITS" | wc -l | tr -d ' ')"
    echo "> ⚠️  **${COMMIT_COUNT} unpublished commit(s)** since \`${LAST_MCP_TAG}\`:"
    echo ""
    echo "$MCP_COMMITS" | while IFS= read -r line; do
      echo "- \`${line}\`"
    done
    echo ""
    echo "> To release: bump \`mcp-package/package.json\` version, then:"
    echo "> \`git tag npm-v<NEW_VERSION> && git push origin npm-v<NEW_VERSION>\`"
  fi
fi

echo ""

# ── 2. @invoica/sdk ──────────────────────────────────────────────────────────
SDK_PUBLISHED="$(npm view @invoica/sdk version 2>/dev/null || echo 'not_found')"
SDK_LOCAL="$(node -e "process.stdout.write(require('./sdk/package.json').version)")"
LAST_SDK_TAG="$(git tag --list 'sdk-v*' --sort=-version:refname 2>/dev/null | head -1 || true)"

echo "### @invoica/sdk"
echo "| | version |"
echo "|---|---|"
echo "| 📦 Published (npm) | \`${SDK_PUBLISHED}\` |"
echo "| 📁 Local (package.json) | \`${SDK_LOCAL}\` |"
echo "| 🏷️  Last publish tag | \`${LAST_SDK_TAG:-none}\` |"
echo ""

if [ -z "${LAST_SDK_TAG:-}" ]; then
  echo "> ⚠️  No sdk-v* tags found — package may never have been released via CI."
else
  SDK_COMMITS="$(commits_since "$LAST_SDK_TAG" sdk/)"
  if [ -z "$SDK_COMMITS" ]; then
    echo "> ✅ No changes since \`${LAST_SDK_TAG}\` — nothing to release."
  else
    COMMIT_COUNT="$(echo "$SDK_COMMITS" | wc -l | tr -d ' ')"
    echo "> ⚠️  **${COMMIT_COUNT} unpublished commit(s)** since \`${LAST_SDK_TAG}\`:"
    echo ""
    echo "$SDK_COMMITS" | while IFS= read -r line; do
      echo "- \`${line}\`"
    done
    echo ""
    echo "> To release: bump \`sdk/package.json\` version, then:"
    echo "> \`git tag sdk-v<NEW_VERSION> && git push origin sdk-v<NEW_VERSION>\`"
  fi
fi

echo ""
