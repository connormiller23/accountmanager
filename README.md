# Connor's Account Tracker 📊

A single-file, offline-capable account tracker for 105 accounts. React 18 + localStorage,
no build step. All edits (flags, tiers, notes, timelines, hypotheses, highlights, custom
accounts) persist to `localStorage` under the `att_` prefix and can be exported/imported as JSON.

## Files

| File | Use it when | Notes |
|---|---|---|
| **`account_tracker.html`** | Opening locally on your Mac (`file://`) or anywhere with internet | Loads React + Babel from the unpkg CDN, per spec. ~275 KB. |
| **`account_tracker_selfcontained.html`** | You need it to work with **no internet** / behind a firewall / in a preview sandbox | React is vendored inline and the JSX is pre-transpiled — zero external requests. ~440 KB. |
| `accounts_data.js` | Source of truth for the 105 accounts (`ACCTS`) + `WEBSITES` map | Inlined into both HTML files. Edit here, then rebuild. |
| `README_REBUILD.md` | Rebuilding from the spec with Claude Code | Original rebuild guide. |

Both HTML files are functionally identical — same data, same features, same UI.

## Run it locally

Just open the file — no server required:

```bash
open account_tracker.html          # macOS, uses CDN (needs internet once)
open account_tracker_selfcontained.html   # works fully offline
```

Or serve the folder over HTTP:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/account_tracker_selfcontained.html
```

## Features

- **Sortable/filterable table** of all accounts — flag, tier, industry, employees, timeline, past opp, date added.
- **SaaS dashboard shell** — sticky app bar, KPI cards (totals, tier A/B/C, hot), card-contained table with a sticky header.
- **Inline editing** — double-click most cells to edit (name, status, location, industry, employees, tier, hiring, URLs, description, past opp).
- **Per-account detail panel** — overview, quick links, timeline (date/contact/reason), the four hypotheses (How They Make Money / Why Anything / Why Now / Why Datadog), and free-form notes.
- **Priority flags** (Hot / Medium / Low / Nurture) and **3-color highlights** with editable labels.
- **Add accounts manually** — "+ Add Account" in the toolbar (name, location, tier, industry, employees, URLs, description).
- **Backup** — ⬇ Export / ⬆ Import the full state as JSON.

## Backups

Click **⬇ Export** regularly and keep the JSON somewhere safe (Google Drive, etc.). If the
browser ever clears local storage, **⬆ Import** the latest backup to restore everything.

## Rebuilding after editing `accounts_data.js`

`accounts_data.js` is the data source; it's inlined into the HTML. After changing it, the
HTML must be regenerated. See `README_REBUILD.md`, or ask Claude Code to "rebuild
`account_tracker.html` from `accounts_data.js`".
