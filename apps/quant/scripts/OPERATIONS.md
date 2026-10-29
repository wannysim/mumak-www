# PAPER 운영 sidecar 연결·배포 runbook

## 범위와 불변식

이 변경은 공개 PAPER 관측 기능이다. 기존 재무 `DashboardSnapshot` v1/001–003 SQL 및 LIVE 권한·거래 엔진·cron·원장에는 변경이 없다. 이 PR은 Draft 검토용이며 production migration, 발행, scheduler 설치·활성화, Ready/merge/deploy는 실행하지 않는다.

`paper-operations/v1`은 별도 typed sidecar다. `operations-contract.json`은 Python/TS/SQL의 공통 exact-key/enum/bounds 계약이다. `generate-operations-migration.mjs`로 004 SQL을 생성하고 `--check`로 동기화를 확인한다. 원시 SQL/로그/경로/키/계좌/raw OHLCV/내부 문서는 payload에 없다. 이유는 고정 enum만 허용하며 원천의 임의 오류는 `other-not-public` 또는 prefix 기반 `fetch-failed`로 변환한다.

## 생산자 연결

호스트 전용 binding JSON을 비공개 경로에 준비한다. binding 자체를 git/public/VITE에 넣지 않는다. 필수 키:

- `sourceRoot`: 저장된 PAPER policy/snapshot/progress/report의 절대 루트. 원장 SQLite 파일이 아니다.
- `episodeId`, `month`: 운영자가 확인한 공개 회차 별칭/월. 재무 회차와 정확히 같은 결합키를 사용한다.
- `authority`: `policy-declaration` 또는 `preserved-policy`. 이 파일 어댑터는 runtime 권위를 발급하지 않는다.
- `registeredAt`: 이 정책 설명을 등록한 불변 UTC receipt 시각(`YYYY-MM-DDTHH:mm:ss[.ffffff]+00:00`). 매번 now로 교체하지 않는다. 과거 운용 시작·활성화 증명이 아니다.
- 선택 `releaseFile`(root 아래 상대 경로), `releaseRegisteredAt`: 별도 C1 구성 등록 receipt 시각. base를 이미 발행한 뒤 release를 추가할 때는 새 등록 receipt 시각이 필요하다. 미래 `effective_at`을 source 시각으로 사용하지 않는다. activation receipt가 없으면 계속 미확인이다.

등록 전에 루트·회차·기간·원본 policy/release의 승인과 digest를 운영자가 확인하고 binding을 보호한다. 본 exporter는 운용코드를 import/실행하지 않는다. source 세션을 policy 기간과 대조하며 source mode/live를 확인한다. snapshot/progress 및 report는 명시된 session으로 결합한다. 보고 파일명 날짜는 거래일이 아니다. 같은 asof의 서로 다른 보고, 파일 중간 교체/추가, progress universe 불일치, 보고/snapshot count·시각 불일치는 거절한다.

기존 저장 자료에 대해 JSON dry-run:

    python3 -B scripts/export_operations.py --binding <private-binding> > <private-month.json>
    python3 -B scripts/export_operations.py --binding <private-binding> --session 2026-10-28 > <private-session.json>

실제 루트·키는 로그/공개 문서에 남기지 않는다. source clock이 미래거나 자료가 없으면 실패한다. no-recorded-session은 가짜 빈 성공으로 발행하지 않는다. 당일 후보가 없는 날은 UI에서 다른 날 후보를 가져오지 않는다.

## 호환 배포 순서 — 별도 승인 후 실행

1. 테이블 부재를 허용하는 frontend부터 배포한다. `42P01/PGRST205`는 운영 영역만 아직 배포되지 않음으로 표시된다. 인증/형식/연결 오류와 정상 빈 결과를 구별한다. 재무 조회는 독립이다.
2. 전용 test DB에서 모든 migration 및 role/CAS/malformed 테스트를 먼저 실행한다. production에 004를 적용하는 것은 별도 운영 승인 대상이다. 기존 001–003을 편집하거나 다시 적용하지 않는다.
3. 승인된 호스트에서만 독립 exporter/publisher를 설치한다. 환경의 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 server-only다. browser/VITE/git/스크린샷/명령행 인자에 키를 넣지 않는다. 이 PR은 설치/환경/cron을 변경하지 않는다.
4. 선택한 정확 회차/월/세션을 읽어 현재 revision을 확인한 뒤 명시 CAS로 발행한다. 신규 revision은 0, 기존은 읽어 확인한 revision이다.

   python3 -B scripts/publish_operations.py --payload <private-month.json> --expected-revision 0
   python3 -B scripts/publish_operations.py --payload <private-session.json> --expected-revision 0

5. publisher가 POST 후 정확 key/revision/sourceAsOf/의미 payload를 GET readback해 verified를 반환해야 한다. UI에서 동일 회차·월·세션과 revision/후보 count를 재확인한다. source 파일만 읽고 JSON이 만들어진 것은 production 연결 완료가 아니다.

