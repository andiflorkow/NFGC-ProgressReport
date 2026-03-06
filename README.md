# NFGC Family Reports

Next.js application for coach staff to manage gymnasts, build monthly reports, review outgoing family emails, and generate server-side PDFs.

## Current Architecture

- Next.js App Router with route-based pages for Dashboard, Gymnasts, Gymnast Profile, Report Builder, Needs Updating, Email Review, and Settings.
- Light theme by default with optional dark mode toggle in Settings.
- Server-side JSON storage in `data/db.json` via API routes.
- Server-side PDF generation with `pdf-lib`.

## API Routes

- `GET /api/data` returns app data.
- `PUT /api/data` saves app data.
- `POST /api/reports/:reportId/pdf` generates and saves PDF, then returns PDF bytes.
- `GET /api/reports/:reportId/pdf` returns latest saved PDF.
- `POST /api/reports/:reportId/send` generates PDF, emails it to guardian recipients, and records send history.
- `POST /api/email/test` sends a plain SMTP test email.
- `GET /api/health/pdf` verifies PDF library health.

## SMTP Configuration

Create `.env.local` with:

```bash
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM="NFGC Reports <reports@yourgym.com>"
```

Notes:
- Use `SMTP_SECURE=true` for SSL/TLS SMTP ports (commonly `465`).
- Use `SMTP_SECURE=false` for STARTTLS ports (commonly `587`).

## Provider Presets

Use these as starting points when sharing setup docs with other gyms.

### Outlook / Microsoft 365

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Gmail

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

### SendGrid SMTP

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=<your-sendgrid-api-key>
```

### Mailgun SMTP

```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
```

### Postmark SMTP

```bash
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_SECURE=false
```

Tip:
- Open `Settings` and use `Send Test` to verify SMTP before sending monthly reports.

## File Storage

- Place logo at `public/images/nfgc-logo.png`.
- Generated PDFs are saved under `uploads/reports/{gymnastId}/{month}.pdf`.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run start
```
