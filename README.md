# 126 — Complete Comeback

A private operating system for the 126-day protocol. Daily scorecard, weekly
review, compounding totals, and a financial scoreboard covering ACMR, 1Media and
personal money.

It runs local-first: every edit is written to the device immediately and the app
works with no network. Configure Supabase (below) and it also syncs across your
devices; leave it unconfigured and it stays purely local.

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

## Sync across devices (optional)

Sync is off until you configure it. Setting it up is four steps:

1. Create a project at [supabase.com](https://supabase.com) (free tier is ample —
   the whole dataset is one row).
2. Open **SQL Editor**, paste in [`supabase/schema.sql`](supabase/schema.sql) and
   run it. That creates one table and the row-level security policies that stop
   anyone reading a row that isn't theirs.
3. Copy `.env.example` to `.env.local` and fill in the two values from
   **Project Settings → API**. The anon key is meant to be public and ships in
   the client bundle — RLS is what protects the data. Never put the
   `service_role` key here.
4. Restart the dev server, open **Settings → Sync**, and create an account. Sign
   in with the same account on your other device.

Under **Authentication → Providers**, turning off "Confirm email" makes signup a
single step. Leave it on if you'd rather verify the address.

### How conflicts resolve

Whichever device wrote last wins outright for the lists — ledger, balances,
goals, books, connections — because merging those by id would resurrect anything
you'd deleted elsewhere.

Days and weeks merge by key instead: logging Tuesday on your phone and Wednesday
on the Mac keeps both. Only when the *same* day was edited on both devices does
the newer edit win. That's the case that actually comes up, and the one worth
getting right.

Export a backup occasionally regardless. Sync replicates a bad edit to every
device; only a backup undoes one.

## Put it on your phone

```bash
npm run build
```

The build lands in `dist/` and works from any static host.

**Vercel** is the recommended host — it deploys from a private repo for free,
which GitHub Pages does not. Import the repo at
[vercel.com/new](https://vercel.com/new); `vercel.json` already sets the build
command, output directory and SPA rewrites. Add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` under **Project Settings → Environment Variables**, or
sync stays off in the deployed build.

Then open the deployment URL on your phone and use **Share → Add to Home
Screen**. It launches full-screen with no browser chrome.

A GitHub Actions workflow for GitHub Pages is also included, for the case where
the repo is public — enable it under **Settings → Pages → Source: GitHub
Actions**. Note that Pages will not serve a private repo on the free plan.

## How it works

**Today** is two forms. The morning one is six taps and nothing else. The
end-of-day one is where the day actually gets logged and graded.

Scoring is out of 100 across four pillars — Business 30, Body 30, Mind 20,
Discipline 20. Rows carrying a number (hours, protein, steps, sleep) are graded
off the number itself rather than a separate tick, so the score can never
disagree with the data. Tapping the circle on one of those rows fills it to
target. 80+ counts as a winning day and keeps the streak alive.

Training and scheduled recovery are separate. A recovery day satisfies the
10-hour and training standards without penalty — recovery is part of the plan.

**Money** tracks three things that are easy to confuse:

- **Bank balances** — a point-in-time reading per account (ACMR, 1Media,
  personal). The most recent reading is the current balance; the history draws
  the curve. The €10M target is measured against the ACMR bank balance.
- **Net worth** — a separate manual figure covering property, investments and
  anything that never touches those three accounts. It is deliberately *not*
  the three balances added up, and gets its own chart.
- **The ledger** — individual revenue, cash-collected, profit and payout events,
  attributed to ACMR or 1Media.

The rewards stay locked until *payout received* reaches €1M. Received, not
invoiced, not projected.

**Progress** aggregates every logged day into the 126-day totals — 1,080 ACMR
hours, 108 workouts, a million steps, 63 hours of reading, and the rest — each
with a pace marker showing whether you're ahead of or behind where that total
should be by now.

**Review** is the Sunday page: weight and waist, the week's revenue pulled from
the ledger, deals and pipeline, and the week's average score day by day.

**Life** holds the things that outlast a single day:

- **Upkeep** — recurring tasks with an interval. Haircut every 14 days ships by
  default. Ticking one restarts its clock from today, and anything past its
  interval shows as due.
- **Goals** — what you're aiming at, with an optional target date.
- **Books** — queued → reading → read, filterable. The daily standard is 20
  pages; the 126-day total is 2,520.
- **People to connect with** — target → reached out → connected.

## Adjusting it

Daily targets, the financial targets and the Day 1 date all live in **Settings**.
Changing a target re-grades every day against the new number, including past
ones.

The checklist itself and its point weights are in `src/lib/config.ts` — the
points within each pillar must add up to that pillar's allocation.

## Stack

React 19 + TypeScript + Vite. Charts are hand-rolled SVG — no charting library.
State lives in `src/lib/store.ts` and persists to `localStorage` under
`protocol126:v1`; `src/lib/sync.ts` mirrors it to Supabase when configured.

The whole state is one versioned JSON document, so the server schema is a single
`jsonb` column — adding a field to the app needs no migration. When the Supabase
env vars are absent, Vite folds the client out at build time and the bundle
drops from ~140KB gzipped to ~80KB.

The chart palette (`--series-*` and the gold ramp in `src/styles.css`) was
validated for colour-blind separation and contrast against the app's dark
surface. If you change those hexes, re-validate rather than eyeballing them.
