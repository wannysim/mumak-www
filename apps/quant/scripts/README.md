# Read-only paper data publisher

This adapter is a one-way projection, not a trading process. It never imports the broker client, writes the operational SQLite database, refreshes trading credentials, or reads/writes the live dashboard table.

## Scope

- Input: an explicitly paper-only forward ledger, plus its monthly policy.
- One cash-start, no-external-flow monthly episode is currently supported. Cross-month carry, deposits/withdrawals, corporate actions, provisional valuations and unreconciled records are rejected, not shown as valid performance.
- Every fill is replayed with decimal arithmetic. Cash, holdings and latest NAV must exactly reconcile with the book in the same read-only SQLite transaction.
- Average cost includes modeled buy commissions. Account profit includes modeled sell commissions. Holding return is since purchase, not the monthly account return.
- NAV is valued at the latest complete recorded observation. Each holding retains its actual quote timestamp; a refreshed page/export does not make an old quote current.
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

## Database publication (requires provisioning)

Apply both `supabase/migrations/001_dashboard.sql` and `002_paper_publisher.sql`, in order. The second migration adds a service-role-only RPC with atomic monotonic replacement: a stale timestamp or a conflicting payload at the same source timestamp cannot overwrite the current row. Re-exporting identical economics with a new `exportedAt` is allowed.

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
- Both migrations are installed on the exact provisioned project.
- Anonymous read sees paper rows; anonymous/other-account read cannot see a sentinel live row; browser writes are rejected. Remove any fixture live rows before release, with approval if remote deletion is needed, or use a separate disposable test project.
- The designated owner account is created/verified with the user's chosen email. Disable public signup if practical. Owner rows bind to its immutable Auth UUID; do not trust an email or mode toggle in the browser.
- No real live data is published until its separate pipeline and cash-flow-aware accounting are approved and tested. An authenticated empty state is correct today.
- Real paper data survives REST readback and a browser load; source timestamps remain unchanged.
- Vercel production build, domain ownership/TLS, and the independent publisher's actual timed run are verified separately.

Local tests and a build do not prove these external gates. In particular, a successful Vercel login is not a deployed project or a Supabase session.
