# Snowflake Sync for the Account Tracker

Auto-refresh the tracker from Salesforce-in-Snowflake every day, **without overwriting your
manual research** (notes, flags, tiers, timelines, the four hypotheses, highlights).

> **Where this runs:** on your **Mac**, via your **local Claude Code CLI** — *not* in a
> Claude Code on the web session. The web sandbox has no Snowflake MCP and can't run your
> cron/launchd schedule. The files in this repo (`sync_prompt.txt`, `sync.sh`) are scaffolding
> you run locally.

This repo already contains:
- `sync_prompt.txt` — the merge/rebuild instructions fed to Claude Code (has `{TABLE}` placeholders to fill in).
- `sync.sh` — the runner (portable: operates from its own directory; logs to `sync_log_YYYYMMDD.txt`).

---

## Step 1 — Connect the Snowflake MCP (one-time, local)

```bash
claude mcp add snowflake --transport sse \
  "https://kn27690-sza96462.snowflakecomputing.com/api/v2/databases/reporting/schemas/general/mcp-servers/CLAUDE_MCP_SERVER"

claude mcp list   # confirm "snowflake" appears
```

## Step 2 — Discover your tables (one-time)

In your local Claude Code, run:

```
I have a Snowflake MCP server connected. Database: "reporting", Schema: "general".
I'm a Commercial AE at Datadog; my Salesforce account data is synced to Snowflake.

1. List ALL tables and views in reporting.general
2. Find tables containing: Accounts, Opportunities, Contacts, Org usage/billing
3. For each, show column names + 5 sample rows
4. Filter for owner = 'Connor Miller' or owner_email like '%connor.miller%'
5. Save findings to snowflake_schema_discovery.md
```

Then open `sync_prompt.txt` and replace `{ACCOUNTS_TABLE}`, `{OPPORTUNITIES_TABLE}`,
`{ORG_TABLE}`, `{CONTACTS_TABLE}` (and any column names that differ) with the real ones.

## Step 3 — Make the runner executable & test it (one-time)

```bash
chmod +x sync.sh   # already +x if you cloned this repo
./sync.sh          # manual run; watch the summary + check the log
```

Open `account_tracker.html` afterward and confirm your research is intact and new accounts appear.

## Step 4 — Schedule it (one-time, Mac-local)

**cron** (6:00 AM daily) — `crontab -e`:

```
0 6 * * * /full/path/to/sync.sh
```

macOS often needs **Full Disk Access** for `/usr/sbin/cron` (System Settings → Privacy &
Security → Full Disk Access). The more Mac-native option is **launchd** — see the plist in
the runbook you used to set this up.

## Manual sync anytime

```bash
./sync.sh
```

---

## Safety: what the sync will and won't touch

| Updated from Snowflake | Never overwritten (your research) |
|---|---|
| name, location, employees, industry | notes, statusNote |
| sfUrl, pastOpp | howTheyMakeMoney, whyAnything, whyNow, whyDatadog |
| description (only if currently blank) | flags, highlights, tier overrides, timelines, hiring personas/URLs |

New SF accounts are added with blank research fields and printed as `[NEW] …`. Accounts only
in your tracker are kept and printed as `[NOT IN SF] …`.

## Troubleshooting

- **Auth expired** — cron runs non-interactively; if Claude Code needs browser auth the job
  fails silently. Run `./sync.sh` manually once after re-authenticating. Check `sync_log_*.txt`.
- **Snowflake permission denied** — you need read access to `reporting.general`. Ask RevOps/Sales
  Ops for the right role (e.g. `SALESFORCE_READONLY` / `DD_REPORTING_READ`).
- **Chrome not updating** — local files cache hard. Hard refresh (Cmd+Shift+R) or reopen the tab.

## Backups

Before the first scheduled run, open the tracker and click **⬇ Export** to save a JSON backup
(merges are designed to be non-destructive, but keep a backup anyway).
