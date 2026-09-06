# Sue’s Admin Dashboard

Standalone Phase 1 static dashboard for privacy-first personal admin.

## Scope

- HTML, CSS and vanilla JavaScript only.
- Browser-only: admin dashboard data uses `localStorage`; the Clinical Note
  Formatter uses page memory only.
- No client data.
- No credentials.
- No real email addresses.
- No calendar, email or practice-management integrations.
- Clinical note formatting is local, temporary preparation only. It does not log
  in, call APIs, automate record entry, or write to Feelgood or Awarely.
- Any future integration requires practice approval before connection.

## Features

- Today workload busy blocks with generic editable labels.
- Action queue task create, read, update, complete and delete.
- Upcoming deadlines create, read, update and delete, with dates and reminder lead time.
- Quick capture for general notes.
- Information for Xena form with:
  - preferred schedule
  - inbox labels and purposes, without email addresses
  - recurring deadlines and reminder lead times
  - approvals status
  - dashboard preferences
- Downloadable JSON backup of the full dashboard state.
- Downloadable text export of the Information for Xena notes for attaching in Telegram.
- JSON import for restoring a previously exported dashboard backup after confirmation.
- Empty reset and demo data reset.
- Mobile-first responsive layout.
- Personal Health tracker (local browser only, separate from all other data) with:
  - daily 35-minute activity check for each day of the current week
  - two strength sessions per week counter with mark and undo
  - two yoga or Pilates sessions per week counter with mark and undo
  - week-of date label and per-target progress summary
  - reset-week control with explicit confirmation
  - explicit privacy notice; excluded from export, import, Xena, clinical note formatter and any network request
- DOM-only Clinical Note Formatter with:
  - practice selector for Feelgood or Awarely
  - generic clinically neutral note layout selector
  - de-identified raw notes input
  - optional non-identifying session details
  - editable generated preview
  - copy formatted note and clear all controls

## Run Locally

Open `index.html` directly in a browser.

You can also run a local static server from this folder:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Data Storage

Data is stored only in the current browser under this localStorage key:

```text
sueAdminDashboard:v1
```

The export buttons create local downloads only. Nothing is sent by the dashboard.

The Clinical Note Formatter is not stored under `sueAdminDashboard:v1`. Its
input and generated preview live only in the current page DOM while the page is
open. The formatter is excluded from localStorage, demo data, imports, exports
and JSON backups.

The Personal Health tracker is stored under its own dedicated key:

```text
sueAdminDashboard:health:v1
```

Only wellbeing habit completions (daily activity, strength sessions, yoga or
Pilates sessions) for the current week are stored. Personal Health is a
separate concern from clinical, practice and dashboard data. It is excluded
from `sueAdminDashboard:v1`, from demo data, from JSON export and import, from
the Information for Xena text export, from the Clinical Note Formatter, and
from any network or API request. Do not enter symptoms, diagnoses, medications
or any real health information; it is a habit checklist only.

The formatter does not auto-fill client details and should only be used with
de-identified working text. Do not paste names, dates of birth, contact details,
addresses, identifiers, credentials or other client-identifying information.

## Import And Backup

Use **Export JSON backup** before switching devices, changing browsers or clearing
browser data. The JSON file contains the dashboard state stored in this browser:
captures, busy blocks, tasks, deadlines and Information for Xena fields.

Use **Import JSON** to restore a dashboard backup created by this app. The import
checks that the file has the required top-level `state` structure, then asks for
explicit confirmation before replacing the current browser's local data.

The text export is for sharing the Information for Xena notes only. It is not a
full dashboard backup.

## Deployment

This dashboard is currently maintained for local-only use. Do not deploy or
connect it to practice systems without explicit practice approval.
