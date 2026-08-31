# Sue’s Admin Dashboard

Standalone Phase 1 static dashboard for privacy-first personal admin.

## Scope

- HTML, CSS and vanilla JavaScript only.
- Browser `localStorage` only.
- No client data.
- No credentials.
- No real email addresses.
- No calendar, email or practice-management integrations.
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

If Vercel CLI is authenticated and the project is linked from this directory:

```bash
vercel --prod
```

If the project has not been linked yet:

```bash
vercel link
vercel --prod
```

When prompted, select this directory as the project root. Keep the project static; no build command is required.
