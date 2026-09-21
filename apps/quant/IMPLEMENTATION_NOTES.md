# Quant Dashboard Implementation Notes

아래 Phase 1–5는 초기 오프라인 구현 시점의 기록입니다. 이후 Supabase 연결·프로덕션 배포·호스트의 독립 갱신 타이머 검증이 별도로 진행되었습니다. 인증 자료와 운영 검증 기록은 저장소에 포함하지 않습니다. 실제 메일 수신·소유자 로그인, 커스텀 도메인의 DNS/TLS, Git 연동 자동 배포는 각각 별도 확인 대상입니다.

## 2026-09-21 — Phase 1: scope and test harness

- Scope is limited to `apps/quant/**` plus `pnpm-lock.yaml` for the Supabase dependency.
- The app starts from the React/Vite toolchain, without demo state or copied sample UI.
- The first vertical slice is the untrusted JSON ingress boundary. A test-only payload fixture lives under `src/__tests__/fixtures` and is never imported by production code.
- Tests are being run RED before implementing each slice, as required by `APP_TASK.md`.

## 2026-09-21 — Phase 2: payload boundary

- Confirmed RED: Vitest failed because `@/lib/dashboard-schema` did not exist.
- Added a strict version-1 parser for every nested field, finite plain decimal strings, timezone-bearing timestamps, and mode/source consistency.
- The database-row mapper cross-checks `episode_id`, `month`, and `as_of` against the parsed payload and rejects future schema versions.
- Dependency installation is temporarily using the existing workspace toolchain because registry network access is unavailable; the Supabase package itself is not needed by this slice.

## 2026-09-21 — Phase 3: request and auth isolation

- Confirmed RED: the controller test failed because the hook did not exist.
- Added mode-scoped data and selection state, request generations plus `AbortController`, and immediate private-state clearing on tab/auth/sign-out transitions.
- Live loads are gated on an authenticated session. Polling is 60 seconds only while the page is visible; hidden pages abort the selected request and resume with a fresh request when visible.

## 2026-09-21 — Phase 4: responsive dashboard and Supabase adapter

- Confirmed RED then GREEN for five real React rendering tests: public data, month switch, anonymous login, authenticated-live empty state, and unconfigured deployment.
- Added a chronological accessible SVG chart, explicit partial/full-month baseline labels, snapshot freshness notice, responsive holdings/fills views, and tabular numeric formatting. Decimal strings stay authoritative; numeric conversion is presentation-only.
- Confirmed RED for the Supabase adapter boundary before implementing separate paper/live tables, newest-first ordering, strict row mapping, SDK-owned session identity, and `shouldCreateUser: false` magic links.

## 2026-09-21 — Phase 5: deployment and database boundary

- Supabase SDK creation accepts only the public project URL and anon key; auth persistence/refresh remains inside the SDK and application state contains only user id/email.
- Added idempotent table creation, forced RLS, public paper SELECT, owner-only live SELECT, revoked anon/auth writes, and no permissive write policy.
- Added Vercel SPA routing, a restrictive CSP, secret-like Vite env build guard, environment example, mobile E2E coverage, and operations/data-semantics documentation.
- No user, credential, live row, broker connection, external Supabase call, or deployment was created.
