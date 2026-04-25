# CovenantIQ — Credit Agreement Intelligence

Upload a credit agreement PDF. Get instant covenant extraction, compliance checking, and portfolio monitoring — no manual encoding.

**Live:** https://covenant-monitor-nu.vercel.app
**GitHub:** https://github.com/benvisionhub/covenant-monitor

## What it does

- **Upload credit agreements** — Drop a PDF, get covenants extracted automatically
- **Compliance checking** — Enter current financial metrics, see pass/breach instantly
- **Portfolio tracking** — Save and track multiple agreements
- **Forward-looking** — Headroom calculation shows how close you are to breach

## Setup

### 1. Supabase (free tier)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase-schema.sql`
3. Copy your project URL and anon key

### 2. Vercel environment variables

In your Vercel project settings, add:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Your anon key |

### 3. Redeploy

After adding env vars, trigger a redeploy in Vercel dashboard.

### 4. Run locally

```bash
npm install
npm run build
npm run server
# Visit http://localhost:3001
```

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Express.js (Vercel serverless)
- **Database:** Supabase (PostgreSQL)
- **PDF Parsing:** pdf-parse (regex-based covenant extraction)
- **Deployment:** Vercel

## How covenant extraction works

Regex patterns detect standard credit agreement language:

| Type | Detects |
|------|---------|
| Leverage Ratio | "Debt/EBITDA shall not exceed X" |
| Interest Coverage | "EBITDA/Interest shall not be less than X" |
| Liquidity | "Current Ratio shall not be less than X" |
| Net Worth | "Tangible Net Worth shall not be less than $XM" |
| CapEx | "Capital Expenditures shall not exceed $XM" |

## Limitations

- Regex extraction works best on standard credit agreement language
- Complex or non-standard phrasing may be missed
- Covenant-lite agreements may return 0 covenants
- For production: add human review of extracted covenants

## Roadmap

- [ ] Claude-powered ML extraction layer (handle non-standard phrasing)
- [ ] Trajectory forecasting — breach probability before it happens
- [ ] PDF compliance report generation
- [ ] Direct NetSuite/QuickBooks integration
- [ ] Multi-user / team support
