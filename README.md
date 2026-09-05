# Personal OS

A private operating system for one person: the day, the two businesses, the
money, the people, and what keeps going wrong. It grew out of a 126-day
protocol, which is still the spine of the daily scoring.

Nine sections: **Today** (plan, log, review), **Patterns**, **Money**,
**Learn**, **Network**, **Life**, **Progress**, **Review** and **Settings**.

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
goals, learning, connections — because merging those by id would resurrect anything
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

**Today** runs the day in three passes, and they are separate on purpose — the
morning form has to be fast, the night form has to be honest, and one screen
doing both ends up being neither.

- **Plan** — three priorities, ranked. The first is the day's one thing. An
  optional set of time blocks gives the day a shape, and the six-tap morning
  ritual sits underneath.
- **Log** — training, then the four scored pillars. The numbers, as they were.
- **Review** — grade the three against what actually happened, rate the energy,
  write the win, the mistake and the lesson, tag the loops that ran, answer the
  nightly questions, and set tomorrow's three.

Tomorrow's three are written into tomorrow's record directly, so they are
waiting when the morning form opens. Deciding what matters at 7am is how days
get handed to whoever shouts loudest.

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

**Patterns** is the accountability screen, and nothing on it is typed in — it is
all read back out of what was logged, which is the only reason it carries any
weight. Every section stays silent until it has enough days behind it to be
saying something rather than guessing.

- **Plan versus reality** — how often the day's one thing actually landed, and
  what writing the plan down is worth in points per day.
- **Your loops** — how often each named pattern fired, whether it is rising or
  easing, and how many days straight it has been running. Trends compare *rates*
  across the two halves of the window, not raw counts, so an early protocol
  can't make every loop look like it's getting worse.
- **Carried, not done** — the same intention rewritten and left open, ranked by
  the longest unbroken run rather than by total misses. A standing item you
  sometimes miss is not the same as a wall; this list is the walls.
- **What breaks a day** — what is measurably different about days under 50
  against winning days. Correlation, not cause, but it is where to look first.
- **Standards you drop**, ranked by what they cost rather than how often they
  slip, and **average score by day of the week**.

Loops have to be a thing you *pick* rather than a thing you write — free text
can't be counted, and that is what makes any of this possible. The starting set
lives in `src/lib/config.ts` and is edited in **Settings → Loops**; a generic
loop never gets ticked, so make them yours. Archiving keeps a loop out of the
nightly list without erasing the days it already explains.

**Learn** is the education log. A book, a course and a conference are the same
object — a source you spent time on — so they share one list and one capture
flow. Each carries **lessons**, and a lesson has an action attached: a lesson
with no action is a highlight, and highlights change nothing. The Lessons filter
shows every lesson across every source, with the unapplied ones called out.

**Network** is the people, and when you last actually spoke to them. Set a
cadence — weekly, fortnightly, monthly, quarterly — and the relationships going
quiet come to you instead of being remembered by accident. Status runs target →
reached out → connected → inner circle.

**Life** holds the rest of the long game:

- **Upkeep** — recurring tasks with an interval. Haircut every 14 days ships by
  default. Ticking one restarts its clock from today, and anything past its
  interval shows as due.
- **Goals** — what you're aiming at, with an optional target date.

## Adjusting it

Daily targets, the financial targets and the Day 1 date all live in **Settings**.
Changing a target re-grades every day against the new number, including past
ones.

The checklist itself and its point weights are in `src/lib/config.ts` — the
points within each pillar must add up to that pillar's allocation. The loop
list, the nightly questions and the default day shape live there too.

## Stack

React 19 + TypeScript + Vite. Charts are hand-rolled SVG — no charting library.
State lives in `src/lib/store.ts` and persists to `localStorage` under
`protocol126:v1`; `src/lib/sync.ts` mirrors it to Supabase when configured.
`src/lib/selectors.ts` holds every derived number, including the whole pattern
engine — the screens do no analysis of their own.

The state document is at version 2. v1's flat `books` array is folded into
`learning` on load, and v1 connections gain their cadence fields, so an older
backup restores without losing anything.

The whole state is one versioned JSON document, so the server schema is a single
`jsonb` column — adding a field to the app needs no migration. When the Supabase
env vars are absent, Vite folds the client out at build time and the bundle
drops from ~140KB gzipped to ~80KB.

The chart palette (`--series-*` and the gold ramp in `src/styles.css`) was
validated for colour-blind separation and contrast against the app's dark
surface. If you change those hexes, re-validate rather than eyeballing them.
