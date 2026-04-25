# CovenantIQ — Credit Agreement Intelligence

Upload a credit agreement PDF. Get instant covenant extraction, compliance checking, and portfolio monitoring — without manual data entry.

## What it does

- **Upload credit agreements** — Drop a PDF, get all covenants extracted automatically
- **Compliance checking** — Enter current financial metrics, see pass/breach instantly
- **Portfolio tracking** — Save and track multiple agreements

## Quick Start

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Copy your project URL and anon key

### 2. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/benvisionhub/covenant-monitor)

Or from CLI:

```bash
npm i -g vercel
vercel --prod
```

### 3. Configure environment variables

In Vercel project settings, add:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |

### 4. Run locally

```bash
npm install
npm run build
npm run server
# Visit http://localhost:3001
```

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Express.js (serverless on Vercel)
- **Database:** Supabase (PostgreSQL)
- **PDF Parsing:** pdf-parse
- **Deployment:** Vercel

## How covenant extraction works

The parser uses regex patterns to identify covenant language in credit agreements:

- **Leverage Ratio** — "Total Debt/EBITDA shall not exceed X"
- **Interest Coverage** — "EBITDA/Interest shall not be less than X"
- **Liquidity** — "Current Ratio shall not be less than X"
- **Net Worth** — "Tangible Net Worth shall not be less than $X"
- **CapEx** — "Capital Expenditures shall not exceed $X"

## Limitations

- Regex-based extraction works best on standard credit agreement language
- Complex or unusual covenant phrasing may not be detected
- Covenant-lite agreements may return 0 covenants
- For production use, add human review of extracted covenants

## Roadmap

- [ ] Claude-powered covenant extraction (ML layer)
- [ ] Trajectory forecasting (breach probability)
- [ ] PDF generation for compliance reports
- [ ] Multi-user / team support
- [ ] Direct NetSuite/QuickBooks integration
