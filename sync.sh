#!/bin/bash
# ---------------------------------------------------------------------------
# Daily Snowflake -> Account Tracker sync.
#
# Runs Claude Code non-interactively to pull the latest Salesforce data from
# Snowflake, merge it into accounts_data.js (without touching your manual
# research), and rebuild account_tracker.html.
#
# PREREQUISITES (one-time, on the machine that runs this — your Mac):
#   1. Snowflake MCP connected:
#        claude mcp add snowflake --transport sse \
#          "https://kn27690-sza96462.snowflakecomputing.com/api/v2/databases/reporting/schemas/general/mcp-servers/CLAUDE_MCP_SERVER"
#      Verify with: claude mcp list   (you should see "snowflake")
#   2. sync_prompt.txt has the real table names filled in (see SNOWFLAKE_SYNC.md).
#
# This CANNOT run inside a Claude Code on the web session — the Snowflake MCP
# and your local cron/launchd schedule live on your Mac.
# ---------------------------------------------------------------------------
set -euo pipefail

# Operate from this script's own directory so it's portable.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

LOG="sync_log_$(date +%Y%m%d).txt"

claude -p "$(cat sync_prompt.txt)" \
  --allowedTools "mcp__snowflake*" "Read" "Write" "Edit" "Bash" \
  2>&1 | tee "$LOG"

echo "Sync finished $(date). Log: $DIR/$LOG"
