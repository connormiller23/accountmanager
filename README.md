# Connor's Account Tracker 📊

A React app for tracking 105 accounts. Runs locally on **http://localhost:8000**.
All edits (flags, tiers, notes, timelines, hypotheses, highlights, custom accounts) persist to
`localStorage` under the `att_` prefix and can be exported/imported as JSON.

---

## Run it locally (React app)

Requires **Node 18+**.

```bash
npm install
npm run dev
# → http://localhost:8000
```

That's it. The dev server runs on port 8000 (hot-reloads on edits).

Other scripts:

```bash
npm run build     # production build → dist/
npm run preview   # serve the production build, also on http://localhost:8000
```

## Project layout

```
.
├── index.html              # Vite entry (mounts #root)
├── vite.config.js          # dev + preview pinned to port 8000
├── package.json
├── accounts_data.js        # 105 accounts (ACCTS) + WEBSITES map — the data source of truth
├── src/
│   ├── main.jsx            # entry: localStorage shim + ReactDOM.createRoot
│   ├── AccountTracker.jsx  # the whole app component (table, editing, detail panel, SaaS shell)
│   └── styles.css          # CSS variables + base + SaaS dashboard shell
├── account_tracker.html              # standalone single-file export (CDN React) — see below
├── account_tracker_selfcontained.html# standalone single-file export (offline) — see below
└── SNOWFLAKE_SYNC.md / sync.sh / sync_prompt.txt   # optional daily Salesforce→Snowflake sync
```

To change account data, edit **`accounts_data.js`** — the app imports it directly, so the dev
server hot-reloads. (The standalone HTML exports below have the data inlined and must be rebuilt.)

## Features

- **Sortable / filterable table** — flag, tier, industry, employees, timeline, past opp, date added.
- **SaaS dashboard shell** — sticky app bar, KPI cards (total, tier A/B/C, hot), card-contained table with a sticky header.
- **Inline editing** — double-click most cells (name, status, location, industry, employees, tier, hiring, URLs, description, past opp).
- **Per-account detail panel** — overview, quick links, timeline (date/contact/reason), the four hypotheses (How They Make Money / Why Anything / Why Now / Why Datadog), and notes.
- **Priority flags** (Hot / Medium / Low / Nurture) and **3-color highlights** with editable labels.
- **Add accounts manually** — "+ Add Account" in the toolbar.
- **Backup** — ⬇ Export / ⬆ Import the full state as JSON.

## Standalone single-file exports (no Node required)

If you'd rather not run a dev server, two prebuilt single-file versions are included — just
double-click to open in Chrome:

| File | Notes |
|---|---|
| `account_tracker.html` | React + Babel via the unpkg CDN (needs internet once). Built to run from `file://`. |
| `account_tracker_selfcontained.html` | React vendored inline, JSX pre-transpiled — works fully **offline**. |

These are snapshots of the same app; the React project in `src/` is the source of truth.

## Backups

Click **⬇ Export** regularly and keep the JSON somewhere safe. If local storage is ever cleared,
**⬆ Import** the latest backup to restore everything.

## Optional: daily Salesforce → Snowflake sync

See `SNOWFLAKE_SYNC.md`. It runs on your Mac via your local Claude Code CLI + the Snowflake MCP
(it can't run in a Claude Code web session).
