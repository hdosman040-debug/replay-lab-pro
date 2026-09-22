# Replay Lab

Build: ICT Trade Terminal — US30 Replay & Manual Backtesting Workstation

Product Mission

Build a powerful, free, Android-first US30 historical replay and manual backtesting workstation designed for an ICT-style discretionary trading workflow.

The primary purpose of this application is NOT automated trading, signal generation, or automatic strategy testing.

The trader must remain the decision-maker.

The application provides:

Historical US30 market data

A high-quality chart

Historical replay

Timeframe navigation

Manual drawing and annotation

Manual trade planning

Trade journaling

Backtesting records

Performance statistics

The core workflow is:

Analyze → Mark Liquidity → Identify POI → Observe Sweep → Identify Displacement → Confirm MSS → Plan Entry → Set SL/TP → Replay Forward → Record Result → Journal → Review

1. CORE PRODUCT PRINCIPLE

The application should feel like a dedicated trading laboratory, not a generic dashboard.

The chart and replay engine are the center of the application.

Do NOT build:

An automated trading bot

A buy/sell signal generator

Automatic liquidity detection

Automatic FVG detection

Automatic OB detection

Automatic sweep detection

Automatic MSS detection

An automatic ICT strategy tester

The trader manually identifies and marks these concepts.

The software should make manual analysis extremely fast and intuitive.

2. PRIMARY FEATURE: US30 HISTORICAL REPLAY

Build a robust replay engine.

The trader must be able to:

Select US30

Select timeframe

Select historical date

Select exact starting time

Start replay

Pause replay

Resume replay

Step forward one candle

Change replay speed

Jump through the replay

Reset replay

Continue replay for long historical periods

Critical replay rule

Future candles must NOT be visible before the replay reaches them.

If replay begins at:

2024-05-10 09:45

the chart must behave as if the trader is actually at that historical moment.

No future-data leakage.

The trader must not be able to accidentally see future candles, future highs/lows, or future information through the UI.

The replay clock must be the single source of truth.

3. MULTI-TIMEFRAME ARCHITECTURE

The application must support a scalable timeframe architecture.

Initially design for:

M1

M5

M15

M30

H1

H4

The most important workflow is:

M30 → M15 → M5 → M1

Example:

M30/M15 = higher-timeframe context

M5 = primary setup/replay timeframe

M1 = execution/confirmation detail

Timeframes should remain synchronized to the same replay timestamp.

Changing timeframe must NOT destroy the replay state.

4. DATA ARCHITECTURE

Do NOT require the user's real historical US30 files during the initial build.

Use clean mock/sample market data initially so the entire workstation can be developed and tested.

However, design the architecture from day one so real historical data can later be connected through Supabase.

Create a clean abstraction such as:

MarketDataProvider

The initial implementation can use:

MockMarketDataProvider

Later it will be replaced/extended with:

SupabaseMarketDataProvider

The rest of the application should not need to be rewritten when real historical data is connected.

Do NOT hard-code the architecture around local CSV files.

5. FUTURE SUPABASE DATA MODEL

Prepare the architecture for historical US30 datasets with a standardized candle structure:

symbol

timeframe

timestamp

open

high

low

close

volume

Use UTC internally for stored timestamps.

The UI should convert timestamps appropriately for display and trading-session calculations, particularly:

America/New_York

The application must be designed so large historical datasets can eventually be loaded efficiently rather than downloading the entire dataset into browser memory.

Use range-based/paginated data loading where appropriate.

Do not implement the real Supabase historical dataset yet unless necessary for the architecture.

6. MAIN WORKSPACE

The primary screen should be a professional chart/replay workspace.

The chart should receive most of the screen.

Avoid burying important functionality inside multiple menus.

The user should be able to access important analysis tools quickly.

Suggested layout:

Top: replay/date/time/timeframe controls

Center: large interactive chart

Side or bottom: compact analysis/trade panel

Easily accessible drawing toolbar

Mobile-friendly collapsible panels

The UI must work extremely well on Android touchscreens.

Do NOT simply create a desktop UI and shrink it for mobile.

Design mobile-first.

7. CHART

Use a professional interactive financial charting library appropriate for web/mobile.

The chart should support:

Candlesticks

Zoom

Pan

Crosshair

Clear price scale

Clear time scale

Multiple timeframes

Replay-controlled candle visibility

Manual drawings

Trade levels

Zones

Notes

Price should be displayed clearly on the right side of the chart.

The chart must remain responsive even with large datasets.

8. MANUAL ICT DRAWING TOOLBAR

