# 126 — Complete Comeback

A private operating system for the 126-day protocol. Daily scorecard, weekly
review, compounding totals, and a financial scoreboard covering ACMR, 1Media and
personal money.

Everything is stored in the browser on the device you use it on. There is no
account, no server and no sync — which also means clearing site data wipes it, so
export a backup from Settings now and then.

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

## Put it on your phone

```bash
npm run build
```

The build lands in `dist/` and works from any static host. The included GitHub
Actions workflow publishes it to GitHub Pages on every push to `main` — enable it
under **Settings → Pages → Source: GitHub Actions**, then open the Pages URL on
your phone and use **Share → Add to Home Screen**. It launches full-screen with
no browser chrome.

Each device keeps its own data. To move a log between phone and desktop, export a
backup from Settings on one and restore it on the other.

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

**Money** tracks two things that are easy to confuse:

- **Bank balances** — a point-in-time reading per account (ACMR, 1Media,
  personal). The most recent reading is the current balance; the history draws
  the curve. The €10M target is measured against the ACMR bank balance.
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

## Adjusting it

Daily targets, the financial targets and the Day 1 date all live in **Settings**.
Changing a target re-grades every day against the new number, including past
ones.

The checklist itself and its point weights are in `src/lib/config.ts` — the
points within each pillar must add up to that pillar's allocation.

## Stack

React 19 + TypeScript + Vite, no runtime dependencies beyond React. Charts are
hand-rolled SVG. State lives in `src/lib/store.ts` and persists to
`localStorage` under `protocol126:v1`.

The chart palette (`--series-*` and the gold ramp in `src/styles.css`) was
validated for colour-blind separation and contrast against the app's dark
surface. If you change those hexes, re-validate rather than eyeballing them.
