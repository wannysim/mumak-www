# Intraday PAPER experiment

This is a second, isolated forward-paper experiment. It starts with virtual USD 100,000 and is mechanically unable to send an order: there is no broker import, credential field, order endpoint, margin, short sale, or deployment action in this runtime.

The existing low-frequency episode and its historical runtime are frozen. The new engine only reuses the public `book`/`fills`/`observations` projection contract. Private source evidence, immutable intents, decisions, and safety state live in a separate run directory and SQLite ledger.

An initialized cash-only episode exports the generic `pending` status and displays “시작 대기”, not “운용 중”. The existing SQL publication contract accepts this value without a database migration, as exercised by the PGlite RPC test. Deploy the updated frontend parser before publishing a pending episode; older frontends do not recognize that status. This PR does not itself publish data or change the hosted publisher.

## Preregistered hypothesis

The strategy is a research-inspired long-only opening-range breakout adaptation, not a replication of any paper and not a profit claim.

- Episode: `paper-intraday-2026-09`, September 28–30, 2026 XNYS sessions.
- Fixed universe: AAPL, MSFT, NVDA, AMD, AMZN, META, GOOGL, TSLA. This mega-cap/technology-heavy list is not representative of the U.S. equity market.
- Observation cadence: public no-auth Yahoo 5-minute chart responses. A five-minute poll cadence is not a promise of five-minute trades or real-time data.
- Opening range: exactly the first three complete regular-session bars (09:30–09:45 ET).
- Entry signal: a later complete bar closes more than 5bp above the opening-range high, has positive one-bar momentum, and the first-15-minute volume is at least 1.5 times the available prior-session first-15-minute average.
- Causal fill: the signal becomes immutable at receipt time. It can only fill from the latest fresh completed bar in a later response whose market completion and receipt are both after the signal. The signal bar is never its own fill. A response after an outage cannot backfill an earlier favorable bar.
- Exit signals: 1% position stop, 2% target, 120-minute maximum hold, or a flatten signal 20 minutes before the actual XNYS close. Every exit also needs a later fresh observation; missing the close records unresolved overnight risk instead of inventing a fill.
- Cost model per side: 10bp commission plus 5bp adverse slippage. A private stress counter uses 20bp plus 10bp per side. These are modeled costs, not observed spreads or executable quotes.
- Risk: whole shares, long-only, at most 4 positions, at most 20% of NAV per new position, at least 20% cash at entry, at most 2 entries per symbol/day, 12 entries/day, 24 total trades/day with exit capacity reserved, and 160% daily risk-increasing turnover. Mandatory risk-reducing sells are not blocked by an entry budget.
- Portfolio stops: 1% daily NAV loss and 10% persistent episode loss. The episode limit is stricter than the outer 30% maximum-loss requirement.

The short September window cannot validate alpha. Parameters must not be optimized after seeing these forward outcomes. Base and stress costs, missed observations, holds, unresolved exits, and zero-trade days are all results.

## Data and safety behavior

The adapter retains raw response bytes, SHA-256, source URL, request/receipt time, event times, and parsed corporate-action identifiers in the private ledger. It bounds response size, timeout, attempts, and exponential backoff. It rejects wrong identity/currency/timezone/granularity, future-start, duplicate, reordered, conflicting, missing completed bars, gaps, and delays over 120 seconds.

Yahoo may include one currently forming trailing bar. That one bar is retained only in raw evidence and excluded from decisions; a future-start or non-trailing incomplete bar fails closed. The 16:00 zero-volume terminal marker seen in weekend samples is outside the regular XNYS session and is never tradable.

A confirmed split or dividend affecting an already-held position sets `performance_provisional` and `corporate_holds`. Trading and public projection then remain held for manual reconciliation; the engine never synthesizes shares or cash. Stale or absent data cannot clear a stop, pending sell, corporate hold, or unresolved overnight state.

`exchange-calendars==4.13.2` supplies XNYS holidays, DST, and early closes at runtime. Tests inject the calendar, so CI does not depend on a private host environment.

## CLI

Install the explicit runtime calendar dependency in an isolated environment:

```sh
python -m pip install -r apps/quant/scripts/requirements-intraday-paper.txt
```

Initialize once in a private path, inspect, run a wall-clock tick, and make a read-only dashboard projection:

```sh
python -B apps/quant/scripts/intraday_paper.py --root /operator/private/intraday-paper \
  init --config apps/quant/config/intraday-paper-v1.json \
  --at 2026-09-26T12:43:19+09:00

python -B apps/quant/scripts/intraday_paper.py --root /operator/private/intraday-paper \
  status --run-id intraday-paper-2026-09

python -B apps/quant/scripts/intraday_paper.py --root /operator/private/intraday-paper \
  tick --run-id intraday-paper-2026-09

python -B apps/quant/scripts/intraday_paper.py --root /operator/private/intraday-paper \
  export --run-id intraday-paper-2026-09 \
  --output /operator/private/intraday-paper/snapshot.json
```

`tick` uses the wall clock before and after its bounded reads. `--simulation-at` is accepted only together with an explicitly `testOnly` fixture. `sample` performs a separate one-symbol no-auth parser probe and never opens a ledger. None of these commands installs a scheduler or publishes a row.

## Evidence basis and limits

- Gao, Han, Li, and Zhou, “Market intraday momentum,” _Journal of Financial Economics_ 129(2), 2018, [DOI 10.1016/j.jfineco.2018.05.009](https://doi.org/10.1016/j.jfineco.2018.05.009), provides market-level intraday-momentum context, not this all-day equity ORB rule.
- Heston, Korajczyk, and Sadka, “Intraday Patterns in the Cross-Section of Stock Returns,” _Journal of Finance_ 65(4), 2010, [author PDF](https://www.bauer.uh.edu/departments/finance/documents/Heston-Korajczyk-Sadka-jf-2010-01-07.pdf), is context for periodicity and execution-cost caution, not proof of a pure profit opportunity.
- Holmberg, Lönnbark, and Lundström, “Assessing the profitability of intraday opening range breakout strategies,” _Finance Research Letters_ 10(1), 2013, [DOI 10.1016/j.frl.2012.09.001](https://doi.org/10.1016/j.frl.2012.09.001), studies crude-oil futures and does not validate this U.S.-equity parameter set.
- Zarattini, Barbon, and Aziz, “A Profitable Day Trading Strategy for the U.S. Equity Market,” 2024 [University of St. Gallen manuscript](https://www.alexandria.unisg.ch/server/api/core/bitstreams/3c2989c4-688d-4d78-8a71-f02690990d51/content), directly inspires the ORB hypothesis. Its reported long/short, screened, up-to-4x-leverage backtest is materially different and no result is transferred here.
- Yahoo Chart is a public, unofficial, no-SLA source. Weekend historical parsing does not establish live latency, licensing for another use, executable prices, fill probability, or profitability. Alpha Vantage documents real-time/delayed U.S. intraday data as premium; this project does not assume a free entitled substitute.