Create a highly accessible manual analysis toolbar.

Tools should include:

Liquidity

BSL

SSL

PDH

PDL

Asia High

Asia Low

London High

London Low

Session High

Session Low

Custom Liquidity

Structure

HH

HL

LH

LL

MSS

POI

FVG

Order Block

Custom POI

Price Action

Sweep

Displacement

General

Horizontal line

Trend line

Rectangle/zone

Arrow

Text/note

Delete

Undo

Redo

These are MANUAL drawing/annotation tools.

Do not automatically detect these concepts.

9. DRAWING EXPERIENCE

Make the drawing experience fast and intuitive, similar to professional trading platforms.

Users should be able to:

Tap a tool

Tap/drag on the chart

Create the marking

Move it

Resize it

Edit it

Delete it

Drawings should remain attached to the correct price/time coordinates when zooming or panning.

Do not make the user navigate through complicated dialogs for every drawing.

10. MANUAL ANALYSIS PANEL

Create a compact analysis panel where the trader can document the current market reasoning.

Fields should include:

Market Context

HTF Bias

Current Bias

DOL

ERL

IRL

Premium / Discount

Liquidity

BSL

SSL

PDH

PDL

Asia High

Asia Low

London High

London Low

Session High

Session Low

Structure

HH

HL

LH

LL

MSS

Setup

Sweep

Displacement

FVG

OB

Setup type

Direction

Reasoning

Analysis notes

Confidence

Reason for trade

Reason for no-trade

The panel should be fast to fill out and should not obstruct the chart.

11. TRADE PLANNING

Allow the trader to manually create a hypothetical trade.

Fields:

Direction

Entry

Stop Loss

Take Profit

Risk

Reward

R:R

Entry, SL, and TP should also be visually represented on the chart.

The trader should be able to drag the levels directly on the chart.

The application can calculate:

Risk distance

Reward distance

R:R

Result in R

But it must never automatically decide whether a trade should be taken.

12. MANUAL BACKTEST WORKFLOW

Create a clear workflow for:

Step 1

Start replay.

Step 2

Analyze market context.

Step 3

Mark liquidity.

Step 4

Identify potential DOL.

Step 5

Mark POIs.

Step 6

Wait for price to develop.

Step 7

Manually mark sweep.

Step 8

Manually identify displacement.

Step 9

Manually confirm MSS.

Step 10

Plan entry.

Step 11

Set SL/TP.

Step 12

Continue replay.

Step 13

Record outcome.

Step 14

Journal the trade.

Step 15

Continue to the next opportunity.

The interface should make this workflow natural without forcing the trader into unnecessary forms.

13. NO-TRADE RECORDING

A serious backtesting workstation must also record no-trade decisions.

Allow the trader to record:

No trade

Setup invalidated

Missed setup

Did not meet rules

Poor conditions

Waiting for confirmation

Other reason

This is important because discretionary trading performance is not only about executed trades.

14. TRADING SESSION CONTEXT

Support session-aware charting.

Use:

America/New_York

for New York session calculations.

Support visualization of:

Asia

London

New York

Trading window

Session highs/lows

The user's primary analysis window is:

09:45 AM – 12:00 PM New York time

Make this configurable rather than hard-coded.

Do not depend on the Android device timezone for session logic.

15. JOURNAL

Create a proper trading journal.

Each completed backtest record should be able to contain:

Date

Time

Symbol

Timeframe

Direction

HTF bias

DOL

Liquidity taken

Sweep

Displacement

MSS

POI

Entry

SL

TP

R:R

Result

Result in R

Confidence

Reason

Mistakes

Notes

Where practical, preserve the chart state/analysis associated with the trade.

16. STATISTICS

Create a statistics section based on manually recorded trades.

Potential metrics:

Total trades

Wins

Losses

Breakeven

Win rate

Total R

Average R

Average win

Average loss

Largest win

Largest loss

Consecutive wins

Consecutive losses

Setup distribution

Direction distribution

Session distribution

Liquidity type distribution

No-trade statistics

Do not present statistics as signals or predictions.

The purpose is research and self-review.

17. REPLAY SESSION MANAGEMENT

Allow the user to create a replay session containing:

Symbol

Timeframe

Starting date

Starting time

Replay speed

Current replay timestamp

Drawings

Analysis

Trade decisions

The user should be able to pause and later continue a replay session.

Design this so sessions can eventually be persisted in Supabase.

18. ANDROID-FIRST UX

This is a major requirement.

Optimize for Android phones.

Prioritize:

Large touch targets

