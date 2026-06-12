# apps/blog 개선 과제 플랜

> 2026-06-12 기준 코드베이스(`develop`, v1.7.2) 분석으로 도출한 개선 과제 목록.
> 네 가지 관점으로 분류한다: (A) 소프트웨어 설계·유지보수성, (B) CI/CD·Turborepo 효율화, (C) Next.js 활용·사용자 경험, (D) SEO·GEO.
> 각 과제는 독립적으로 진행 가능하며, 우선순위는 마지막 로드맵 섹션 참조.

## 진행 현황

PR 묶음 단위로 진행한다. 완료 시 체크하고 옆에 PR 번호를 기록한다. 과제 상세는 아래 섹션 참조.

- [ ] **콘텐츠 파이프라인 PR** — A-1(zod 스키마) + A-2(로더 공통화) + A-4(React.cache) + A-5(커버리지 갭)
- [ ] **wikilink 단일 소스화 PR** — A-3 (스크립트 TS화, 콘텐츠 파이프라인 PR 후속)
- [ ] **CI 정리 PR** — B-1(globalDependencies) + B-3(blog-content.yml) + B-5(promote.yml)
- [ ] **빌드 산출물 다이어트 PR** — C-1(폰트 서브셋) + B-2(blog#build outputs, 검증 전제)
- [ ] **GEO 정책 결정** — D-1 (robots.ts AI 크롤러 정책, 코드 전 의사결정)
- [ ] **GEO PR 1** — D-2(llms.txt) + D-3(마크다운 엔드포인트)
- [ ] **GEO PR 2** — D-4(RSS 보강) + D-5(sitemap hreflang)
- [ ] **개별 소액**: C-2(MDX 이미지) / C-4(error.tsx) / B-6(react-doctor blocking) / D-6(콘텐츠 가이드)
- [ ] **조건부·보류**: C-3(검색 인덱스, 콘텐츠 성장 시) / B-4(E2E 시간, 측정 후) / A-6(선택) / C-5(업그레이드 시 재평가) / C-6(선택)

## 현재 상태 요약

전반적으로 건강한 코드베이스다. FSD 레이어 규율(앱 라우트 → widgets → features → entities → shared)이 잘 지켜지고 있고, barrel export 기반 public API, 접근성 기반 selector, 적응형 Spotify 폴링, graph 라이브러리 dynamic import, RAF 기반 스크롤 훅 등은 이미 모범적으로 구현되어 있다. 아래 과제들은 "고장난 것을 고치는" 것이 아니라 콘텐츠와 코드가 계속 성장할 때 비용이 커지는 지점을 미리 줄이는 데 초점을 둔다.

---

## A. 소프트웨어 설계 · 유지보수성

### A-1. Frontmatter 스키마 검증 도입 (zod)

- **현황**: `src/entities/post/api/posts.ts`, `src/entities/note/api/notes.ts`가 gray-matter의 `data`(사실상 `any`)를 `data.title || 'Untitled'`, `data.date || '1970-01-01'` 식의 기본값 fallback으로만 방어한다. 잘못된 frontmatter(예: `tags`가 문자열, `date` 포맷 오류)가 타입 오류 없이 빌드를 통과해 런타임 화면에서만 드러날 수 있다. `scripts/validate-content.mjs`(236줄), `scripts/validate-garden.mjs`(443줄)에 별도의 검증 로직이 있으나 src 코드와 규칙이 이원화되어 있다.
- **개선안**:
  1. blog에 `zod` 의존성 추가 (현재 `@mumak/ui`에만 있고 blog `package.json`에는 없음).
  2. `src/shared/lib/content/schema.ts`에 `PostFrontmatterSchema`, `NoteFrontmatterSchema` 정의 (title/date/category/tags/draft, created/updated/status 등 — `AGENTS.md`의 frontmatter 계약을 코드로 옮김).
  3. `parsePostFile`/`parseNoteFile`에서 `schema.parse()`로 교체. 빌드 타임에 잘못된 콘텐츠가 즉시 실패하도록.
  4. validate 스크립트는 스키마를 재사용하는 방향으로 점진 통합 (A-3과 연계).
- **기대 효과**: 콘텐츠 추가가 잦은 저장소에서 frontmatter 오류를 빌드 타임으로 앞당김. 검증 규칙의 단일 소스 확보.

### A-2. 콘텐츠 로더 공통화 (entities/post vs entities/note)

- **현황**: `posts.ts`(82줄)와 `notes.ts`(178줄)에 `getMdxFiles()` 파일 탐색이 각각 구현되어 있고(post는 flat, note는 재귀), frontmatter 파싱 보일러플레이트도 중복이다. draft 필터링은 note만 `isPublishable()`로 함수화되어 있고 post는 인라인(`isProduction && post.draft`)으로 일관성이 없다.
- **개선안**:
  1. `src/shared/lib/content/`에 공통 MDX 로더 추출: `listMdxFiles(dir, { recursive })`, `parseMdxFile(path, schema)` (A-1의 zod 스키마를 파라미터로 받음).
  2. draft 필터를 `isPublishable()` 하나로 통일하고 양쪽 entity가 공유.
  3. entity별 도메인 로직(post의 category, note의 wikilink/excerpt 추출)은 각 entity에 유지 — FSD 레이어 위반 없이 shared lib만 내려 쓴다.
- **기대 효과**: 새 콘텐츠 타입(예: series, til) 추가 시 로더 재구현 불필요. 한쪽만 고치는 drift 방지.

### A-3. wikilink 파싱 로직 단일 소스화

- **현황**: `src/shared/lib/wikilink/parser.ts`(테스트 커버리지 100%)가 마스터인데, `scripts/validate-garden.mjs:32-64`가 `parseWikilinkTarget` 등 같은 로직을 MJS로 복제하고 있다. parser 변경 시 스크립트를 수동 동기화해야 하고, 버그 수정이 한쪽에만 적용될 위험이 있다.
- **개선안**: validate 스크립트를 TypeScript로 전환(`node --experimental-strip-types` 또는 `tsx` 실행)하여 `@/src/shared/lib/wikilink`를 직접 import. `turbo.json`의 `validate:garden` inputs에 wikilink lib 경로 추가.
- **기대 효과**: wikilink 문법 확장(embed, anchor 등) 시 검증과 렌더링이 항상 동일한 규칙을 따름.

### A-4. 콘텐츠 조회에 `React.cache()` 적용

- **현황**: `getPosts()`, `getNotes()`가 호출마다 파일시스템 풀 스캔 + 전체 파싱을 수행하며 `React.cache()`/`unstable_cache` 사용이 전무하다. 한 페이지 렌더에서 `generateMetadata`와 페이지 본문이 `getPost`를 각각 호출하고(슬러그 페이지에서 같은 파일을 2회 read+parse), 리스트 페이지는 본문·nav counts·검색 인덱스가 `getPosts`를 반복 호출한다.
- **개선안**: entity public API(`getPosts`, `getPost`, `getNotes`, `getNote` 등)를 `React.cache()`로 감싸 렌더 단위 메모이즈. 인자(locale, category, slug)가 전부 원시 문자열이라 참조 동등성 함정 없이 그대로 동작한다.
- **기대 효과**: 렌더당 중복 파일 read/parse 제거(슬러그 페이지 2회→1회, 리스트 페이지 3회→1회). 빌드 워커 간 공유는 되지 않으므로 빌드 시간의 극적 단축이 아니라 페이지 렌더 내부 중복 제거 수준임을 명확히 한다. `sitemap.ts`의 `getNotesByTag`/`getNotesByStatus` 반복 풀 스캔은 React 렌더 스코프 밖이라 `cache()` 효과가 보장되지 않으므로, 그쪽은 A-2 로더 공통화에서 "단일 스캔 후 메모리 분류"로 푸는 것이 맞다.

#### SSG 안전성 검토 (왜 `React.cache()`가 정적 렌더를 깨지 않는가)

이 저장소는 과거 콘텐츠 페이지가 조용히 동적(server-rendered)으로 새는 회귀를 겪었고(`progress-bar-didnt-lie` 포스트모템), `__tests__/app/static-rendering.test.ts`가 `.next/prerender-manifest.json`을 읽어 콘텐츠 라우트 14종의 SSG 여부를 빌드 산출물 수준에서 단언하고 있다. 이를 전제로 검토한 결론:

1. **정적/동적 분류 메커니즘과 무관하다.** Next.js가 라우트를 동적으로 강등시키는 조건은 dynamic API 사용(`cookies()`, `headers()`, `searchParams`, no-store fetch 등)과 segment config(`dynamic`, `revalidate`)이다. `React.cache()`는 순수 렌더-스코프 메모이제이션이고 `fs.readFileSync`는 분류에 영향을 주지 않는 일반 코드다. 감싸기 전후로 prerender 분류가 달라질 경로 자체가 없다.
2. **호출 지점별 동작이 모두 안전하다.**
   - 페이지 컴포넌트 + `generateMetadata`: 같은 렌더 스코프를 공유하므로 dedupe가 작동한다(이것이 도입 효익의 핵심).
   - `generateStaticParams`: React 렌더 밖에서 실행되므로 `cache()`는 메모이즈 없이 원함수를 그대로 호출한다(오류 없음). 현재 동작과 동일.
   - route handler(`feed.xml`)와 metadata route(`sitemap.ts`): 역시 렌더 스코프 밖 — 메모이즈 보장이 없을 뿐 동작은 현재와 동일하다. 나빠지는 경우가 없다.
3. **draft 필터링 의미도 보존된다.** `process.env.NODE_ENV` 기반 draft 분기는 cache 키와 무관하게 함수 내부에서 평가되고, 빌드 시점에 고정되는 현 의미가 그대로 유지된다.
4. **회귀 가드가 이미 CI에 있다.** turbo `test:ci`는 `dependsOn: ["build"]`로 빌드를 선행하므로, 만에 하나 분류가 바뀌면 static-rendering 테스트가 CI에서 즉시 실패한다. cache 도입 PR은 별도 장치 없이 이 가드의 보호를 받는다.

**반대로, 같은 목적이라도 다음 방식은 쓰지 말 것 (진짜 위험은 여기에 있다):**

- **모듈 레벨 Map/전역 변수 메모이제이션 금지.** `feed.xml`처럼 standalone 런타임에서 실행되는 라우트가 첫 요청 시점의 콘텐츠를 프로세스 수명 내내 서빙하게 되고, dev에서는 MDX 수정이 반영되지 않는 stale 문제가 생긴다. `React.cache()`는 렌더마다 초기화되므로 이 문제가 없다.
- **`'use cache'` 디렉티브로 fs 로더를 감싸지 말 것.** 현재 `'use cache'`는 `spotify-vinyl-server.tsx`(런타임 동적 데이터, 10초 캐시)에만 의도적으로 사용 중이다. 콘텐츠 로더에 붙이면 요청 간 캐시가 생겨 dev/런타임 신선도 관리 문제가 생기고, SSG 페이지에는 어차피 이득이 없다.
- **`unstable_cache`도 불필요.** 같은 이유.

**도입 시 검증 절차**: `pnpm --filter blog build` 후 빌드 출력의 라우트 분류(○ Static)와 `.next/prerender-manifest.json`을 도입 전과 비교하고, `test:ci`(static-rendering 테스트 포함) 그린 확인. 추가로 안심하고 싶다면 static-rendering 테스트의 `EXPECTED_SSG_PATTERNS`가 이미 전 콘텐츠 라우트를 덮고 있으므로 그대로 신뢰하면 된다.

### A-5. 테스트 커버리지 갭 보강

- **현황**: 전체 96%대이지만 구멍이 있다 — `src/entities/note/para.ts` 함수 커버리지 0%(`isValidParaCategory` 미테스트), `src/shared/ui/page-header.tsx` 50%(description 없는 분기 미테스트), `posts.ts`/`notes.ts` 분기 커버리지 70%대(draft/status 필터 엣지 케이스).
- **개선안**: 위 세 곳에 작은 단위 테스트 추가. A-1/A-2 리팩토링과 같은 PR에서 회귀 방지 테스트로 묶으면 효율적.
- **기대 효과**: 콘텐츠 필터링(draft 노출 사고 같은 실수)을 테스트가 실제로 막아주는 상태로 만듦.

### A-6. blog/garden 대응 페이지 템플릿화 (선택)

- **현황**: `app/[locale]/(main)/(content)/blog/tags/page.tsx`와 `garden/tags/page.tsx`가 구조적으로 거의 동일하다(PageHeader → Nav → TagCloud). `AGENTS.md`의 UI Contract는 "drift가 생기면 shared primitive로 흡수"를 원칙으로 명시하고 있어, 페이지 골격도 후보가 된다.
- **개선안**: `shared/ui`에 tags 인덱스 페이지 골격 컴포넌트를 추출하고 nav/태그 데이터만 슬롯으로 주입. 단, primitive(`ContentSegmentNav`, `ContentCard`, `PageHeader`) 공유는 이미 잘 되어 있으므로 효용이 낮다고 판단되면 보류 가능.
- **기대 효과**: 양쪽 동시 수정 부담 제거. 우선순위는 낮음.

---

## B. CI/CD · Turborepo 효율화

### B-1. `globalDependencies`에서 `.env*` 제거

- **현황**: `turbo.json` 루트의 `globalDependencies`에 `.env*`가 포함되어 있어 로컬 `.env.local` 한 줄 변경이 모든 워크스페이스의 모든 task 캐시를 무효화한다. build task에는 이미 `env: ["NEXT_PUBLIC_*", "ANALYZE"]`와 `passThroughEnv`가 정의되어 있어 환경변수 변화는 task 단위로 추적된다.
- **개선안**: `globalDependencies`를 `["package.json", "pnpm-lock.yaml", "turbo.json"]`으로 축소. task별 `inputs`의 `.env*`도 함께 정리. `pnpm turbo run build --filter=blog --dry-run=json`으로 해시 안정성 검증.
- **기대 효과**: 로컬·CI 캐시 적중률 상승. 작업량 5분 수준으로 효율 대비 가장 싸다.

### B-2. `blog#build` remote cache 413 근본 해결 (TURBO_CACHE_ARG 제거)

- **현황**: standalone 산출물이 커서 remote cache 업로드가 413으로 실패했고(#384), 현재는 CI의 blog turbo 호출에만 `TURBO_CACHE_ARG='--cache=local:rw,remote:r'`을 주입해 회피 중이다(turbo.json 주석 참조, #403). ci.yml과 e2e.yml 양쪽에 환경변수를 잊지 않고 넣어야 하는 휴먼 에러 여지가 있다.
- **개선안**: `blog#build`에 `outputs`를 명시해 `.next/standalone/**`을 캐시 산출물에서 제외하는 방안 검토. **전제 조건**: e2e job이 turbo 캐시 hit 시 standalone 없이도 동작하는지 확인 필요 — `scripts/start-e2e.mjs`가 standalone을 전제하므로, 캐시 hit 경로에서 standalone이 복원되지 않으면 e2e가 깨진다. (a) e2e job에서는 캐시 미스 시에만 빌드하는 현 구조 유지 + outputs 제외, (b) standalone 제외가 불가하면 현 방식 유지 + 주석으로 고정, 둘 중 검증 후 선택.
- **기대 효과**: 성공 시 CI 워크플로우에서 blog 특례 분기 제거, 설정 단순화.

### B-3. `blog-content.yml`과 ci.yml의 콘텐츠 검증 중복 정리

- **현황**: ci.yml의 blog validate job이 `validate:content / validate:garden / validate:design`을 모두 실행하는데, `blog-content.yml`이 PR/push에서 `validate:content`를 한 번 더 돈다. GitHub은 PR 이벤트에 path filter를 지원하지 않아 콘텐츠 무관 PR에도 job이 생성된다.
- **개선안**: 콘텐츠만 바뀐 PR에서 ci.yml 전체(빌드·테스트 포함)보다 빠른 피드백이 필요한지 먼저 결정. (a) 필요 없으면 blog-content.yml 삭제, (b) "콘텐츠 전용 빠른 경로"로 남길 거면 garden 검증까지 포함시키고 ci.yml과 역할을 문서화. 현재는 반쪽짜리 중복 상태가 최악.
- **기대 효과**: 워크플로우 수 감소, check 의미 명확화.

### B-4. Playwright 브라우저 캐시 / E2E 소요 시간 단축

- **현황**: e2e.yml이 Playwright 컨테이너(v1.58.2) 기반으로 앱별 병렬 실행하며, blog는 안정성을 위해 `ciWorkers: 1`이다. 브라우저 바이너리 캐시는 별도 관리되지 않는다.
- **개선안**:
  1. 컨테이너 이미지에 브라우저가 사전 포함되어 있으므로 추가 다운로드가 실제 발생하는지 로그로 먼저 확인 (발생하지 않으면 이 항목은 종료).
  2. blog E2E 스펙이 16개로 가장 많으므로, 시간이 문제가 되면 `--shard` 매트릭스로 분할해 `ciWorkers: 1` 제약을 우회.
  3. PR에서 turbo 캐시 restore-keys에 develop 기준 fallback key를 추가해 build 캐시 적중률을 올림.
- **기대 효과**: E2E 피드백 시간 단축. 측정 후 적용이 원칙(현재 병목인지부터 확인).

### B-5. promote.yml 운영성 보강

- **현황**: develop에서 CI/E2E 둘 다 성공 시 자동으로 Vercel production 배포하는 구조(이중 gate, concurrency 보호)는 견고하다. 다만 수동 트리거가 없어 긴급 재배포/특정 SHA 배포가 불가하고, gate 실패 시 알림 없이 조용히 종료되어 "develop은 그린인데 배포가 안 된 상태"를 인지하기 어렵다.
- **개선안**: `workflow_dispatch` 트리거 추가(옵션으로 ref 지정), gate 실패 시 GitHub commit status 또는 알림 step 추가.
- **기대 효과**: 배포 운영 대응력 향상, 무배포 상태의 조기 발견.

### B-6. react-doctor baseline 해소 후 blocking 전환

- **현황**: `react-doctor.yml`이 advisory 모드(`blocking: none`)로 운영 중이며 main baseline에 에러 3건이 남아 있다. 새 PR이 같은 수준의 문제를 추가해도 머지를 막지 못한다.
- **개선안**: baseline 3건을 해결(또는 suppression 문서화)한 뒤 `blocking: error`로 상향.
- **기대 효과**: 정적 품질 게이트가 실제로 게이트 역할을 하게 됨.

---

## C. Next.js 활용 · 사용자 경험

### C-1. 폰트 로딩 최적화 (LCP 개선 효과 가장 큼)

- **현황**: `app/[locale]/layout.tsx`에서 `next/font/local`로 `PretendardVariable.woff2`(2.1MB)를 `display: 'swap'`으로 로드한다. next/font가 preload는 자동 처리하지만, 한글 전체 글리프가 포함된 2.1MB는 첫 방문 시 다운로드 부담이 크고 swap에 의한 FOUT 구간이 길어진다. 추가로 OG 이미지용 `Pretendard-{Regular,SemiBold,Bold}.woff` 3종(각 1.1MB, 총 3.3MB)이 standalone 산출물에 트레이싱되어 포함된다(`next.config.mjs` `outputFileTracingIncludes`).
- **개선안**:
  1. 본문 폰트: 서브셋 빌드 도입 — Pretendard 공식 dynamic-subset 또는 `pyftsubset`으로 KS X 1001 + Latin 서브셋 생성. variable font 유지 시에도 2.1MB → 수백 KB 수준으로 감소 가능.
  2. OG 폰트: Satori는 OG 이미지에 들어가는 글리프만 필요하므로 동일하게 서브셋 woff로 교체 — standalone 크기 감소는 B-2(413 문제)에도 직접 기여한다.
  3. `size-limit` 또는 Lighthouse CI로 LCP/폰트 전송량 회귀 가드 추가 검토.
- **기대 효과**: 첫 방문 LCP 및 한글 렌더 안정화. standalone 산출물 다이어트.

### C-2. MDX 콘텐츠 이미지에 `next/image` 적용

- **현황**: `mdx-components.tsx`의 `img` 오버라이드가 lazy loading만 적용하고 `next/image`를 사용하지 않아, 콘텐츠 이미지는 AVIF/WebP 변환·srcset·CLS 방지(width/height) 혜택을 받지 못한다. `next.config.mjs`의 이미지 최적화 설정(AVIF/WebP, deviceSizes)은 준비되어 있다.
- **개선안**: `img` 오버라이드를 `next/image` 기반으로 교체. 로컬 콘텐츠 이미지는 빌드 시 dimensions를 읽어 주입(또는 frontmatter/원격은 `fill` + aspect-ratio 컨테이너). 콘텐츠 내 이미지 사용 빈도 먼저 조사 후 진행.
- **기대 효과**: 콘텐츠 이미지 전송량 감소, CLS 제거.

### C-3. 검색 인덱스 전달 방식 개선 (성장 대비)

- **현황**: blog/garden 리스트 페이지가 전체 포스트/노트의 검색용 필드를 RSC props로 클라이언트 검색 위젯에 직렬화한다. 현재 규모(수 KB~10여 KB)에서는 문제없지만, 노트가 수백 개로 늘면 모든 리스트 페이지의 RSC payload가 함께 커진다.
- **개선안**: 정적 검색 인덱스 라우트(`/[locale]/search-index.json` route handler, 빌드 시 정적 생성)를 만들고 SearchPalette가 열릴 때(Cmd+K) lazy fetch. `use cache` 디렉티브(`useCache: true` 이미 활성)와 궁합이 좋다.
- **기대 효과**: 리스트 페이지 초기 payload를 콘텐츠 수와 무관하게 유지. 임계치(예: 노트 300개 또는 payload 30KB) 도달 시 착수하는 조건부 과제로 관리.

### C-4. 라우트 세그먼트 `error.tsx` 추가

- **현황**: graph(`GraphErrorBoundary`)와 선택적 위젯(`ClientErrorBoundary`)은 부분 실패를 격리하지만, 라우트 레벨 `error.tsx`/`global-error.tsx`가 없어 예기치 못한 렌더 오류 시 Next 기본 오류 화면이 노출된다.
- **개선안**: `app/[locale]/(main)/error.tsx`(reset 버튼 + i18n 문구) 및 최소한의 `global-error.tsx` 추가. 기존 not-found.tsx와 같은 디자인 토큰 사용.
- **기대 효과**: 오류 상황에서도 브랜드 일관성 있는 UX. 작업량 소.

### C-5. `cacheComponents`(PPR) 재평가 — 문서화된 결정의 주기적 리뷰

- **현황**: `next.config.mjs:37-41` 주석에 명시된 대로, `cacheComponents`(전부 동적-기본 + PPR)를 쓰지 않고 `useCache`만 활성화한 것은 generateStaticParams 기반 static-by-default 동작을 유지하기 위한 의도적 결정이다. 이 결정은 옳다 — 다만 Spotify 위젯처럼 동적 데이터를 초기 HTML에 넣고 싶어질 때 트레이드오프가 달라진다.
- **개선안**: 지금 변경하지 않는다. Next.js 메이저 업그레이드 시점마다 (a) cacheComponents가 정적 페이지의 RSC payload 캐시 가능성을 유지하는지, (b) 동적 슬롯 요구가 생겼는지 재평가하는 체크 항목으로만 유지.
- **기대 효과**: 잘못된 방향의 "개선"(정적 서빙 회귀)을 방지하면서 기술 변화 추적.

### C-6. UX 폴리시 (낮은 우선순위 묶음)

- **View Transitions**: 카테고리/태그 전환, blog↔garden 이동에 `document.startViewTransition` 점진 적용 (미지원 브라우저 자동 폴백).
- **검색 팔레트 미세 UX**: 호버 프리뷰 등은 효용 낮음 — 사용자 피드백 있을 때만.
- (참고: 초기 분석에서 "JSON-LD에 author/inLanguage 추가" 과제가 후보였으나, 검증 결과 `src/app/seo/json-ld.ts`에 author Person(`sameAs`, `knowsAbout` 포함)·`inLanguage`·`wordCount`까지 이미 구현되어 있어 제외했다.)

---

## D. SEO · GEO (Generative Engine Optimization)

### 현재 상태 평가: SEO 기반은 이미 상위권

검증 결과 전통적 SEO 인프라는 매우 충실하다. 아래는 이미 구현된 것들이며 과제가 아니다:

- **구조화 데이터** (`src/app/seo/json-ld.ts`): WebSite + SearchAction, SiteNavigationElement, BlogPosting(author Person `@id` 참조, `sameAs` 소셜 링크, `knowsAbout`, `wordCount`, `inLanguage`, `keywords`), garden note용 Article(위키링크 기반 `mentions`/`citation` — 노트 그래프를 스키마로 노출하는 드문 수준의 구현), BreadcrumbList.
- **hreflang**: `buildAlternates`가 ko/en + `x-default`까지 생성, canonical 포함.
- **sitemap.ts**: 콘텐츠 기반 `lastModified`(카테고리/태그 단위까지 집계), 우선순위 차등.
- **robots.ts**: AI 학습 봇 9종 차단, sitemap/host 선언.
- **OG**: 포스트·노트별 정적 생성 opengraph-image, article 메타(publishedTime/modifiedTime/authors/tags).
- **RSS**: locale별 feed.xml (s-maxage 1시간).

따라서 남은 과제는 전통 SEO의 빈틈 메우기보다 **GEO — AI 검색·어시스턴트가 콘텐츠를 발견·인용하게 만드는 영역**에 있다.

### D-1. AI 크롤러 정책의 명시화 (GEO의 선결 의사결정)

- **현황**: `app/robots.ts`가 차단하는 목록(GPTBot, anthropic-ai, ClaudeBot, CCBot, Google-Extended 등)은 전부 **학습(training)용** 크롤러다. 반면 AI 검색·실시간 인용용 에이전트(OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User)는 목록에 없어 **누락에 의해 허용**되고 있다.
- **검토**: "학습은 차단, AI 검색 인용은 허용"은 GEO 관점에서 합리적인 포지션이다 — ChatGPT/Claude/Perplexity 검색 결과에 출처로 인용되면서 모델 학습 데이터로는 제공하지 않는 분리. 문제는 현재 이 포지션이 의도가 아니라 우연의 산물이라는 점이다. 봇 목록은 계속 늘어나므로(예: 신규 봇이 학습·검색 겸용이면?) 정책 없이 목록만 있으면 drift한다.
- **개선안**: robots.ts에 정책을 코드로 명시 — `AI_TRAINING_BOTS`(disallow)와 별도로 `AI_SEARCH_BOTS`(명시적 allow) 배열을 두고, 분류 기준 주석을 단다. 어느 쪽도 아닌 신규 봇의 기본 처리 방침(허용/차단)도 함께 문서화한다. **이것은 코드 작업 이전에 소유자의 정책 결정이 필요한 항목이다.**
- **기대 효과**: AI 검색 인용 가시성을 의도된 상태로 고정. 이후 D-2~D-4의 전제.

### D-2. `llms.txt` 제공

- **현황**: 미제공. llms.txt는 AI 에이전트에게 사이트 구조와 핵심 콘텐츠를 마크다운으로 안내하는 신흥 컨벤션이다 (표준은 아니며 채택률은 형성 중 — 비용이 낮아 기대값이 양수인 수준으로 평가).
- **개선안**: `app/llms.txt/route.ts` route handler 추가. 기존 `getPosts`/`getNotes` API를 재사용해 사이트 소개 + 섹션 설명 + 포스트/노트 제목·설명·URL 목록을 마크다운으로 생성. sitemap.ts와 동일하게 빌드 타임 정적 생성되도록 한다.
- **기대 효과**: AI 에이전트의 콘텐츠 발견 경로 추가. 작업량 소(반나절).

### D-3. 포스트의 마크다운 원문 엔드포인트

- **현황**: 콘텐츠 원본이 이미 MDX(마크다운)인데, 에이전트와 AI 검색은 HTML을 파싱해 본문을 복원해야 한다. wikilink·커스텀 컴포넌트가 섞인 HTML은 인용 품질을 떨어뜨린다.
- **개선안**: 슬러그별 마크다운 변형 제공 — `/[locale]/blog/[category]/[slug].md` route handler(또는 `llms-full.txt` 단일 파일)로 frontmatter 제거 + wikilink를 일반 링크로 치환한 클린 마크다운을 서빙. `getPost`의 `content`를 그대로 쓰므로 거의 공짜. llms.txt(D-2)에서 각 항목의 `.md` URL을 안내.
- **기대 효과**: AI 인용 정확도 향상, 에이전트 친화적 콘텐츠 소비 경로. D-2와 같은 PR로 묶기 좋다.

### D-4. RSS 피드 보강 (full-content + 발견성)

- **현황**: `app/[locale]/feed.xml/route.ts`가 최신 20개의 제목·description만 포함한다. AI 리트리버와 RSS 리더 모두 본문이 있는 피드를 선호한다. 또한 피드 링크가 footer 앵커로만 존재하고, HTML `<head>`의 `<link rel="alternate" type="application/rss+xml">` 광고가 없어 자동 발견(autodiscovery)이 안 된다.
- **개선안**:
  1. `content:encoded`로 본문 포함(마크다운→HTML 변환 또는 D-3의 클린 마크다운 재사용). 전체가 부담이면 최근 N개만 full로.
  2. layout `generateMetadata`의 `alternates.types`에 `application/rss+xml` 추가 — 한 줄짜리 작업.
  3. garden 노트용 피드 추가 여부 검토(선택).
- **기대 효과**: 피드 기반 구독·수집 경로 강화. autodiscovery는 즉효성 있는 소액 과제.

### D-5. sitemap에 hreflang alternates 추가

- **현황**: 페이지 메타데이터에는 hreflang이 완비되어 있지만, `app/sitemap.ts`의 각 entry에는 `alternates.languages`가 없다. Next.js sitemap API가 이를 지원하므로 ko/en 대응 URL을 sitemap 수준에서도 선언할 수 있다.
- **개선안**: sitemap entry 생성 시 `alternates: { languages: { ko: ..., en: ... } }` 추가. `buildAlternates`를 재사용해 페이지 메타데이터와 단일 소스 유지.
- **기대 효과**: 다국어 페이지 관계를 크롤러에 이중으로 신호. 검색 콘솔의 hreflang 진단 안정화.

### D-6. 콘텐츠 차원의 GEO 관행 (운영 가이드)

- **현황**: GEO의 절반은 코드가 아니라 콘텐츠 구조다. AI 검색은 질문-답 구조, 명시적 요약, 정확한 갱신일을 가진 문서를 인용하기 쉽다.
- **개선안**: 코드 과제가 아닌 `AGENTS.md` 콘텐츠 가이드 보강 — (a) 포스트 상단 TL;DR/요약 관행, (b) 핵심 섹션 헤딩을 질문형으로, (c) 내용 갱신 시 frontmatter `updated` 갱신 습관(이미 dateModified·sitemap lastModified로 연결되는 파이프라인은 완비), (d) Q&A 성격 포스트에는 FAQPage 스키마 추가 검토.
- **기대 효과**: 기존 스키마 파이프라인의 활용도를 콘텐츠 쪽에서 극대화. 작업량은 문서 한 단락.

---

## 로드맵 (권장 착수 순서)

| 순위 | 과제                                     | 분류 | 작업량 | 효과                               |
| ---- | ---------------------------------------- | ---- | ------ | ---------------------------------- |
| 1    | B-1 globalDependencies `.env*` 제거      | CI   | 소     | 캐시 적중률 즉시 개선              |
| 2    | A-1 frontmatter zod 검증                 | 설계 | 중     | 콘텐츠 오류 빌드 타임 포착         |
| 3    | A-4 React.cache() 적용                   | 설계 | 소     | 빌드 시간 단축                     |
| 4    | A-5 커버리지 갭 보강                     | 설계 | 소     | draft 노출 등 회귀 방지            |
| 5    | C-1 폰트 서브셋 (본문 + OG)              | UX   | 중     | LCP 개선 + standalone 다이어트     |
| 6    | A-2 콘텐츠 로더 공통화                   | 설계 | 중     | post/note drift 제거               |
| 7    | A-3 wikilink 단일 소스화 (스크립트 TS화) | 설계 | 중     | 검증·렌더링 규칙 일치              |
| 8    | B-3 blog-content.yml 중복 정리           | CI   | 소     | 워크플로우 단순화                  |
| 9    | B-2 blog#build outputs 정리 (검증 전제)  | CI   | 중     | 413 특례 제거                      |
| 10   | D-1 AI 크롤러 정책 명시화                | GEO  | 소     | 정책 결정 선행, 이후 D 과제의 전제 |
| 11   | D-4 RSS autodiscovery + full-content     | GEO  | 소~중  | 발견성 즉효                        |
| 12   | D-2 llms.txt + D-3 마크다운 엔드포인트   | GEO  | 중     | AI 인용 경로 확보                  |
| 13   | D-5 sitemap hreflang alternates          | GEO  | 소     | 다국어 신호 보강                   |
| 14   | C-2 MDX 이미지 next/image                | UX   | 중     | 콘텐츠 이미지 최적화               |
| 15   | B-5 promote.yml dispatch + 알림          | CI   | 소     | 배포 운영성                        |
| 16   | B-6 react-doctor blocking 전환           | CI   | 중     | 품질 게이트 실효화                 |
| 17   | C-4 error.tsx 추가                       | UX   | 소     | 오류 UX                            |
| 18   | D-6 콘텐츠 GEO 가이드 (AGENTS.md)        | GEO  | 소     | 문서 작업                          |
| 19   | C-3 검색 인덱스 분리                     | UX   | 중     | 조건부(콘텐츠 성장 시)             |
| 20   | B-4 E2E 시간 단축 (측정 후)              | CI   | 중     | 조건부(병목 확인 시)               |
| 21   | A-6 tags 페이지 템플릿화                 | 설계 | 소     | 선택                               |
| 22   | C-5 cacheComponents 재평가               | UX   | -      | 업그레이드 시 체크 항목            |
| 23   | C-6 UX 폴리시 묶음                       | UX   | 소     | 선택                               |

### 묶어서 진행하면 좋은 단위

- **콘텐츠 파이프라인 PR**: A-1 + A-2 + A-4 + A-5 (스키마 → 로더 공통화 → 캐시 → 테스트가 자연스러운 한 흐름)
- **빌드 산출물 다이어트 PR**: C-1(OG 폰트 서브셋) + B-2(outputs 정리) — standalone 크기 감소가 413 해결의 전제를 만들어 줌
- **CI 정리 PR**: B-1 + B-3 (+ B-5)
- **GEO PR**: D-1(정책 결정 후) → D-2 + D-3 한 PR(같은 콘텐츠 API 재사용) → D-4 + D-5 한 PR(피드·sitemap 소액 작업 묶음)

### 비고

- 모든 과제는 `check-types → lint → format:check → test:ci` preflight와 `pnpm --filter blog validate:design`을 통과해야 한다.
- UI에 닿는 과제(C-2, C-4, A-6)는 `AGENTS.md`의 Blog/Garden UI Contract(shared primitive 우선, semantic token, data-slot)를 따른다.
- 라우팅·레이아웃·메타데이터에 닿는 과제는 `e2e/**` 영향 범위를 함께 검토한다.
