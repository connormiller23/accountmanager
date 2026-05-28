# How to Rebuild the Account Tracker with Claude Code

## Files in This Package

1. **`CLAUDE_CODE_PROMPT.md`** — Full application spec (features, architecture, bug fixes, data schema)
2. **`accounts_data.js`** — All 105 accounts with full research data + WEBSITES constant (~198KB)
3. **`account_tracker_RECOVERY.md`** — Account intelligence + call notes + contacts (reference, not needed for build)
4. **`account_tracker_TIMELINES_NOTES.md`** — Timelines per account with next steps (reference)
5. **`account_grading_DQ.md`** — Use case grading + DQ recommendations (reference)

---

## Step-by-Step: Rebuild in Claude Code

### 1. Put both build files in the same folder

```bash
mkdir ~/tracker-rebuild
cp CLAUDE_CODE_PROMPT.md ~/tracker-rebuild/
cp accounts_data.js ~/tracker-rebuild/
cd ~/tracker-rebuild
```

### 2. Open Claude Code

```bash
claude
```

### 3. Give it the prompt

Paste this into Claude Code:

```
Read CLAUDE_CODE_PROMPT.md for the full spec and accounts_data.js for the data.
Build me the complete account_tracker.html file per the spec.
Inline the ACCTS array and WEBSITES constant from accounts_data.js directly into the HTML.
Make sure every bug fix in the checklist is addressed.
Output: a single account_tracker.html file I can open in Chrome.
```

### 4. Test it

```bash
open account_tracker.html
```

Chrome opens. Verify:
- 105 accounts show up
- Click a tier → sort is clean (all A's, then B's, then C's)
- Click flag column → sorts Hot → Medium → Low → Nurture → blank
- Add a test account → close Chrome → reopen → test account still there
- Edit a tier → sort still works correctly
- Timeline sort → dates in order, blanks at bottom

### 5. Save a backup immediately

Once it works, click ⬇ Export → save JSON to Google Drive.

---

## If You Need to Add/Change Features Later

Open Claude Code again and say:

```
Read CLAUDE_CODE_PROMPT.md for context. I have an existing account_tracker.html.
[describe the change you want]
```

Claude Code will read the spec, understand the architecture, and make the change without breaking existing functionality.

---

## Weekly Backup Habit

Every Friday (or after any big editing session):
1. Open tracker
2. Click ⬇ Export
3. Move the JSON file to Google Drive

If Chrome ever wipes your data:
1. Open tracker
2. Click ⬆ Import
3. Select your latest JSON backup
4. Everything snaps back