SQL은 service-only RPC를 통해서만 쓴다. 브라우저 anon/authenticated는 SELECT only, 양 테이블 FORCE RLS다. helper RPC도 PUBLIC execute를 철회한다. expected_revision 불일치, 더 오래된 source, 같은 source 시각의 다른 의미는 거부한다. 단계 사건시각은 참조 evidence의 실제 사건시각과 일치해야 하고, 품질 이력 유효 수는 기록된 universe를 초과할 수 없다. runtime 권위는 참조한 runtime receipt가 필요하며 activationObservedAt은 해당 runtime receipt 사건시각과 결합한다. 등록 정책은 실행 확인으로 승격되지 않는다. 이미 기록된 evidence 시각은 더 최신의 다른 receipt로 null 삭제할 수 없다. 반복 export의 exportedAt/evidence.observedAt만 달라지면 no-op이며 기존 revision/stored_at/관측시각을 보존한다. no-op은 source freshness를 갱신하지 않는다.

모호한 POST 실패는 자동 재시도하지 않는다. 정확 기존 row를 먼저 조회해 revision/내용을 확인하고 새 expected_revision을 사람이 판단한다. partial month/session publication은 독립이며 금융 exporter에 역전파하지 않는다. 수정된 불변 세션 자료의 같은시각 충돌은 자동 덮어쓰지 않고 별도 정정 receipt/시각과 검토가 필요하다.

## 지금 제공되는 것 / 추가 운영 입력

- 제공: 등록 정책/수식/배분/cadence, C1 별도 구성기간, snapshot의 전체 수집적격·제외 후보, progress, session 결합 보고 품질과 완료 검증.
- 미지원: 저장된 점수/ranked/targets/watch, 당일 실제 전략 binding, 완전한 위험 gate, PAPER buy/sell/hold receipt, scheduler·calendar·lease·다음 실행, publication/research receipt. 미지원은 null이며 0/false/정상/보유유지로 채우지 않는다.
- 이 계약의 typed 필드로 향후 공식 RO adapter를 붙일 수 있지만 현재 파일 어댑터는 그 자료를 발명/재계산하지 않는다. 원장 조회는 전용 RO MCP만 사용한다. 노출되지 않으면 raw SQLite/토큰/별도 Hermes/브로커 fallback을 만들지 않는다.
- public publication receipt는 이미 성공한 정확 readback만 다음 별도 source receipt로 투영해야 한다. 자신의 POST 전에 자신의 발행완료를 만들지 않는다.
- 월간 controller가 미설치여도 일별 관측은 독립이다. LAB·개발 Kanban 완료는 전략 승격 증거가 아니다. C1 예정시각 경과는 활성화 증거가 아니다.

## UI 의미

월 전략/일별 목록/선택일 상세는 각각 오류·재조회 경계가 있다. 월/회차 전환과 LIVE에서는 이전 PAPER 후보를 제거한다. hidden에서 요청을 중단하고 visible에서 재조회하며 60초 갱신한다. 이는 수집·매매 cadence가 아니다. lease 만료는 1초 visible 시계로 재평가해 현재 미확인으로 표시하며 실패로 바꾸지 않는다. 사건/관측/export/DB 저장/웹 조회 시계는 서로 다르다.

후보는 25개씩 표시하고 검색·분류·정렬한다. unavailable 신호/선정/watch는 비활성 미제공이며 수집 적격과 구별한다. 일별 기록에 없는 세션을 성공·실패로 채우지 않는다. NY 세션 날짜와 사용자 표시 시간대를 구별한다. clock age를 시장 휴장/장외·서비스 건강 판정으로 바꾸지 않는다.

## 검증 명령 및 증거 구분

    pnpm --filter=quant check-types
    pnpm --filter=quant lint
    pnpm --filter=quant format:check
    pnpm --filter=quant test:ci
    pnpm --filter=quant build
    pnpm --filter=quant exec node scripts/generate-operations-migration.mjs --check
    pnpm --filter=quant exec playwright test --workers=1
    CI=1 pnpm --filter=quant exec playwright test e2e/operations.spec.ts --workers=1 --retries=0 --reporter=list

`test_operations_adapter.py --synthetic-preview`는 합성 saved-source를 실제 exporter로 투영한다. operations E2E는 이를 실제 PGLite/004/service RPC에 넣고 DB행을 readback해 HTTP localroute로 실제 앱에 보낸다. 외부 네트워크/production DB가 아니다. SQL tests는 revision/noop/stale/conflict/role deny/legacy LIVE를 검증한다. shared invalid corpus를 Python/TS/SQL이 모두 거부해야 한다. 실saved-source dry-run은 별도 내부 evidence이며 합성 E2E를 실운용 결과로 소개하지 않는다.

## 복구

front 문제이면 frontend rollback으로 기존 재무 v1 화면으로 돌아간다. 독립 publisher를 먼저 중단하는 운영 변경은 별도 승인한다. sidecar table은 additive이므로 즉시 DROP/delete하지 않는다. frontend rollback 및 publish 중단 후에도 기존 금융 경로는 그대로 유지한다. 손상 row는 임의 수정/삭제 대신 원본 보존·정정 receipt와 CAS 절차로 다룬다. 운영 부재 상태를 숨기려고 LIVE/RLS/service key 정책을 완화하지 않는다.
