# Personal OS

A private operating system for one person: the day, the two businesses, the
money, the people, and what keeps going wrong. It grew out of a 126-day
protocol, which is still the spine of the daily scoring.

Twelve sections: **Home**, **Today** (plan, log, review), **Work**,
**Patterns**, **Map**, **Money**, **Learn**, **Network**, **Goals**,
**Progress**, **Review** and **Settings**.

It is black and white on purpose — no hue anywhere. Emphasis is contrast, so
what needs attention goes bright and what is fine recedes. Dark is the default;
**Settings → Appearance** flips the ground to paper.

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

```bash
npm test
```

The engines are covered: scoring, the plan loop, the pattern detection, the
oscillation, the life-map roll-up, the pipeline, goal key results, the trackers,
the calendar repeats and the money selectors. They are what the app is *for* — a
wrong derived number is worse than a missing one, because it still looks like
data — so the tests gate the deploy.

The same run enforces performance budgets against a year of days, 300 tasks and
80 deals. Everything derived runs in under a millisecond there, and a whole
screen's worth together is about 3ms; the budgets sit far enough above that to
survive a slow CI box while still catching anything that goes quadratic. The
figures from the last run land in `perf-report.json`.

## Offline

The app works with no network at all, not just without sync. A service worker
caches the shell and the built assets, so it opens on a plane once it has been
opened once. Built assets carry a content hash and are served cache-first;
`index.html` is fetched network-first and falls back to its cached copy, which
is what lets a new deploy be picked up while an offline launch still works.

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

- **Bank balances** — a point-in-time reading per account (Consulting.ie, 1Media,
  personal). The most recent reading is the current balance; the history draws
  the curve. The €10M target is measured against the Consulting.ie bank balance.
- **Net worth** — a separate manual figure covering property, investments and
  anything that never touches those three accounts. It is deliberately *not*
  the three balances added up, and gets its own chart.
- **The ledger** — individual revenue, cash-collected, profit and payout events,
  attributed to Consulting.ie or 1Media.

The rewards stay locked until *payout received* reaches €1M. Received, not
invoiced, not projected.

**Progress** aggregates every logged day into the 126-day totals — 1,080 Consulting.ie
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

**Map** is the life map, and it opens as a **board** rather than an outline:
Alex at the centre, domains on a ring around him, sub-domains on the ring beyond
— drag a branch to place it, drag the background to pan, scroll to zoom. Solid
lines are structure; dashed arrows are the causes you asserted, drawn
differently because they are a different kind of claim. Dragging a branch stamps
its position and opts it out of the automatic layout for good, so a map you have
arranged by hand stays arranged while anything you add later still places
itself; **Tidy** hands everything back to the layout. An **Outline** view is
still there for scanning scores quickly.

Underneath it is the same tree: Alex at the root, domains under him, sub-domains
under those, as deep as is useful. It is not a mind-map — every node scores off the
standards and metrics bound to it, and a node with no bindings of its own takes
the mean of its children, so a branch can be *shown* to be weak rather than felt
to be weak. Cause-to-effect links between branches ("short sleep and the day
gets reactive") are asserted by hand and labelled as beliefs; the app never
infers one. Patterns can then narrow its loops and standards to any branch.

**Your two versions** sits at the top of Patterns. A seven-day rolling mean
against the long mean says which version of you is currently running: above the
line is the one that builds, below it the one that tears the work down. The mean
itself is the honest number — it is the version that actually shows up on
average, and the drift in it is the only progress that survives a bad week.
Unlogged days carry the last known value rather than counting as zero, which
would invent a crash out of a day you simply didn't open the app.

**Work** covers both businesses:

- **Tasks** split by how late they already are — overdue, today, this week, undated
- **Projects**, with their task completion
- **Clients**, with MRR and a warning when one of them is more than 40% of it
- **Pipeline** — deals weighted by their own probability, and anything that
  hasn't moved in a fortnight flagged as stopped, whatever its stage says

**Goals** is a ladder: lifetime → ten years → three years → this year → this
quarter, each goal naming the longer one it serves and the branch of the map it
sits on. Key results underneath read themselves out of the money and the daily
metrics wherever they can, because a hand-typed percentage is out of date the
moment it's typed. **Upkeep** — recurring tasks with an interval — lives here
too; ticking one restarts its clock from today.

The **+** button in the corner is on every screen: one field that adds a task, a
priority into today's three, a goal, a person or a deal. Today's slots fill left
to right, and when all three are taken it says so rather than quietly dropping
what you typed.

Press **⌘K** (or Ctrl-K) anywhere to search everything — sections, tasks,
projects, clients, deals, goals, lessons, people, branches, loops, and every
priority you've ever written. Type something that matches nothing and it offers
to capture it as a task instead, because the worst outcome is losing the thought
while looking for somewhere to put it.

**Money** splits in two. *Accounts & ledger* is the original scoreboard.
*Bills, sheet, invoices* adds what balances alone can't answer:

- **Bills** — every recurring cost normalised to a monthly figure, whatever its
  cadence, split by business, with what falls due this week
- **Runway** — cash divided by monthly burn, per purse. It reports nothing
  rather than infinity when no bills are recorded, because an unknown runway and
  an endless one are not the same thing
- **Balance sheet** — assets and liabilities itemised, so net worth is
  calculated. The old manual snapshot stays as the fallback until you itemise,
  and once you have, a disagreement between the two is called out
- **Invoices** — outstanding, overdue, and the average days you actually get paid

**Home** answers one question: what needs me right now. Today's one thing, which
version is running, everything overdue or at risk across every section, and a
capture box for anything that turns up. It owns no data of its own.

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
