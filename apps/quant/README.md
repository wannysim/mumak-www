# Quant Dashboard

월별 원장 스냅샷을 읽는 React/Vite 대시보드입니다. `paper`는 공개이고 `live`는 Supabase Auth 세션과 데이터베이스 RLS를 모두 통과한 소유자만 읽을 수 있습니다. 이 앱은 조회 전용이며 주문, 입출금, 브로커 연결, 원장 적재를 수행하지 않습니다.

## 로컬 실행

```bash
pnpm install --filter=quant...
cp apps/quant/.env.example apps/quant/.env.local
pnpm --filter=quant dev
```

로컬 URL은 `http://quant.mumak.localhost:1355`입니다. 환경 변수가 없으면 가짜 데이터 대신 명시적인 미연결 상태를 표시합니다.

```bash
pnpm --filter=quant check-types
pnpm --filter=quant lint
pnpm --filter=quant format:check
pnpm --filter=quant test:ci
pnpm --filter=quant build
pnpm --filter=quant test:e2e
```

`test:ci`는 Vitest와 Python 3 표준 라이브러리 기반 exporter/publisher 테스트를 함께 실행합니다. `.github/app-config/apps.yml`에 `quant`를 등록해 앱별 CI와 E2E 검사 대상에 포함합니다. E2E는 `scripts/preview-e2e.mjs`가 별도 `dist-e2e`를 빌드하고, 테스트 전용 공개 설정과 Playwright의 로컬 응답으로 PC/모바일 차트·체결 근거·로그인 경계를 검증합니다. 운영 `dist`와 실제 Supabase에는 쓰지 않습니다. 실제 Supabase 연결·메일 수신·로그인은 별도 운영 검증입니다.

## 환경 변수

- `VITE_SUPABASE_URL`: Supabase 프로젝트의 공개 URL
- `VITE_SUPABASE_ANON_KEY`: 공개 anon key

`service_role`, 비밀번호, private key, access token을 `VITE_*`로 만들지 마세요. Vite 변수는 브라우저 번들에 공개됩니다. 빌드는 secret-like `VITE_*` 이름을 발견하면 중단합니다.

## 데이터베이스와 RLS

1. [001_dashboard.sql](./supabase/migrations/001_dashboard.sql), [002_paper_publisher.sql](./supabase/migrations/002_paper_publisher.sql), [003_fill_reason.sql](./supabase/migrations/003_fill_reason.sql)을 순서대로 적용합니다. 기존 운영 환경의 체결 근거 전환 순서와 읽기 전용 발행은 [scripts/README.md](./scripts/README.md)를 참고하세요.
2. Auth에서 소유자 사용자를 관리자가 별도로 프로비저닝합니다. 앱의 magic link 요청은 `shouldCreateUser: false`라 신규 사용자를 만들지 않습니다.
3. `live_snapshots.owner_id`에는 해당 Auth 사용자의 UUID를 기록합니다.
4. Auth URL 설정에 실제 배포 origin을 redirect allow-list로 추가하고, 필요하면 공개 회원가입도 프로젝트 설정에서 끕니다.

두 테이블 모두 `FORCE ROW LEVEL SECURITY`가 켜집니다. `anon`/`authenticated`에는 쓰기 권한이나 쓰기 policy가 없습니다. `paper_snapshots`만 공개 SELECT를 허용하고, `live_snapshots`는 `owner_id = auth.uid()`인 인증 사용자만 SELECT할 수 있습니다. 적재 에이전트만 서버 측 `service_role`을 사용해야 하며 그 키는 이 앱에 절대 전달하지 않습니다.

## 데이터 의미

- 모든 금액과 수량은 JSON decimal string이 원본입니다. 브라우저의 `Number` 변환은 표시와 SVG 좌표에만 사용하며 회계 값을 다시 계산하지 않습니다.
- `baselineKind: inception`은 시작월의 부분 월, `month-start`는 월초 기준 전체 월입니다.
- 화면은 60초마다 데이터베이스 스냅샷을 다시 읽되 페이지가 보일 때만 폴링합니다. 시세나 체결의 tick realtime 화면이 아닙니다.
- `asOf`는 원장 기준 시각이고 15분을 넘기면 지연 경고를 표시합니다. `markAsOf`는 종목별 평가 시각입니다.
- 스냅샷 payload는 버전 1만 허용합니다. 모드, episode, month, as-of가 행과 다르거나 decimal/date가 잘못되면 전체 행을 거부합니다.
- 포트폴리오 데이터는 localStorage, service worker, 빌드 파일에 저장하지 않습니다. 인증 토큰의 수명과 저장은 Supabase SDK가 관리합니다.

## 화면 상호작용

- 성과 추이는 공유 shadcn Chart(Recharts)를 사용합니다. NAV(USD)와 수익률(%)을 전환하며, 호버·터치·키보드로 시점별 값을 확인합니다. 각 시계열을 따로 min-max 정규화해 겹쳐 그리지 않습니다. 입출금 없는 고정 기준금액 회차에서 `수익률 = (NAV / 시작 NAV - 1) × 100`이므로 두 추세의 모양이 같은 것은 정상입니다.
- 체결의 `reason`은 선택 필드입니다. 기록된 사유 코드만 공개용 짧은 설명으로 변환하며, 없는 과거 기록은 `null`로 두고 정보 아이콘을 표시하지 않습니다. 상세 지표·종목 선정 논리를 사후 추정하지 않습니다. 아이콘은 PC 호버/포커스와 클릭, 모바일 터치로 열 수 있고 Escape/바깥 클릭으로 닫습니다.
- 보유 종목과 최근 체결의 티커는 `https://www.tossinvest.com/stocks/{ticker}`를 새 탭으로 엽니다. 토스가 티커를 자체 종목 ID로 해석하므로 매핑 테이블이나 인증 API가 필요 없습니다. 2026-09-21 AMD·CRWD·DELL·HPE·MPC·MRNA의 실제 이동을 확인했습니다. 다른 종목의 지원 여부와 향후 URL 정책은 토스에 달려 있으며, 티커를 임의 변환하거나 ID를 추측하지 않습니다.

## 배포

Vercel 프로젝트의 Root Directory를 `apps/quant`로 지정합니다. Build Command는 `pnpm build`, Output Directory는 `dist`입니다. [vercel.json](./vercel.json)은 SPA rewrite와 Supabase 연결만 허용하는 CSP를 제공합니다.

이 배포 절차는 live 운용을 활성화하지 않습니다. 소유자 계정, 비밀 키, 실제 원장 exporter/ingest, live 행 적재와 운영 전환은 별도 운영 주체가 수행해야 합니다.

## 폰트 라이선스

`Mumak Sans Variable`은 Pretendard의 OFL-1.1 수정본입니다. 배포물에 [OFL 라이선스](./public/licenses/pretendard-ofl.txt)를 함께 제공합니다.
