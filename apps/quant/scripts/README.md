# Read-only paper data publisher

This adapter is a one-way projection, not a trading process. It never imports the broker client, writes the operational SQLite database, refreshes trading credentials, or reads/writes the live dashboard table.

## Scope

- Input: an explicitly paper-only forward ledger, plus its monthly policy.
- One cash-start, no-external-flow monthly episode is currently supported. Cross-month carry, deposits/withdrawals, corporate actions, provisional valuations and unreconciled records are rejected, not shown as valid performance.
- Every fill is replayed with decimal arithmetic. Cash, holdings and latest NAV must exactly reconcile with the book in the same read-only SQLite transaction.
- Average cost includes modeled buy commissions. Account profit includes modeled sell commissions. Holding return is since purchase, not the monthly account return.
- NAV is valued at the latest complete recorded observation. Each holding retains its actual quote timestamp; a refreshed page/export does not make an old quote current.
- A fill may carry `reason: string | null`. The exporter maps only the ledger codes `rebalance`, `risk_stop`, and `concentration_reduction` to fixed Korean summaries (`정기 리밸런싱`, `위험 한도에 따른 매도`, `집중도 한도 조정`). Missing or unknown codes become `null`; raw ledger diagnostics are never copied. Public reason text is capped at 80 characters at ingress.
- No database outage is allowed to trigger broker action. Run this separately from the trading service. The adapter has no live export capability.

## Offline validation

From repository root:

```sh
python -B -m unittest discover -s apps/quant/scripts -p 'test_*.py' -v
python -B apps/quant/scripts/export_paper.py \
  --ledger /operator/path/ledger.sqlite3 \
  --policy /operator/path/policy.json \
  --episode-id paper-2026-09 \
  --output /operator/private-evidence/paper-snapshot.json
```

Do not place exports, original ledgers, account identifiers or credentials under `public/`, in source control, or in build artifacts. Unit fixtures are synthetic and explicitly test-only.

The migration test executes the actual SQL through the pinned test-only `@electric-sql/pglite` dependency in every `test:ci` run; it is not skipped. Run `pnpm install --filter=quant...` first. `PGLITE_MODULE` can optionally override the module location for isolated tooling.

## Database publication (requires provisioning)

Apply `supabase/migrations/001_dashboard.sql`, `002_paper_publisher.sql`, and `003_fill_reason.sql`, in order. The publisher RPC remains service-role-only and uses atomic monotonic replacement: a stale timestamp or a conflicting payload at the same source timestamp cannot overwrite the current row. Re-exporting identical economics with a new `exportedAt` is allowed. Migration 003 accepts both legacy fills without `reason` and new fills with an allowlisted string or `null`; it does not change table RLS or browser privileges.

Roll out compatibility in this order: (1) deploy the frontend parser that accepts the optional field and normalizes an absent legacy value to `null`, (2) apply migration 003, then (3) deploy the exporter/publisher that emits `reason`. Reversing step 1 and step 3 would make the old strict frontend reject new payloads.

Provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only to the independent publishing process through an operator-controlled, private environment/secret store. Never prefix the service key with `VITE_`, paste it into chat, or expose it to Vercel's frontend build. The frontend uses the public anon/publishable key and row-level authorization instead.

```sh
python -B apps/quant/scripts/publish_paper.py \
  --ledger /operator/path/ledger.sqlite3 \
  --policy /operator/path/policy.json \
  --episode-id paper-2026-09
```

A successful CLI result requires a write acceptance followed by an exact row payload readback. HTTP redirects are refused so privileged headers cannot follow a redirect to another host. Requests have a timeout; ambiguous transport failures are reported rather than automatically retried inside the invocation. A later scheduled run is idempotent at the source timestamp.

A separate user-level timer may run this about once per minute after deployment verification. That is a **web projection interval**, not a new market-data interval. Do not append it to the broker's critical path, alter trading timers, or restart trading processes. No timer is installed by these scripts.

## Release gates

Before claiming the website is live, verify all of:

- Owner accepts Supabase/Vercel terms and confirms a free plan; no paid upgrade.
- All three migrations are installed on the exact provisioned project.
- Anonymous read sees paper rows; anonymous/other-account read cannot see a sentinel live row; browser writes are rejected. Remove any fixture live rows before release, with approval if remote deletion is needed, or use a separate disposable test project.
- The designated owner account is created/verified with the user's chosen email. Disable public signup if practical. Owner rows bind to its immutable Auth UUID; do not trust an email or mode toggle in the browser.
- No real live data is published until its separate pipeline and cash-flow-aware accounting are approved and tested. An authenticated empty state is correct today.
- Real paper data survives REST readback and a browser load; source timestamps remain unchanged.
- Vercel production build, domain ownership/TLS, and the independent publisher's actual timed run are verified separately.

Local tests and a build do not prove these external gates. In particular, a successful Vercel login is not a deployed project or a Supabase session.
