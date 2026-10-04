# Replay Lab Pro

A free, mobile-first **US30 historical replay and manual backtesting workstation** built for a discretionary, ICT-style workflow.

You are the decision-maker. The app replays real price candle by candle and records what *you* mark, plan, and decide. It never detects setups, generates signals, or trades for you.

## Core workflow

Analyze → Mark liquidity → Identify POI → Observe sweep → Identify displacement → Confirm MSS → Plan entry → Set SL/TP → Replay forward → Record result → Journal → Review

## What's built

### Replay engine
- Runs on real US30 M1 history, with a start date and time you choose.
- **The replay clock is the single source of truth.** A candle is complete only when `open + timeframe <= clock`.
- The forming candle is built only from M1 candles that have fully closed before the clock, so no future highs, lows, or closes are exposed.
- Controls: play, pause, +1, +10, jump to a time, reset to start. Speeds: 0.5×, 1×, 2×, 4×, 8×, 16×.
- Weekend, holiday, and session gaps are skipped using candle timestamps only, never future prices.
- Moving the clock backward rewinds any trade state that only existed in the "future".

### Multi-timeframe
- M1, M5, M15, M30, H1, H4, all aligned to the same replay timestamp.
- Higher timeframes are aggregated on the client from M1 data.
- Switching the view timeframe does not reset the replay.
- Scroll left on the chart to load older history without moving the clock. If the loader hits a data gap, it widens the lookback until it finds candles.