Fast chart interaction

Minimal unnecessary navigation

Collapsible panels

Bottom sheets where appropriate

Touch-friendly drawing tools

Responsive chart

Minimal loading

Efficient rendering

Clear typography

Dark trading-workspace aesthetic

Good performance on mid-range Android devices

Avoid tiny desktop-style controls.

Do not overload the screen.

The chart should remain the primary visual element.

19. PERFORMANCE

Design the application for potentially very large historical datasets.

Do not load millions of candles into the UI unnecessarily.

Use:

Efficient queries

Pagination/range loading

Data caching where appropriate

Virtualization where useful

Lightweight state management

Efficient chart updates

Replay-window loading

The replay engine should only expose the candles available up to the current replay timestamp.

20. APPLICATION STRUCTURE

Use a clean modular architecture.

Suggested major modules:

Market Data
Replay Engine
Chart
Drawing Engine
ICT Analysis
Trade Planner
Backtesting
Journal
Statistics
Settings


Keep the replay engine independent from the UI.

Keep the market-data provider independent from the replay engine.

Keep drawings independent from historical candle storage.

Keep journal/trade records independent from chart rendering.

This separation is important because the application will later connect to Supabase.

21. INITIAL NAVIGATION

Use a simple navigation structure.

Suggested sections:

Replay

Backtest

Journal

Statistics

Data

Settings

Do not create unnecessary dashboard pages.

The Replay/Backtest workspace should be the main product.

22. DATA PAGE

Create a future-ready Data section.

Initially it can show:

Available symbols

Available timeframes

Dataset status

Candle count

Earliest timestamp

Latest timestamp

Design it so that after Supabase is connected, the user can see which historical datasets are available.

Do not require the actual datasets during this first development phase.

23. SETTINGS

Include:

Theme

Chart preferences

Default timeframe

Default replay speed

Session timezone

Trading window

Drawing preferences

Data settings

Account/user settings

Default session timezone:

America/New_York

24. VISUAL DESIGN

Create a professional trading-terminal aesthetic.

The interface should feel:

Focused

Minimal

Professional

Fast

Information-dense without being cluttered

Avoid a generic SaaS dashboard appearance.

The chart should visually dominate.

Use clear hierarchy between:

Market data

Analysis

Trade planning

Journal

25. IMPORTANT PRODUCT PHILOSOPHY

Do not turn this project into an automated ICT assistant.

The objective is to train and test the trader's own decision-making.

The application should help the trader answer:

"What did I see?"

"What did I expect?"

"What did price actually do?"

"Why did I enter?"

"Why did I stay out?"

"What happened after the decision?"

"What can I learn from the sample?"

The software should preserve the uncertainty that exists during real trading.

26. BUILD PRIORITY

Build in this order:

Priority 1

Core application shell + mobile-first UX.

Priority 2

Interactive US30 chart.

Priority 3

Replay engine with strict future-data protection.

Priority 4

Multi-timeframe architecture.

Priority 5

Manual drawing system.

Priority 6

Manual ICT analysis panel.

Priority 7

Entry/SL/TP trade planner.

Priority 8

Manual backtest workflow.

Priority 9

Journal.

Priority 10

Statistics.

Priority 11

Supabase-ready data architecture.

Do not spend most of the initial development effort on dashboards, statistics, or decorative UI.

The replay engine and chart are the core product.

27. IMPORTANT: DO NOT CONNECT REAL DATA YET

For this initial build:

Do not require me to upload my US30 historical files.

Use mock/sample candle data where necessary.

Build the architecture so that real US30 historical data can later be connected through Supabase without redesigning the replay engine.

When the application architecture is stable, we will separately prepare and upload multiple US30 timeframes to Supabase.

28. SUCCESS CRITERIA

The first version is successful if I can:

Open the application on Android.

Select US30.

Select a timeframe.

Select a historical starting point.

Start replay.

See only candles available at that historical moment.

Advance candles naturally.

Pause/step/change speed.

Zoom and pan.

Mark liquidity manually.

Mark POIs manually.

Mark structure manually.

Mark sweep/displacement/MSS manually.

Create an entry/SL/TP.

Continue replay without future-data leakage.

Record the result.

Save the analysis.

Review the trade later.

See statistics from completed manual backtests.

The experience should feel like a serious US30 historical trading laboratory, optimized for Android.

Do not optimize for flashy features.

Optimize for:

Replay accuracy + manual analysis speed + realistic decision-making + reliable journaling + Android performance.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/27c3d16a-3f60-468c-b1a2-8d57682c9402).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
