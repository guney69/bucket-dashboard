# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Overview

This repo contains two daily KPI pipeline projects and a shared frontend dashboard:

- **`bucketstore-daily-kpi/`** — Node.js pipeline for Bucketstore brand
- **`yes24-daily-kpi/`** — Node.js pipeline for YES24 brand (identical structure)
- **`index.html`** — Single-file dashboard served via a local HTTP server, deployed to Netlify

Both pipelines follow the same 3-step flow:

```
Gmail (Braze Engagement Report CSV) → Braze REST API (KPI metrics) → Google Sheets
```

Failures at each step trigger a Slack alert and `process.exit(1)`.

---

## Running the Pipelines

```bash
# Run a pipeline manually
cd bucketstore-daily-kpi && npm start
cd yes24-daily-kpi && npm start

# First-time Gmail OAuth2 setup (generates GMAIL_REFRESH_TOKEN)
cd bucketstore-daily-kpi && npm run auth-gmail
```

No test runner is configured. There are no unit tests.

### Scheduling (macOS launchd)

Pipelines are scheduled via `launchd`, not cron. Use `launchctl` commands:

```bash
# Register
launchctl load ~/Library/LaunchAgents/com.xxx.plist

# Modify: unload → edit plist → load
launchctl unload ~/Library/LaunchAgents/com.xxx.plist
launchctl load ~/Library/LaunchAgents/com.xxx.plist

# Run immediately (for testing)
launchctl start com.xxx

# Check status
launchctl list | grep xxx
```

**Important:** When referencing `node` in a plist, use the absolute path (nvm shims don't work in launchd context):
`/Users/gunheelee/.nvm/versions/node/v25.8.0/bin/node`

---

## Environment Setup

Each pipeline has its own `.env` (see `.env.example`):

```
BRAZE_API_KEY / BRAZE_API_ENDPOINT
SEGMENT_ID_PUSH / SEGMENT_ID_SMS / SEGMENT_ID_KAKAO
GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_JSON
SLACK_WEBHOOK_URL
GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN
TIMEZONE=Asia/Seoul
```

Google Sheets auth uses a Service Account JSON file (path set in `GOOGLE_SERVICE_ACCOUNT_JSON`). Gmail auth uses OAuth2 with a stored `GMAIL_REFRESH_TOKEN`.

---

## Architecture: Pipeline Modules

Each `src/` directory contains these modules:

| File | Responsibility |
|------|---------------|
| `index.js` | Orchestrator — calls steps 1–3 sequentially, handles fatal errors |
| `gmail.js` | Step 1 — search Gmail for Braze Engagement Report, extract CSV download links, download files to `data/tmp/` |
| `braze.js` | Step 2 — call Braze REST API for 14+ metrics concurrently via `Promise.all` |
| `sheets.js` | Step 3 — append CSV rows and KPI data to Google Sheets |
| `notify.js` | Send Slack webhook alerts on failure (never throws) |
| `utils/date.js` | KST date utilities: `getTodayKST()`, `getYesterdayKST()`, `getBrazeEndingAt()`, `getDateStamp()` |

---

## Critical Gotchas (from SKILL.md / MEMORY.md)

### Braze API

- **Revenue** is at `GET /purchases/revenue_series` → `data[0].revenue`, **not** `/kpi/revenue/data_series`
- **Purchase count** is at `GET /purchases/quantity_series` → `data[0].purchase_quantity`; `$Purchase` is not a custom event and cannot be queried via `/events/data_series`
- `ending_at` must always be a **past timestamp**: use `new Date().toISOString()`. Never compute a future midnight.
- All 14 Braze API calls run concurrently with `Promise.all`; individual failures return `null` (pipeline continues with partial data)

When adding new Braze metrics, verify the exact endpoint and response field from the Braze MCP server source:
```
~/Library/Application Support/Claude/Claude Extensions/
  ant.dir.pypi.braze.braze-mcp-server/src/braze_mcp/
    tools/    ← url_path, params
    models/   ← response field names
```

### Gmail

- The Gmail `after:` filter uses **yesterday KST** (`getYesterdayKST()`), not today. Braze emails arriving at KST midnight are timestamped UTC previous day and would be missed with `after:todayKST`.
- Always verify actual email subject/sender via Gmail MCP before writing a search query — specs may differ from real email subjects.
- `messages[0]` from the search result is always the most recent (results are sorted newest-first).

### Google Sheets

- Header row: included only when the sheet is empty (`isSheetEmpty` check), skipped on subsequent daily appends.
- Use `valueInputOption: 'USER_ENTERED'` so numbers aren't stored as strings.
- Use `insertDataOption: 'INSERT_ROWS'` to append without overwriting.

### Pipeline Timing

```
Braze report sent: 08:30 KST
Pipeline runs:     09:00 KST
Download links expire: 09:30 KST (1 hour after send)
```

The pipeline must run within 1 hour of the Braze report send time. The Braze report schedule and the launchd schedule must be designed together.

---

## Dashboard (index.html)

The dashboard is a single HTML file with embedded CSS and JS. It fetches data from Google Sheets via the Google Visualization (gviz) API (no server-side code). All chart rendering uses Chart.js (CDN). Design tokens follow the "Digital Architect" system defined in `DESIGN.md`.

Key design rules from `DESIGN.md`:
- **No 1px solid borders** — use background color shifts for separation
- **No dividers** between list items — use spacing instead
- **Glassmorphism** for floating panels: `rgba(255,255,255,0.7)` + `backdrop-filter: blur(20px)`
- Fonts: **Manrope** for headings/metrics, **Inter** for body/labels
- Text color: never `#000000`, always `var(--heading)` (`#0d1c2e`)
- Shadows: ambient only — `box-shadow: 0 20px 40px rgba(13,28,46,0.06)`

The gviz API URL includes a cache-busting timestamp parameter to prevent stale data.