### Chart and drawings
- Built on [lightweight-charts](https://github.com/tradingview/lightweight-charts) with a custom drawing overlay.
- **MT5-style touch navigation:**
  - Drag horizontally to pan time and pinch to zoom.
  - Drag the price axis to scale price. Double-click an axis to reset it. One-finger vertical drag deliberately does not pan price.
  - Long-press shows the crosshair, and it stays until your next tap.
  - A **»** button jumps back to the latest candle when you have scrolled away, and an **A** button turns price auto-scale back on after you have scaled manually.
- OHLC legend with candle change and percent, plus day separators labelled with weekday and date in your session timezone. Session bands are shaded from session high to low and stop at the last revealed candle.
- Manual tools, grouped as:
  - **Liquidity:** BSL, SSL, PDH, PDL, Asia H/L, London H/L, Session H/L, Custom
  - **Structure:** HH, HL, LH, LL, MSS
  - **POI:** FVG, Order Block, Custom POI
  - **Price action:** Sweep, Displacement
  - **General:** horizontal line, trend line, rectangle/zone, arrow, text note
- Undo/redo (100 steps per session, kept in memory only), delete, optional magnet-to-OHLC, and an option to keep the tool active.
- Session bands (Asia / London / New York) and a configurable trading window.
- Each drawing stores the replay time it was created at, so later review stays honest.

### Analysis, trade planning, and outcomes
- **Analysis panel:** HTF/current bias, DOL, ERL, IRL, premium/discount, liquidity levels, structure, sweep, displacement, FVG, OB, setup type, direction, confidence (1–5), and reasons for trade or no-trade. Everything is typed by you.
- **Trade planner:** direction, entry, SL, TP, with R:R and result in R calculated for you. Levels are shown on the chart.
- **Automatic bookkeeping only:** a planned trade becomes *active* when replayed price reaches your entry, and *closed* when your SL or TP is touched. It records max favorable and adverse excursion in R.
- **Ambiguous candles:** if one M1 candle touches both SL and TP, the outcome is treated pessimistically (stop first).
- **Chart snapshots:** a before-trade snapshot is captured on demand and an after-trade snapshot is captured automatically when the trade closes. Snapshots are full-size (rendered at 2–3× pixel ratio), are taken only after the chart layout has settled, and leave out the floating chart buttons.
- **12-step workflow checklist** in the workspace, with a step-by-step page at `/backtest`.

### Demo account and live P&L
Every journaled trade also runs through a simulated US30 demo account, so you can see results in dollars as well as R.

- **Account:** starts at $1,000 with a flat $25 risked per trade (2.5% of the starting balance). P&L per trade is result in R × $25. Risk does not compound with the balance.
- **Position sizing:** the trade planner shows risk in dollars, risk percent, and an automatic lot size. US30 is simulated at $1 per point per 1.00 lot, so lot size is $25 divided by your SL distance in points.
- **Live position:** until a trade closes, the planner shows the current price, unrealized P&L in dollars, and the live R multiple.
- **Statistics page:** balance, total P&L, return percent, max drawdown (dollars and percent), and a per-trade equity curve.
- The starting balance and risk amount are constants in `src/lib/backtest/account.ts`. They are not editable in Settings yet.

### Journal and statistics
- Records both **trades** and **no-trade decisions** (no trade, setup invalidated, missed setup, did not meet rules, poor conditions, waiting for confirmation, other).
- Each record keeps the analysis, trade, drawings, mistakes, notes, session, and before/after chart snapshots.
- **Statistics** cover trades, no-trades, wins, losses, breakeven, win rate, total R, average R, average win/loss, largest win/loss, and win/loss streaks. They also break down by setup type, direction, session, and no-trade reason.
- Statistics are for self-review only, never signals.

### Sessions and settings
- Replay sessions can be paused and resumed, and they keep the clock, drawings, analysis, and trade.
- Settings: trader name, theme, default timeframe and speed, session timezone, Asia/London/New York/trading-window times, session and window overlays, volume, magnet, keep-tool-active, and lookback candles.
- **Session logic always uses `America/New_York`** and never the device timezone.
- Default trading window: 09:45–12:00 NY (configurable).

## Data

Market data comes from **Supabase Storage** and is read through the `MarketDataProvider` interface. The mock provider is not used in the production data path.

- **Bucket:** `market-data-file`
- **Layout:** `US30/M1/YYYY/YYYY-MM.csv`, one M1 file per month
- **CSV columns:** header row, then `DateTime, Open, High, Low, Close, Volume`
- **Timestamps:** UTC by default. Set `VITE_CSV_TIME_MODE=ny7` if your files use broker time (New York + 7 hours).
- **Access:** market data is read with the anonymous Supabase role and no login session.
- **Loading:** only the months needed are downloaded, with an in-memory LRU cache of 4 months. Missing months are treated as empty.
- **Data page:** shows dataset status, candle range, and count. The candle count shown there is currently hard-coded, not computed.

Upload local CSVs with:

```sh
node upload-m1-to-supabase.mjs
```

The script reads `data/us30/M1/**/*.csv` (git-ignored) and needs `.env.local` (see below). Files that already exist in the bucket are skipped, and it currently skips `US30/M1/2016/2016-10.csv` by name.

## Persistence

There is **no login**. The app is single-owner: everything is stored under one constant owner ID (`src/lib/owner.ts`). An email sign-in flow was built and then removed, so treat a deployment as private and single-user.

| Data | Where it lives |
| --- | --- |
| Sessions, drawings, analysis, trades | Supabase table `user_state` (key `ict-terminal.sessions.v1`) |
| Journal records | Supabase table `user_state` (key `ict-terminal.journal.v1`) |
| Chart snapshots | Supabase Storage bucket `chart-snapshots`, indexed in table `chart_snapshots` |
| Settings | `localStorage` only (`ict-terminal.settings.v1`), so they are per device |

How syncing behaves:

- **Supabase is the source of truth** for sessions and the journal. A copy is kept in `localStorage` under `cache:<key>` as an offline fallback.
- Saves are debounced by 1.5 seconds, retried every 8 seconds if they fail, and flushed immediately when the tab is hidden.
- If a key is missing in Supabase but present in the local cache, the cached copy is uploaded.
- Snapshots upload to Supabase first. If that fails, the image is kept in IndexedDB (`replay-lab-pro.snapshots`) and uploaded the next time it is opened.
- Clearing site data no longer wipes sessions, journal, or snapshots, but it does reset settings.

The repo does not include Supabase migrations yet. The app expects:

- `user_state` with columns `user_id`, `key`, `value`, `updated_at`, unique on (`user_id`, `key`)
- `chart_snapshots` with columns `id`, `user_id`, `session_id`, `kind`, `journal_record_id`, `created_at`
- Storage buckets `market-data-file` and `chart-snapshots`
- Policies that let the anon key read and write them, since there is no login

## Tech stack

TanStack Start and Router · React 19 · Vite · Tailwind CSS 4 · Radix UI / shadcn · Zustand · lightweight-charts 5 · Recharts · html-to-image · Supabase (Postgres and Storage) · Vitest · deployed on Netlify.

## Getting started

Requires Node.js and npm (or bun).

```sh
git clone https://github.com/hdosman040-debug/replay-lab-pro.git
cd replay-lab-pro
npm i
```

Create `.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
# optional: VITE_CSV_TIME_MODE=ny7
```

These are needed for both market data and persistence. Without them the app cannot load history or save sessions.

Then run:

```sh
npm run dev
```

Other scripts: `npm run build`, `npm run build:dev`, `npm run preview`, `npm run lint`, `npm run format`.

### Tests

```sh
npx vitest
```

The replay engine tests (`engine.test.ts`) and the time helper tests are self-contained. The diagnostic and integration tests (`supabaseProvider.*`, `supabaseStorage.inspect`, `check-apr13*`, `supabase.integration`) read the live Supabase bucket, so they need valid env vars and the data uploaded.

### Deploy

Netlify runs `npm run build` and publishes `dist/client` (see `netlify.toml`). Set the two `VITE_SUPABASE_*` variables in the Netlify site settings.

## Project structure

```
src/
  routes/          Replay (/), Backtest, Journal, Statistics, Data, Settings
  components/      chart, workspace (tool strip, panels, sheets, trade levels), journal, layout, ui
  hooks/
  lib/
    market/        MarketDataProvider, Supabase provider, aggregation
    replay/        replay engine (no UI dependency) and hooks
    drawings/      tool definitions and drawing types
    backtest/      analysis, trade, journal types, statistics, demo account
    snapshots/     chart snapshots (Supabase Storage with IndexedDB fallback)
    store/         Zustand stores (sessions, journal, settings, UI) and Supabase-backed storage
    time/          New York timezone and session helpers
    supabaseClient.ts, owner.ts
```

The replay engine, market provider, drawings, and journal are kept independent of each other.

## Principles

- No automated trading, signals, or auto-detected liquidity, FVG, OB, sweep, or MSS.
- No future-data leakage, ever.
- The chart is the product; everything else stays out of its way.
- Optimize for replay accuracy, manual analysis speed, honest journaling, and Android performance.

## Built with Lovable

Created with [Lovable](https://lovable.dev) and [editable there](https://lovable.dev/projects/27c3d16a-3f60-468c-b1a2-8d57682c9402). Changes made in Lovable are committed to this repository, and pushes to `main` sync back into Lovable.
