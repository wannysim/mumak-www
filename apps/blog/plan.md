# apps/blog 개선 과제 플랜

> 2026-06-12 기준 코드베이스(`develop`, v1.7.2) 분석으로 도출한 개선 과제 목록.
> 네 가지 관점으로 분류한다: (A) 소프트웨어 설계·유지보수성, (B) CI/CD·Turborepo 효율화, (C) Next.js 활용·사용자 경험, (D) SEO·GEO.
> 각 과제는 독립적으로 진행 가능하며, 우선순위는 마지막 로드맵 섹션 참조.

## 진행 현황

PR 묶음 단위로 진행한다. 완료 시 체크하고 옆에 PR 번호를 기록한다. 과제 상세는 아래 섹션 참조.

- [x] **콘텐츠 파이프라인 PR** — A-1(zod 스키마) + A-2(로더 공통화) + A-4(React.cache) + A-5(커버리지 갭) — PR #428
- [x] **wikilink 단일 소스화 PR** — A-3(스크립트 TS화) + B-1(globalDependencies `.env*` 제거) — PR #429
- [ ] **CI 정리 PR** — B-3(blog-content.yml) + B-5(promote.yml)
- [ ] **빌드 산출물 다이어트 PR** — C-1(폰트 서브셋) + B-2(blog#build outputs, 검증 전제)
- [x] **GEO 정책 결정 + PR** — D-1(robots.ts AI 크롤러 정책: 학습봇 차단 / 검색·인용봇 명시 allow / 미분류봇 기본 허용) + D-2(llms.txt) 한 PR
- [x] **GEO PR 1** — D-2(llms.txt)+D-3(마크다운 엔드포인트) 묶음. 실제로는 D-3는 GEO PR 2와, D-2는 D-1과 함께 처리되어 둘 다 완료
- [x] **GEO PR 2** — D-4(RSS autodiscovery + full-content) + D-5(sitemap hreflang) + D-3(마크다운 엔드포인트)
- [x] **코드 생성 이미지 PR** — C-7-0(favicon, #430) + C-7-1(OG `shared/lib/og` 셸 공통화 + 긴 텍스트 동적 폰트·keep-all + locale 카테고리 라벨 + 기본 OG 이미지) — 동적 alt는 빌드 이슈로 보류
- [x] **Spotify OAuth callback 보안 보강 PR** — C-8 (state 1회 소비 누락 보강 + no-store/no-referrer/noindex 헤더 + route 단위 테스트)
- [x] **콘텐츠 GEO 가이드** — D-6 (`apps/blog/AGENTS.md`에 TL;DR·질문형 헤딩·`updated` 갱신·FAQPage 관행 추가) — C-7 PR과 함께 진행
- [ ] **개별 소액**: C-2(MDX 이미지) / C-4(error.tsx) / B-6(react-doctor blocking)
- [x] **C-3(검색 인덱스 정적 분리)** — 완료(2026-06-15, #436)
- [x] **B-2(remote cache 413 해결)** — 완료(2026-06-16, #437). standalone 중복 프리렌더를 outputs에서 제외 → 아티팩트 29.5MB(zstd), remote write 재개. 세그먼트 캐시 후속은 조사 후 비레버로 폐기(B-2 항목 참조)
- [ ] **조건부·보류**: B-4(E2E 시간, 측정 후) / A-6(선택) / C-5(업그레이드 시 재평가) / C-6(선택)

## 현재 상태 요약

전반적으로 건강한 코드베이스다. FSD 레이어 규율(앱 라우트 → widgets → features → entities → shared)이 잘 지켜지고 있고, barrel export 기반 public API, 접근성 기반 selector, 적응형 Spotify 폴링, graph 라이브러리 dynamic import, RAF 기반 스크롤 훅 등은 이미 모범적으로 구현되어 있다. 아래 과제들은 "고장난 것을 고치는" 것이 아니라 콘텐츠와 코드가 계속 성장할 때 비용이 커지는 지점을 미리 줄이는 데 초점을 둔다.

---

## A. 소프트웨어 설계 · 유지보수성

### A-1. Frontmatter 스키마 검증 도입 (zod) — 완료 (#428)

- **현황**: `src/entities/post/api/posts.ts`, `src/entities/note/api/notes.ts`가 gray-matter의 `data`(사실상 `any`)를 `data.title || 'Untitled'`, `data.date || '1970-01-01'` 식의 기본값 fallback으로만 방어한다. 잘못된 frontmatter(예: `tags`가 문자열, `date` 포맷 오류)가 타입 오류 없이 빌드를 통과해 런타임 화면에서만 드러날 수 있다. `scripts/validate-content.mjs`(236줄), `scripts/validate-garden.mjs`(443줄)에 별도의 검증 로직이 있으나 src 코드와 규칙이 이원화되어 있다.
- **개선안**:
  1. blog에 `zod` 의존성 추가 (현재 `@mumak/ui`에만 있고 blog `package.json`에는 없음).
  2. `src/shared/lib/content/schema.ts`에 `PostFrontmatterSchema`, `NoteFrontmatterSchema` 정의 (title/date/category/tags/draft, created/updated/status 등 — `AGENTS.md`의 frontmatter 계약을 코드로 옮김).
  3. `parsePostFile`/`parseNoteFile`에서 `schema.parse()`로 교체. 빌드 타임에 잘못된 콘텐츠가 즉시 실패하도록.
  4. validate 스크립트는 스키마를 재사용하는 방향으로 점진 통합 (A-3과 연계).
- **기대 효과**: 콘텐츠 추가가 잦은 저장소에서 frontmatter 오류를 빌드 타임으로 앞당김. 검증 규칙의 단일 소스 확보.

### A-2. 콘텐츠 로더 공통화 (entities/post vs entities/note) — 완료 (#428)

- **현황**: `posts.ts`(82줄)와 `notes.ts`(178줄)에 `getMdxFiles()` 파일 탐색이 각각 구현되어 있고(post는 flat, note는 재귀), frontmatter 파싱 보일러플레이트도 중복이다. draft 필터링은 note만 `isPublishable()`로 함수화되어 있고 post는 인라인(`isProduction && post.draft`)으로 일관성이 없다.
- **개선안**:
  1. `src/shared/lib/content/`에 공통 MDX 로더 추출: `listMdxFiles(dir, { recursive })`, `parseMdxFile(path, schema)` (A-1의 zod 스키마를 파라미터로 받음).
  2. draft 필터를 `isPublishable()` 하나로 통일하고 양쪽 entity가 공유.
  3. entity별 도메인 로직(post의 category, note의 wikilink/excerpt 추출)은 각 entity에 유지 — FSD 레이어 위반 없이 shared lib만 내려 쓴다.
- **기대 효과**: 새 콘텐츠 타입(예: series, til) 추가 시 로더 재구현 불필요. 한쪽만 고치는 drift 방지.

### A-3. wikilink 파싱 로직 단일 소스화 — 완료 (#429)

- **현황**: `src/shared/lib/wikilink/parser.ts`(테스트 커버리지 100%)가 마스터인데, `scripts/validate-garden.mjs:32-64`가 `parseWikilinkTarget` 등 같은 로직을 MJS로 복제하고 있다. parser 변경 시 스크립트를 수동 동기화해야 하고, 버그 수정이 한쪽에만 적용될 위험이 있다.
- **개선안**: validate 스크립트를 TypeScript로 전환(`node --experimental-strip-types` 또는 `tsx` 실행)하여 `@/src/shared/lib/wikilink`를 직접 import. `turbo.json`의 `validate:garden` inputs에 wikilink lib 경로 추가.
- **기대 효과**: wikilink 문법 확장(embed, anchor 등) 시 검증과 렌더링이 항상 동일한 규칙을 따름.

### A-4. 콘텐츠 조회에 `React.cache()` 적용 — 완료 (#428)

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

### A-5. 테스트 커버리지 갭 보강 — 완료 (#428)

- **현황**: 전체 96%대이지만 구멍이 있다 — `src/entities/note/para.ts` 함수 커버리지 0%(`isValidParaCategory` 미테스트), `src/shared/ui/page-header.tsx` 50%(description 없는 분기 미테스트), `posts.ts`/`notes.ts` 분기 커버리지 70%대(draft/status 필터 엣지 케이스).
- **개선안**: 위 세 곳에 작은 단위 테스트 추가. A-1/A-2 리팩토링과 같은 PR에서 회귀 방지 테스트로 묶으면 효율적.
- **기대 효과**: 콘텐츠 필터링(draft 노출 사고 같은 실수)을 테스트가 실제로 막아주는 상태로 만듦.

### A-6. blog/garden 대응 페이지 템플릿화 (선택)

- **현황**: `app/[locale]/(main)/(content)/blog/tags/page.tsx`와 `garden/tags/page.tsx`가 구조적으로 거의 동일하다(PageHeader → Nav → TagCloud). `AGENTS.md`의 UI Contract는 "drift가 생기면 shared primitive로 흡수"를 원칙으로 명시하고 있어, 페이지 골격도 후보가 된다.
- **개선안**: `shared/ui`에 tags 인덱스 페이지 골격 컴포넌트를 추출하고 nav/태그 데이터만 슬롯으로 주입. 단, primitive(`ContentSegmentNav`, `ContentCard`, `PageHeader`) 공유는 이미 잘 되어 있으므로 효용이 낮다고 판단되면 보류 가능.
- **기대 효과**: 양쪽 동시 수정 부담 제거. 우선순위는 낮음.

---

## B. CI/CD · Turborepo 효율화

### B-1. `globalDependencies`에서 `.env*` 제거 — 완료 (#429)

- **현황**: `turbo.json` 루트의 `globalDependencies`에 `.env*`가 포함되어 있어 로컬 `.env.local` 한 줄 변경이 모든 워크스페이스의 모든 task 캐시를 무효화한다. build task에는 이미 `env: ["NEXT_PUBLIC_*", "ANALYZE"]`와 `passThroughEnv`가 정의되어 있어 환경변수 변화는 task 단위로 추적된다.
- **개선안**: `globalDependencies`를 `["package.json", "pnpm-lock.yaml", "turbo.json"]`으로 축소. task별 `inputs`의 `.env*`도 함께 정리. `pnpm turbo run build --filter=blog --dry-run=json`으로 해시 안정성 검증.
- **기대 효과**: 로컬·CI 캐시 적중률 상승. 작업량 5분 수준으로 효율 대비 가장 싸다.

### B-2. `blog#build` remote cache 413 근본 해결 (TURBO_CACHE_ARG 제거) — 완료 (#437)

> 완료(2026-06-16, #437). **진짜 원인은 `output: standalone`이 프리렌더 출력(`.next/server`)을 `.next/standalone` 안에 한 벌 더 복제해, 캐시에 같은 산출물이 두 벌 올라가던 것.** turbo.json `blog#build` outputs에 `!.next/server/**`만 더해 top-level 복제본을 캐시에서 빼고(standalone 복제본은 유지), ci.yml/e2e.yml의 blog 전용 `--cache=local:rw,remote:r`를 제거해 remote read/write를 재개했다.
>
> - **측정 방법 정정 (중요)**: 아래 "조사·측정 결과"의 raw 바이트 수치(316.9MB, RSC 101.9MB, `.segment.rsc` 68MB 등)는 **413과 직접 무관한 지표**였다. 413은 turbo가 remote에 올리는 **zstd 압축 아티팩트** 크기에 걸린다. 실측 CI 아티팩트(`.turbo/cache/<hash>.tar.zst`, dev 오염 제거 후 clean build):
>   - top-level server 제외 전: 프리렌더 출력이 두 벌이라 과대.
>   - **top-level server 제외 후(현재 develop): 29.5MB(zstd).** 413 한도 대비 여유 충분.
>   - 로컬 `.turbo/cache` 아티팩트로 측정할 땐 `next dev`가 만든 `.next/dev`(약 357MB raw)가 `.next/**` outputs glob에 걸려 끼어드니, 측정 전 `.next`를 지우고 clean build 해야 CI와 일치한다.
> - **안전성 검증**: top-level `.next/server`를 치운 cache-hit 상황을 로컬 재현해 E2E 통과(`start-e2e.mjs`는 standalone server.js만 실행, top-level은 `next start`용이라 미사용). CI에서도 `Validate (blog)` remote write 413 없이 통과, E2E(blog) 460 그린.
> - **세그먼트 캐시 후속(아래 1') 조사 결과 (2026-06-16): 진행 안 함.** `.segment.rsc`는 raw 68MB지만 거의 중복 RSC라 zstd가 ~2MB로 압축한다(같은 압축레벨 비교: with 31.7MB / without 29.7MB → 차이 2.0MB). 이미 29.5MB로 여유가 큰 아티팩트에서 2MB 위해 standalone 런타임 prefetch 의존성 리스크·E2E 재검증·복잡도를 감수할 가치가 없다. **"68MB=67%"라는 raw 프레이밍이 오해를 부른 것**이고, 압축 후 기준으로는 비레버다. 재조사 불필요.

- **현황(완료 전)**: standalone 산출물이 커서 remote cache 업로드가 413으로 실패했고(#384), CI의 blog turbo 호출에만 `TURBO_CACHE_ARG='--cache=local:rw,remote:r'`을 주입해 회피 중이었다(#403). ci.yml과 e2e.yml 양쪽에 환경변수를 잊지 않고 넣어야 하는 휴먼 에러 여지가 있었다.
- **개선안**: `blog#build`에 `outputs`를 명시해 `.next/standalone/**`을 캐시 산출물에서 제외하는 방안 검토. **전제 조건**: e2e job이 turbo 캐시 hit 시 standalone 없이도 동작하는지 확인 필요 — `scripts/start-e2e.mjs`가 standalone을 전제하므로, 캐시 hit 경로에서 standalone이 복원되지 않으면 e2e가 깨진다. (a) e2e job에서는 캐시 미스 시에만 빌드하는 현 구조 유지 + outputs 제외, (b) standalone 제외가 불가하면 현 방식 유지 + 주석으로 고정, 둘 중 검증 후 선택.
- **기대 효과**: 성공 시 CI 워크플로우에서 blog 특례 분기 제거, 설정 단순화.
- **조사·측정 결과 (2026-06, 빌드 다이어트 착수 시 — #384의 진단이 틀렸음을 확인)**:
  - **`blog#build` outputs**: `outputs` 미선언이라 base `build`의 `[".next/**", "!.next/cache/**", ...]`를 field-merge 상속한다. 따라서 `.next/standalone/**`까지 캐시에 들어가긴 한다.
  - **그러나 측정상 standalone은 413의 주범이 아니다.** 로컬 prod 빌드 후 압축(remote 업로드와 동일) 크기:
    - 전체 `.next`(현재 413 유발 아티팩트): **316.9MB**
    - `.next/standalone` 제외 후: **285.1MB** (고작 31.7MB만 감소)
    - 즉 standalone은 압축 31.7MB(전체의 10%)뿐. outputs에서 빼도 285MB라 413은 거의 그대로다.
  - **진짜 원인 = 프리렌더 산출물 볼륨**: `.next/server/app`에 HTML **78.7MB(633개)** + RSC **101.9MB(7,359개)**. ko/ 아래 라우트 디렉터리만 2,211개(전체 ~4,400 라우트). RSC 1,372개가 30KB 초과, 100개가 100KB 초과. 리스트/태그 페이지 1장 HTML이 ~210KB. 이 본문 출력은 빌드의 핵심 산출물이라 outputs에서 제외 불가.
  - **정정 (2026-06-15, C-3 착수 시 실측)**: 위에서 "C-3와 직결"이라 본 것은 과대평가였다. 검색 필드 직렬화는 RSC 비대화의 주범이 아니다.
    - `BlogSearch`를 실제로 렌더하는 페이지는 **블로그 인덱스 + 카테고리 2종뿐**(태그 페이지는 검색 미렌더). garden 사이드바는 검색 그룹을 트리 prop에서 클라이언트로 만들 뿐이라 **검색 전용 중복 직렬화가 없다**(트리는 네비게이션용이라 SSG 유지 필수).
    - `searchPosts`(ko 19개) 직렬화 ≈ 페이지당 ~5KB. C-3로 줄어든 실측: 블로그 리스트 RSC 76.3KB→71.0KB 등 페이지당 ~5KB, 전체 빌드 기준 **~70KB(101.9MB의 ~0.07%)**.
    - RSC 101.9MB의 실제 구성: `.rsc` 33.7MB(633개) + **`.segment.rsc` 68.2MB(6,726개, 67%)**. 후자는 Next 세그먼트 캐시 아티팩트(`_full.segment.rsc` 페이지 전체 복제 포함)이고, `.rsc`의 큰 파일은 전부 garden 페이지(사이드바 노트 트리 + NoteCard 본문). **검색 데이터가 아니라 렌더된 카드/노트 본문 + 세그먼트 캐시가 볼륨의 본체다.**
  - **`remote:r`는 blog에서 사실상 죽은 옵션**: remote write가 늘 413으로 실패하면 remote에 아무것도 안 올라가므로 `remote:r`(읽기)도 영구 미스다. 즉 blog의 현 `--cache=local:rw,remote:r`는 기능상 `local:rw`와 동일하고, blog에 remote cache는 사실상 무효다.
  - **e2e 제약(여전히 유효)**: `scripts/start-e2e.mjs`는 standalone `server.js`가 없으면 CI에서 `process.exit(1)` hard-fail. `test:e2e dependsOn build`라 build 캐시 hit 시 standalone 미복원이면 깨진다(standalone을 outputs에서 빼는 시나리오의 제약).
- **정정된 결론 (최종, #437로 해결됨)**:
  - 이전 결론 "turbo `outputs` 조정으로는 413을 풀 수 없다"는 **틀렸다.** 그 결론은 raw 바이트와 dev 오염이 섞인 측정에 기댄 것이었다. 압축 아티팩트 기준으로 보면, standalone과 **중복되는 top-level `.next/server`를 outputs에서 빼는 것**만으로 아티팩트가 29.5MB(zstd)로 떨어져 413이 풀린다(#437).
  - ~~(1) **C-3 우선**~~ → **C-3 완료(2026-06-15)했으나 B-2 해결과 무관.** C-3는 정당한 payload 다이어트지만 실측 절감 ~0.07%. B-2를 C-3에 의존시킨 전제는 폐기.
  - ~~(1') **세그먼트 캐시 아티팩트가 최대 레버**~~ → **조사 후 폐기(2026-06-16).** raw 68MB는 압축하면 ~2MB라 비레버. 위 완료 노트 참조.
  - (2) 태그/저가치 라우트 prerender 축소(ISR/on-demand)는 별개의 빌드 시간/볼륨 과제로 남는다(413과는 무관해짐). 필요 시 B-4와 함께 검토.

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
- **blocking 전환 전 일괄 처리할 알려진 false positive (suppression 후보)**:
  - **`no-inline-exhaustive-style` (PR #433, C-7-1)** — `src/shared/lib/og/template.tsx`의 `OgShell`(L41)·`OgNotFound`(L126) inline style 2건. **이 규칙은 일반 React 런타임 컴포넌트를 가정하지만, 해당 파일은 `next/og`(Satori) 빌드타임 이미지 템플릿이다.** (1) Satori는 inline style만 지원하므로 권고대로 CSS class/module/Tailwind/styled-component로 옮기면 렌더링이 깨진다. (2) `generateStaticParams` 기반 빌드타임 1회 렌더라 "매 렌더마다 재생성" 성능 논리가 무관하다. → CSS 이전이 아니라 **구조적 예외로 suppression**(또는 정적 style 객체를 모듈 const로 호이스팅해 규칙 회피)으로 처리한다. `icon.tsx`·blog/garden·기본 OG 이미지의 inline style도 같은 성격이라 함께 검토.
  - **`no-side-effect-in-get-handler` 류 (C-8)** — `app/api/spotify/callback/route.ts`의 GET handler token exchange. OAuth 표준 redirect callback은 GET이며 CSRF는 state로 방어한다(C-8에서 no-store + state single-use로 보강 완료). 2단계 POST 구조 재설계 전까지 **구조적 예외**로 둔다.

---

## C. Next.js 활용 · 사용자 경험

### C-1. 폰트 로딩 최적화 (LCP 개선 효과 가장 큼)

- **현황**: `app/[locale]/layout.tsx`에서 `next/font/local`로 `PretendardVariable.woff2`(2.1MB)를 `display: 'swap'`으로 로드한다. next/font가 preload는 자동 처리하지만, 한글 전체 글리프가 포함된 2.1MB는 첫 방문 시 다운로드 부담이 크고 swap에 의한 FOUT 구간이 길어진다. 추가로 OG 이미지용 `Pretendard-{Regular,SemiBold,Bold}.woff` 3종(각 1.1MB, 총 3.3MB)이 standalone 산출물에 트레이싱되어 포함된다(`next.config.mjs` `outputFileTracingIncludes`).
- **개선안**:
  1. 본문 폰트: 서브셋 빌드 도입 — Pretendard 공식 dynamic-subset 또는 `pyftsubset`으로 KS X 1001 + Latin 서브셋 생성. variable font 유지 시에도 2.1MB → 수백 KB 수준으로 감소 가능.
  2. `size-limit` 또는 Lighthouse CI로 LCP/폰트 전송량 회귀 가드 추가 검토.
- **OG 폰트는 제외**: `og-fonts.ts`(현재 위치 `src/shared/lib/og/og-fonts.ts`) 주석에 "제목이 한국어(동적)이므로 콘텐츠 기반 subset 불가, 풀셋 woff 사용"이 문서화된 결정으로 명시되어 있다. OG 라우트는 standalone 런타임에서 on-demand 렌더될 수 있어(`next.config.mjs` 트레이싱 주석 참조) 빌드 타임 글리프 확정에 기대는 서브셋은 미사전생성 경로에서 글리프 누락(tofu) 위험이 있다. 풀셋 유지가 맞고, 재검토하려면 C-7에서 다룬다.
- **기대 효과**: 첫 방문 LCP 및 한글 렌더 안정화. 본문 variable 폰트 축소만으로도 standalone 산출물 다이어트에 기여.
- **조사·결정 (2026-06 착수)**:
  - 현황 확정: 본문 폰트는 `app/[locale]/layout.tsx`에서 `next/font/local`로 `../../public/assets/fonts/PretendardVariable.woff2`(2.1MB, `weight: '45 920'`, `display: swap`)를 로드 → self-host + preload되어 클라이언트로 전송됨(LCP 직격).
  - 코드베이스에서 실제 사용하는 font-weight는 400 / 500(`font-medium`) / 600(`font-semibold`) / 700(`font-bold`)뿐. 45~920 전 축은 불필요.
  - 서브셋 툴(`pyftsubset`/fontTools)은 현재 환경에 미설치 → 일회성 로컬 설치로 생성, **산출물은 사전 생성해 커밋**(JS 모노레포에 Python 빌드 의존성 미도입, CI 무변경).
  - **결정한 접근**: (1) 변수축을 wght 400~700로 instance, (2) charset = Latin + 전체 현대 한글(AC00–D7A3) + 한글 자모 + 공통 구두점/기호, (3) 한자·이모지 등 미포함 글리프는 fallback 폰트(`ui-sans-serif`)로 per-glyph 대체(= tofu 아님, 표준 동작). 전체 한글을 유지하므로 한국어 본문 tofu 위험 없음.
  - 회귀 가드: 서브셋 woff2 파일 크기 상한 단언 테스트(또는 size-limit) 추가. 검증은 빌드 후 한글 본문/제목 실제 렌더 + 전송량 before/after 기록.
  - 예상 절감: 한자 등 제거로 2.1MB → 대략 0.8~1.2MB(전체 한글 유지로 극적이진 않으나 본문 폰트라 안전 우선).
  - 진행 단위: B-2와 분리한 별도 PR(`feature/blog-build-diet-fonts`). B-2는 위 조사대로 보류·문서화 쪽이 유력.

### C-2. MDX 콘텐츠 이미지에 `next/image` 적용

- **현황**: `mdx-components.tsx`의 `img` 오버라이드가 lazy loading만 적용하고 `next/image`를 사용하지 않아, 콘텐츠 이미지는 AVIF/WebP 변환·srcset·CLS 방지(width/height) 혜택을 받지 못한다. `next.config.mjs`의 이미지 최적화 설정(AVIF/WebP, deviceSizes)은 준비되어 있다.
- **개선안**: `img` 오버라이드를 `next/image` 기반으로 교체. 로컬 콘텐츠 이미지는 빌드 시 dimensions를 읽어 주입(또는 frontmatter/원격은 `fill` + aspect-ratio 컨테이너). 콘텐츠 내 이미지 사용 빈도 먼저 조사 후 진행.
- **기대 효과**: 콘텐츠 이미지 전송량 감소, CLS 제거.

### C-3. 검색 인덱스 전달 방식 개선 (성장 대비) — 완료

> 완료(2026-06-15, `feature/blog-search-index`). 검색 데이터셋을 페이지 RSC props에서 빼 정적 `/[locale]/search-index.json`(route handler, SSG)으로 1회만 만들고, `BlogSearch`가 검색창을 열 때만 lazy fetch한다. 페이지는 그대로 SSG.
>
> - **신규**: `src/shared/lib/search`(타입 + 경로 헬퍼), `app/[locale]/search-index.json/route.ts`(`force-static` + `generateStaticParams` ko/en, `getPosts` 재사용 → draft 노출 정책 자동 상속), `src/shared/hooks/use-search-index.ts`(locale별 모듈 캐시, 검색 open 시 1회 fetch, 실패 시 빈 인덱스로 graceful degrade; locale은 호출부 주입 — shared 배럴이 next-intl ESM을 끌지 않게).
> - **변경**: `BlogSearch`에서 `posts` prop 제거(`useLocale` + `useSearchIndex`로 fetch), 블로그 인덱스/카테고리 page 2종에서 `searchPosts`(+ category page의 미사용 `allPosts`) 제거.
> - **실측 효과**: 블로그 리스트 RSC 페이지당 ~5KB 감소(76.3KB→71.0KB 등). 빌드 전체로는 ~70KB(~0.07%). **C-3로는 B-2(413)가 풀리지 않는다** — B-2는 별도로 standalone 중복 프리렌더 제거(#437)로 해결됐다(B-2 항목 참조). garden은 사이드바 트리에 검색이 free-ride라 추출할 중복이 없어 손대지 않았다.
> - **검증**: `blog-search.test.tsx`(fetch 모킹, 8), route `route.test.ts`(4), 전체 `test:ci` 882 그린, 검색 E2E(blog+garden) + `seo.spec.ts`에 search-index 엔드포인트 계약 E2E 2건 추가, 전부 그린. standalone 빌드에서 `/ko|en/search-index.json` 정적 생성·서빙 확인.

> **(폐기된 우선순위 상향 메모, 2026-06)**: 원래 "임계치 도달 시 착수하는 조건부 과제"였고, 한때 B-2 측정 과정에서 이 직렬화를 빌드 비대화의 주범으로 보고 "B-2 실질 해결 경로"로 승격했으나, 착수 시 실측 결과 검색 데이터는 빌드의 ~0.07%에 불과해 그 전제는 틀린 것으로 확인됐다(위 완료 노트 + B-2 정정 참조).

- **현황 (코드 확인)**: 클라이언트 검색 위젯이 **전체 포스트/노트의 검색용 필드를 props로 받아** 각 페이지 RSC payload에 통째로 직렬화한다.
  - blog: `src/widgets/blog-search/ui/blog-search.tsx`의 `BlogSearch({ posts: BlogSearchPost[] })`. `BlogSearchPost = { title, description, category, slug, tags }`. `app/[locale]/(main)/(content)/blog/page.tsx`(인덱스)와 `blog/[category]/page.tsx`(카테고리)에서 `allPosts.map(...)`으로 만들어 `<BlogSearch posts={searchPosts} />`로 내려준다.
  - garden: `src/widgets/garden-sidebar/ui/garden-sidebar.tsx`가 전체 노트로 `searchGroups`를 만들어 `SearchPalette`에 넘긴다. 사이드바는 **모든 garden 라우트**에 붙는다.
  - 공통 위젯: `src/shared/ui/search-palette.tsx`, `search-trigger.tsx`, hook `src/shared/hooks/use-search-palette-shortcut.ts`.
- **그래서 생기는 문제 (B-2 측정과 동일 근거)**: 같은 검색 데이터셋이 blog 인덱스 + 카테고리 + **태그 페이지 424개**(garden 302 + blog 122) + 모든 garden 페이지(사이드바)에 **중복 직렬화**된다. 그 결과 `.next/server/app`의 RSC가 101.9MB(7,359개, 1,372개가 30KB 초과)까지 불어난다. 노트 증가 시 모든 페이지가 함께 커지는 구조.
- **개선안 (SSG 유지가 핵심 — ISR 전환 아님)**: 검색 데이터셋을 페이지 props에서 빼고 **단일 정적 산출물** `/[locale]/search-index.json`(route handler, 빌드 타임 정적 생성)로 1회만 만든다. `SearchPalette`는 사용자가 검색을 **열 때(Cmd+K/클릭)만 그 JSON을 lazy fetch**한다. `use cache` 디렉티브(`useCache: true` 이미 활성)와 궁합이 좋다.
  - **렌더링 전략 불변**: 모든 페이지는 그대로 SSG/정적 prerender. 페이지별 빠른 정적 서빙 장점 100% 유지. 오히려 각 페이지가 검색 데이터셋을 안 싣어 **초기 payload가 줄어 더 가벼워진다**.
  - 유일한 동작 변화: 검색 데이터가 "검색창 처음 열 때" JSON 1회 fetch로 온다(매 페이지 로드마다가 아님). 검색은 가끔 여는 동작이라 순이득.
- **구현 메모**: (1) `BlogSearch`/`GardenSidebar`에서 props로 받던 검색 데이터를 위젯 내부 lazy fetch로 전환(검색 open 시 1회, 결과 메모이즈). (2) `search-index.json` route handler는 entities/post·note 로더 재사용(`React.cache()` 적용된 단일 소스). (3) locale별 분리. (4) 위젯 단위 테스트(데이터 fetch 모킹) + 검색 동작 E2E 회귀 확인. (5) draft 노트 노출 정책(`E2E_INCLUDE_DRAFT`)이 인덱스 생성에도 동일하게 적용되는지 확인.
- **기대 효과**: 리스트 페이지 초기 payload를 콘텐츠 수와 무관하게 유지. 빌드 산출물(RSC) 대폭 축소 → **B-2 413 완화**. 단, Vercel remote cache 한도 미만으로 떨어지는지는 push 후 CI에서만 확정 가능(로컬에서 한도 측정 불가) — B-2 항목의 정정된 결론 참조.

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

### C-7. 코드 생성 이미지(favicon · OG) 고도화 및 커버리지 확대

favicon과 OG 이미지는 둘 다 `next/og`(Satori) `ImageResponse`로 코드 생성되며 같은 문제 클래스(폰트 미로딩, 배경/대비, 브랜드 일관성)를 공유한다. 한 PR에서 공통 셸로 함께 정리한다.

#### C-7-0. favicon이 구글 검색결과에서 빈 흰 동그라미로 나오는 라이브 버그 (최우선) — 완료

> 완료(별도 브랜치 `feature/blog-favicon-fix`). 세 근본 원인 모두 해소:
>
> 1. `app/icon.tsx` 배경을 `transparent` → 브랜드 다크 `#0a0a0a`로, 흰 'WS'가 어떤 배경(구글 흰 칩 포함)에서도 보이게 함.
> 2. `loadOgFonts()`를 `ImageResponse`의 `fonts`로 전달 — Pretendard `fontWeight: 700`으로 렌더(이전엔 폰트 미전달로 기본 폰트·weight 무시). `fontWeight: 800`은 가용 woff(400/600/700) 기준 700으로 조정.
> 3. 정적 `.ico` 바이너리 생성 도구가 없어, `next.config.mjs` redirect로 `/favicon.ico` → `/icon`(PNG, 307) 매핑. 루트 직접 요청 크롤러가 코드 생성 아이콘을 받게 함. `app/icon.tsx`가 `<link rel="icon" type="image/png">`을 별도 제공.
>
> 검증: 빌드 후 `/icon` 200·image/png·512x512 PNG(17KB, 글리프 임베드 확인), 다크 배경+흰 'WS' 시각 확인, `/favicon.ico` 307→/icon, 홈 `<link rel="icon">` 존재. `e2e/seo.spec.ts`에 favicon E2E 3건 추가. C-7-1(OG 고도화)은 미진행.

- **증상**: 구글 검색결과에 사이트 favicon이 글자 없이 흰 동그라미만 보인다.
- **근본 원인** (`app/icon.tsx`):
  1. `backgroundColor: 'transparent'` + `color: '#ffffff'` 조합. 구글 검색결과는 favicon을 밝은 배경의 둥근 칩 안에 렌더하므로, 투명 배경 위 흰 "WS" 글자가 흰 칩에 묻혀 사라진다. 다크 테마 브라우저 탭에서는 정상으로 보여 그동안 드러나지 않았다.
  2. `fontFamily: 'Pretendard, system-ui, ...'`라고 지정했지만 `ImageResponse`에 `fonts` 옵션을 넘기지 않는다. Satori는 시스템 폰트를 쓸 수 없어 번들 기본 폰트(regular)로 렌더되고 `fontWeight: 800`도 매칭 폰트가 없어 무시된다. OG 라우트가 `loadOgFonts`를 넘기는 것과 달리 icon에는 폰트 로딩이 빠져 있다.
  3. `/favicon.ico` 정적 폴백이 없다 — `app/icon.tsx`만 존재. 일부 크롤러·구형 클라이언트는 루트 `/favicon.ico`를 직접 요청한다.
- **개선안**:
  1. 배경을 투명 대신 브랜드 다크(`#0a0a0a`, manifest `theme_color`·OG 배경과 동일)로 채운 둥근 사각형/원으로. 어떤 배경 위에서도 흰 "WS"가 보이게.
  2. `loadOgFonts`(Bold 600/700)를 `ImageResponse`에 전달해 Pretendard로 렌더 — OG 이미지와 브랜드 일관성 확보.
  3. `app/favicon.ico` 정적 파일 추가(루트 폴백). 구글 favicon 가이드라인(정사각형, robots 비차단 — `/icon`은 이미 허용 경로)은 나머지 충족.
- **배포 후**: 코드 수정만으로 sitemap 재제출이 필요한 건 아니다. 구글은 favicon을 자체 주기(수일~수주)로 별도 갱신한다. 다만 Search Console에서 홈 URL 검사 → 색인 생성 요청으로 갱신을 앞당길 수 있다. 수정 없이 재크롤만 하면 현재의 투명-흰색 아이콘이 다시 캐시될 뿐이므로 코드 수정이 선행되어야 한다.
- **검증**: 빌드 후 `/icon`·`/favicon.ico`를 흰 배경 위에 올려 글자가 보이는지 확인. `e2e/seo.spec.ts`/`e2e/font.spec.ts`에 icon 관련 단언이 있는지 확인하고 없으면 추가.

#### C-7-1. OG 이미지 템플릿 고도화 및 커버리지 확대 — 완료

> 완료. 네 갭 모두 해소:
>
> 1. **긴 텍스트**: 최장 ko 제목(41자 "React Compiler가 Rust로…")을 빌드 산출물로 렌더해 시각 검증 — `WebkitLineClamp` + `-webkit-box` 조합이 Satori에서 정상 동작 확인. `resolveTitleFontSize(title, locale)`로 글자수 기반 동적 폰트(ko: 26/42자 → 56/48px, en: 46/70자 → 56/48px, 음절폭 차이로 locale별 임계 분리) + `wordBreak: 'keep-all'` 적용. OG 카드는 피드에서 작게 노출되므로 가독성을 위해 제목을 3줄(`OG_TITLE_LINES`)까지 허용하고 폰트 하한을 48px로 둬, 긴 제목이 안 깨지면서도 충분히 큰 상태를 유지한다(초안의 44px 하한·2줄은 카드 세로 공간이 비는데 글자만 작아져 폐기).
> 2. **locale**: category 라벨을 `getCategoryLabel`(entities/post 단일 소스, 에세이/아티클/노트)로 교체 — 포스트 페이지 breadcrumb의 인라인 `staticTranslations.category`도 같은 소스를 쓰도록 통합. (`generateImageMetadata` 기반 동적 alt는 이 Next 버전에서 `generateStaticParams`와 함께 쓰면 `[__metadata_id__]` 라우트 수집 중 크래시해 보류 — 개선된 정적 alt로 대체.)
> 3. **커버리지**: `app/[locale]/opengraph-image.tsx` 기본 브랜드 이미지 추가 — 파일 하나로 home·blog/garden 인덱스·tags·about·now가 자동 커버됨(빌드 HTML의 og:image가 `/{locale}/opengraph-image`를 가리킴 확인).
> 4. **공통화**: `src/shared/lib/og/template.tsx`에 `OgShell`/`OgClampText`/`OgEyebrow`/`OgFooter`/`OgNotFound`/`resolveTitleFontSize`/`OG_SIZE`/`OG_COLORS` 추출 — favicon(`icon.tsx`)은 이미 `loadOgFonts` 공유 중이고, blog/garden/기본 이미지가 셸을 공유.
>
> Satori 함정 기록: React와 달리 Satori는 `undefined` style 값을 거르지 않고 `.trim()`을 호출해 크래시한다(`weight`/`lineHeight` 미지정 시). `OgClampText`는 선택 속성을 값이 있을 때만 style 객체에 넣어 회피한다. 검증: `resolveTitleFontSize`·`getCategoryLabel` 단위 테스트, `e2e/seo.spec.ts`에 og:image 메타·PNG 서빙 E2E 추가, `pnpm --filter blog build`(900/900) + `test:ci`(865) 그린.

- **현황**: 코드 기반 OG 이미지 생성은 이미 구현되어 있다 — `blog/[category]/[slug]/opengraph-image.tsx`와 `garden/[slug]/opengraph-image.tsx`가 `next/og`(Satori) + Pretendard woff(400/600/700)로 1200x630 이미지를 `generateStaticParams` 기반 정적 생성한다. 제목(64px bold)과 설명(28px muted)은 분리되어 있고 각각 2줄 clamp, garden은 status 뱃지(locale별 라벨·색상)까지 갖췄다. 남은 갭은 다음 네 가지다:
  1. **긴 텍스트 처리의 신뢰성 미검증**: clamp가 `WebkitLineClamp` + `-webkit-box` 조합인데, Satori는 브라우저가 아니라 비표준 `lineClamp` 속성을 별도로 지원하는 엔진이다. 이 조합이 Satori에서 실제로 동작하는지 최장 제목/설명 케이스로 검증된 적이 없다 — 동작하지 않으면 긴 제목이 잘리지 않고 넘친다.
  2. **locale 대응 불완전**: blog 템플릿의 category 라벨이 raw slug 대문자("ESSAY")로 고정 — ko 공유 시에도 영문. garden은 라벨을 locale별로 처리하므로 비대칭. `export const alt`도 'Blog Post' 정적 문자열이라 스크린리더/접근성 관점에서 빈약하다.
  3. **커버리지가 슬러그 페이지 2종뿐**: 홈, blog 인덱스/카테고리, garden 인덱스, tags, about, now를 공유하면 OG 이미지가 아예 없다.
  4. **템플릿 중복**: 배경/푸터 브랜딩("Wan Sim / wannysim.com")/Not Found 폴백이 blog·garden 두 파일에 복붙되어 있어 디자인 변경 시 drift 위험.
- **개선안**:
  1. 긴 텍스트: 최장 ko/en 제목·설명 케이스를 로컬에서 `/{locale}/blog/.../opengraph-image` URL로 직접 렌더해 시각 검증. clamp가 동작하지 않으면 Satori 네이티브 `lineClamp` 속성으로 교체. 추가로 글자수 기반 동적 폰트 크기(예: 제목 30자 초과 시 64→52px, 50자 초과 시 44px)와 한국어 줄바꿈 `wordBreak: 'keep-all'` 적용. 글자수 임계는 ko(음절)와 en(단어)이 다르므로 locale별로 분리.
  2. locale: category 라벨을 ko/en 매핑(에세이/아티클/노트)으로 교체 — 페이지 쪽 `staticTranslations`와 단일 소스로 공유. `generateImageMetadata`로 포스트 제목 기반 동적 alt 생성.
  3. 커버리지: `app/[locale]/opengraph-image.tsx`에 사이트 기본 브랜드 이미지 1종 추가 — Next 파일 컨벤션상 하위 세그먼트에 상속되고 슬러그 레벨 구현이 우선하므로, 파일 하나로 나머지 전 페이지가 커버된다.
  4. 공통화: 공통 셸(배경, 푸터, clamp 텍스트 블록, Not Found 폴백)을 `src/shared/lib/og/`에 template 컴포넌트로 추출하고 favicon(`icon.tsx`)·blog/garden·기본 이미지가 브랜드 배경·폰트 로딩을 공유.
- **기대 효과**: 카카오톡/슬랙/X 등에 링크 공유 시 모든 페이지가 일관된 브랜드 이미지로 노출. 긴 제목에서도 깨지지 않는 카드. 포스트에 이미지를 직접 넣지 않아도 되는 현 워크플로우 유지.
- **검증**: 대표 케이스(최장 ko 제목, 최장 en 제목, 설명 없음, 기본 이미지)를 빌드 후 산출물로 확인. `e2e/seo.spec.ts`에 og:image 메타 존재 검증이 있는지 확인하고 없으면 추가.

### C-8. Spotify OAuth callback 보안 보강 (React Doctor Security 경고 대응) — 완료

> 완료. GET callback이 OAuth 표준이라는 전제를 유지하면서 토큰 노출 표면을 보강:
>
> 1. **state 1회 소비 누락 해소**: `finalizeAfterStateCheck()`로 state 검증 통과 이후의 모든 응답 경로(성공/토큰 실패/예외 + `SPOTIFY_CLIENT_*` 누락 500)에서 `spotify_auth_state`를 삭제. 이전엔 env 누락 500 경로가 cookie를 소비하지 않아 "1회 소비" 주석과 어긋났다.
> 2. **응답 헤더 보강**: `harden()`이 모든 응답에 `Cache-Control: no-store, private` / `Pragma: no-cache` / `Referrer-Policy: no-referrer` / `X-Robots-Tag: noindex`를 부여 — refresh token HTML과 토큰 교환 실패 응답이 브라우저/프록시 캐시에 남거나 Referer로 새는 위험 차단.
> 3. **route 단위 테스트 추가**(`app/api/spotify/callback/__tests__/route.test.ts`, node env): state mismatch에서 token endpoint 미호출·cookie 미소비, env 누락 500에서 cookie 소비, 토큰 실패/성공에서 cookie 소비 + 보안 헤더, 성공 HTML에 refresh token 포함.
> 4. **주석 명확화**: "React Doctor 경고 무시"가 아니라 "OAuth callback은 GET이 표준이며 CSRF는 state로 방어, 이 route는 no-store + state single-use로 보강"으로 유지.
>
> 검증: `pnpm --filter blog test -- app/api/spotify/callback`(4 passed), `check-types`·`lint`·`format:check` 그린. GET handler의 token exchange(side effect)는 OAuth 구조상 불가피하므로 React Doctor Security 경고는 구조적 예외로 남으며, B-6에서 baseline/suppression으로 처리한다.

- **현황**: `app/api/spotify/callback/route.ts`는 Spotify Authorization Code Flow의 redirect URI이므로 GET으로 `code`/`state`를 받는다. 이후 같은 handler 안에서 Spotify token endpoint로 `fetch(..., { method: 'POST' })`를 호출해 refresh token을 발급받는다. React Doctor는 "GET handler의 side effect"로 경고하지만, OAuth callback 자체는 provider가 브라우저 redirect로 호출하는 GET 경로라 단순히 `POST` handler로 바꾸면 인증 플로우가 깨진다. 현재 CSRF 방어는 `spotify_auth_state` httpOnly cookie와 URL `state` 대조, 10분 만료, `sameSite: 'lax'`로 구현되어 있다.
- **판단**: 이 경고는 일반적인 "GET이 서버 상태를 바꾸면 CSRF 위험" 원칙으로는 맞지만, 이 파일은 OAuth 표준 redirect callback이라는 특수 케이스다. 따라서 1차 개선은 GET을 POST로 바꾸는 것이 아니라, GET callback 전제를 유지하면서 토큰 응답과 state 소비 경로를 더 엄격하게 만드는 쪽이 맞다. React Doctor 경고 자체를 완전히 없애려면 GET callback이 중간 HTML을 반환하고 same-origin `POST` route가 token exchange를 수행하는 2단계 구조가 필요하지만, 작업량 대비 이득은 별도 검토가 필요하다.
- **개선안**:
  1. state 검증 통과 이후의 모든 응답 경로에서 `spotify_auth_state`를 소비하도록 정리한다. 특히 `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` 누락으로 500을 반환하는 경로도 state cookie를 삭제해야 주석의 "1회 소비" 계약과 일치한다.
  2. refresh token을 담은 HTML 응답과 token exchange 실패 응답에 `Cache-Control: no-store, private`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`, 필요 시 `X-Robots-Tag: noindex`를 추가한다. 토큰이 브라우저/프록시 캐시에 남거나 이후 navigation의 Referer로 새는 위험을 줄인다.
  3. route 단위 테스트를 추가한다: state mismatch에서는 token endpoint를 호출하지 않음, env 누락/토큰 실패/성공 경로에서 state cookie를 소비함, 성공 HTML에 no-store/referrer 정책 헤더가 붙음.
  4. 코드 주석을 "React Doctor 경고를 무시한다"가 아니라 "OAuth callback은 GET이 표준이며 CSRF는 state로 방어한다. 이 route는 no-store + state single-use로 보강한다"는 형태로 명확히 유지한다.
- **기대 효과**: 실제 사용자 영향은 작지만, refresh token이 노출되는 일회성 관리 화면의 캐시/리퍼러 위험을 줄이고 OAuth state single-use 계약을 테스트로 고정한다. B-6(react-doctor baseline 해소) 전에 처리하면 Security 경고의 실질 위험을 낮춘 상태에서 remaining warning을 "OAuth callback 구조상 남는 항목"으로 판단할 수 있다.
- **검증**: `app/api/spotify/callback/route.ts` 단위 테스트 추가 후 `pnpm --filter blog test -- app/api/spotify/callback`, `pnpm turbo run lint --filter=blog`, `pnpm turbo run check-types --filter=blog` 실행. 필요하면 `npx react-doctor@latest --verbose`로 이 경고가 남는지 확인하고, 남는 경우 B-6에서 baseline/suppression 정책을 별도로 결정한다.

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

### D-1. AI 크롤러 정책의 명시화 (GEO의 선결 의사결정) — 완료

> 완료. 소유자 결정: (1) 검색·실시간 인용 봇(OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User)을 **명시적 allow**, (2) 어느 분류에도 없는 신규 봇은 **기본 허용(denylist 방식)**. `app/robots.ts`에 `AI_TRAINING_BOTS`(disallow)/`AI_SEARCH_BOTS`(explicit allow) 두 배열과 분류 기준·기본 처리 방침 주석을 코드로 박았다. `robots.test.ts`에 "검색봇은 절대 disallow되지 않음" + "명시적 allow 그룹 존재" 단언 추가, `e2e/seo.spec.ts`에 robots.txt 정책 E2E 추가.

- **현황**: `app/robots.ts`가 차단하는 목록(GPTBot, anthropic-ai, ClaudeBot, CCBot, Google-Extended 등)은 전부 **학습(training)용** 크롤러다. 반면 AI 검색·실시간 인용용 에이전트(OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User)는 목록에 없어 **누락에 의해 허용**되고 있다.
- **검토**: "학습은 차단, AI 검색 인용은 허용"은 GEO 관점에서 합리적인 포지션이다 — ChatGPT/Claude/Perplexity 검색 결과에 출처로 인용되면서 모델 학습 데이터로는 제공하지 않는 분리. 문제는 현재 이 포지션이 의도가 아니라 우연의 산물이라는 점이다. 봇 목록은 계속 늘어나므로(예: 신규 봇이 학습·검색 겸용이면?) 정책 없이 목록만 있으면 drift한다.
- **개선안**: robots.ts에 정책을 코드로 명시 — `AI_TRAINING_BOTS`(disallow)와 별도로 `AI_SEARCH_BOTS`(명시적 allow) 배열을 두고, 분류 기준 주석을 단다. 어느 쪽도 아닌 신규 봇의 기본 처리 방침(허용/차단)도 함께 문서화한다. **이것은 코드 작업 이전에 소유자의 정책 결정이 필요한 항목이다.**
- **기대 효과**: AI 검색 인용 가시성을 의도된 상태로 고정. 이후 D-2~D-4의 전제.

### D-2. `llms.txt` 제공 — 완료

> 완료. `app/llms.txt/route.ts`(force-static, 루트 도메인 `/llms.txt`)가 `buildLlmsTxt()`(`src/app/seo/llms-txt.ts`)로 사이트 소개 + `.md` 원문 관행 안내 + locale별 Blog/Garden 섹션(제목·설명·URL 목록)을 마크다운으로 생성. 블로그 항목은 D-3의 `.md` 클린 마크다운 URL을, garden은 노트 페이지 URL을 가리킨다. `getPosts`/`getNotes`를 재사용(React.cache)하고 sitemap/robots와 동일하게 빌드 타임 정적 생성(`○ /llms.txt`). 빌더·route 단위 테스트 + E2E 추가.

- **현황**: 미제공. llms.txt는 AI 에이전트에게 사이트 구조와 핵심 콘텐츠를 마크다운으로 안내하는 신흥 컨벤션이다 (표준은 아니며 채택률은 형성 중 — 비용이 낮아 기대값이 양수인 수준으로 평가).
- **개선안**: `app/llms.txt/route.ts` route handler 추가. 기존 `getPosts`/`getNotes` API를 재사용해 사이트 소개 + 섹션 설명 + 포스트/노트 제목·설명·URL 목록을 마크다운으로 생성. sitemap.ts와 동일하게 빌드 타임 정적 생성되도록 한다.
- **기대 효과**: AI 에이전트의 콘텐츠 발견 경로 추가. 작업량 소(반나절).

### D-3. 포스트의 마크다운 원문 엔드포인트 — 완료

- **현황**: 콘텐츠 원본이 이미 MDX(마크다운)인데, 에이전트와 AI 검색은 HTML을 파싱해 본문을 복원해야 한다. wikilink·커스텀 컴포넌트가 섞인 HTML은 인용 품질을 떨어뜨린다.
- **개선안**: 슬러그별 마크다운 변형 제공 — `/[locale]/blog/[category]/[slug].md` route handler(또는 `llms-full.txt` 단일 파일)로 frontmatter 제거 + wikilink를 일반 링크로 치환한 클린 마크다운을 서빙. `getPost`의 `content`를 그대로 쓰므로 거의 공짜. llms.txt(D-2)에서 각 항목의 `.md` URL을 안내.
- **완료**: route handler `app/[locale]/(main)/(content)/blog/[category]/[slug]/raw/route.ts`(SSG, `force-static` + `generateStaticParams`)가 `toPostDocumentMarkdown`(H1 제목 + 설명 + canonical 링크 + wikilink→일반 링크 변환 본문)을 `text/markdown`으로 서빙. pretty `.md` URL은 `next.config.mjs`의 `beforeFiles` rewrite(`/:locale/blog/:category/:slug.md` → `.../raw`)로 매핑 — `[slug]` 페이지가 `first.md`를 먼저 가로채지 않도록 beforeFiles 사용. wikilink 변환은 `transformWikilinksToMarkdown`(parser·정규식을 `transformWikilinks`와 공유, A-3 단일 소스 유지)로 처리. blog 포스트엔 현재 wikilink가 없지만 추가돼도 안전. 단위 테스트(transformer/markdown formatter) + E2E(`.md` 200/text/markdown, 비-`.md` 페이지 정상)로 검증.
- **기대 효과**: AI 인용 정확도 향상, 에이전트 친화적 콘텐츠 소비 경로. D-2와 같은 PR로 묶기 좋다.

### D-4. RSS 피드 보강 (full-content + 발견성) — 완료 (garden 피드만 선택 보류)

- **현황**: `app/[locale]/feed.xml/route.ts`가 최신 20개의 제목·description만 포함한다. AI 리트리버와 RSS 리더 모두 본문이 있는 피드를 선호한다. 또한 피드 링크가 footer 앵커로만 존재하고, HTML `<head>`의 `<link rel="alternate" type="application/rss+xml">` 광고가 없어 자동 발견(autodiscovery)이 안 된다.
- **개선안**:
  1. `content:encoded`로 본문 포함(마크다운→HTML 변환 또는 D-3의 클린 마크다운 재사용). 전체가 부담이면 최근 N개만 full로. — **완료**: D-3의 `bodyToMarkdown`(wikilink→링크) + `markdownToHtml`(marked, GFM)로 본문을 HTML로 변환해 `content:encoded`(CDATA, `]]>` 이스케이프)로 최신 20개 포함. `xmlns:content` 네임스페이스 추가. blog 포스트의 JSX 데모는 전부 코드펜스 안이라 `<pre><code>`로 이스케이프되어 피드에 raw JSX가 새지 않음(테스트로 고정). 마크다운→HTML은 remark 생태계(ESM, Jest 변환 이슈) 대신 zero-dep `marked`를 써서 사이트 MDX 렌더링과 분리된 경량 경로로 둠. E2E로 `content:encoded` 존재 검증.
  2. layout `generateMetadata`의 `alternates.types`에 `application/rss+xml` 추가 — **완료**. layout이 static `metadata`라 locale을 모르고, 콘텐츠 페이지가 `alternates`를 통째로 override하므로(Next.js shallow merge), 단일 소스인 `buildAlternates`에 `types`를 추가해 모든 콘텐츠 페이지가 `<link rel="alternate" type="application/rss+xml" href="/{locale}/feed.xml">`를 자동으로 광고하도록 했다. 빌드 산출물 602개 HTML에서 locale별로 올바르게 출력됨을 확인.
  3. garden 노트용 피드 추가 여부 검토(선택). — 미진행(선택 항목).
- **기대 효과**: 피드 기반 구독·수집 경로 강화. autodiscovery는 즉효성 있는 소액 과제.

### D-5. sitemap에 hreflang alternates 추가 — 완료

- **현황**: 페이지 메타데이터에는 hreflang이 완비되어 있지만, `app/sitemap.ts`의 각 entry에는 `alternates.languages`가 없다. Next.js sitemap API가 이를 지원하므로 ko/en 대응 URL을 sitemap 수준에서도 선언할 수 있다.
- **개선안**: sitemap entry 생성 시 `alternates: { languages: { ko: ..., en: ... } }` 추가. `buildAlternates`를 재사용해 페이지 메타데이터와 단일 소스 유지.
- **완료**: `app/sitemap.ts`에 `localizedEntry(locale, path, fields)` 헬퍼를 도입해 URL과 `alternates.languages`를 `buildAlternates` 한 곳에서 만든다(URL 조립 중복 제거 + hreflang 동시 부여). 각 entry가 ko/en/x-default 세 hreflang을 갖고, sitemap.xml 산출물에서 `<xhtml:link rel="alternate" hreflang="...">`로 출력됨을 확인. `__tests__/app/sitemap.test.ts`에 alternates 단언 추가.
- **기대 효과**: 다국어 페이지 관계를 크롤러에 이중으로 신호. 검색 콘솔의 hreflang 진단 안정화.

### D-6. 콘텐츠 차원의 GEO 관행 (운영 가이드) — 완료

> 완료. `apps/blog/AGENTS.md`에 "콘텐츠 GEO 관행" 섹션을 추가 — (a) 포스트 상단 TL;DR/요약, (b) 핵심 섹션 헤딩 질문형, (c) 수정 시 frontmatter `updated`/`date` 갱신 습관(dateModified·sitemap lastModified 파이프라인과 연결), (d) Q&A 성격 글의 FAQPage 스키마 검토. C-7(코드 생성 이미지) PR과 함께 묶어 진행.

- **현황**: GEO의 절반은 코드가 아니라 콘텐츠 구조다. AI 검색은 질문-답 구조, 명시적 요약, 정확한 갱신일을 가진 문서를 인용하기 쉽다.
- **개선안**: 코드 과제가 아닌 `AGENTS.md` 콘텐츠 가이드 보강 — (a) 포스트 상단 TL;DR/요약 관행, (b) 핵심 섹션 헤딩을 질문형으로, (c) 내용 갱신 시 frontmatter `updated` 갱신 습관(이미 dateModified·sitemap lastModified로 연결되는 파이프라인은 완비), (d) Q&A 성격 포스트에는 FAQPage 스키마 추가 검토.
- **기대 효과**: 기존 스키마 파이프라인의 활용도를 콘텐츠 쪽에서 극대화. 작업량은 문서 한 단락.

---

## 로드맵 (권장 착수 순서)

| 순위 | 과제                                     | 분류 | 작업량 | 효과                               |
| ---- | ---------------------------------------- | ---- | ------ | ---------------------------------- |
| 1    | C-7-0 favicon 라이브 버그 수정           | UX   | 소     | 구글 검색결과 빈 아이콘 즉시 해결  |
| 2    | B-1 globalDependencies `.env*` 제거      | CI   | 소     | 캐시 적중률 즉시 개선              |
| 3    | A-1 frontmatter zod 검증                 | 설계 | 중     | 콘텐츠 오류 빌드 타임 포착         |
| 4    | A-4 React.cache() 적용                   | 설계 | 소     | 빌드 시간 단축                     |
| 5    | A-5 커버리지 갭 보강                     | 설계 | 소     | draft 노출 등 회귀 방지            |
| 6    | C-8 Spotify OAuth callback 보안 보강     | UX   | 소     | 토큰 응답 캐시/리퍼러 위험 축소    |
| 7    | C-1 폰트 서브셋 (본문)                   | UX   | 중     | LCP 개선 + standalone 다이어트     |
| 8    | A-2 콘텐츠 로더 공통화                   | 설계 | 중     | post/note drift 제거               |
| 9    | A-3 wikilink 단일 소스화 (스크립트 TS화) | 설계 | 중     | 검증·렌더링 규칙 일치              |
| 10   | B-3 blog-content.yml 중복 정리           | CI   | 소     | 워크플로우 단순화                  |
| 11   | B-2 blog#build outputs 정리 (검증 전제)  | CI   | 중     | 완료(2026-06-16, #437) — 413 해결  |
| 12   | D-1 AI 크롤러 정책 명시화                | GEO  | 소     | 정책 결정 선행, 이후 D 과제의 전제 |
| 13   | D-4 RSS autodiscovery + full-content     | GEO  | 소~중  | 발견성 즉효                        |
| 14   | D-2 llms.txt + D-3 마크다운 엔드포인트   | GEO  | 중     | AI 인용 경로 확보                  |
| 15   | D-5 sitemap hreflang alternates          | GEO  | 소     | 다국어 신호 보강                   |
| 16   | C-7-1 OG 이미지 고도화 + 커버리지        | UX   | 중     | 링크 공유 경험, 전 페이지 커버     |
| 17   | C-2 MDX 이미지 next/image                | UX   | 중     | 콘텐츠 이미지 최적화               |
| 18   | B-5 promote.yml dispatch + 알림          | CI   | 소     | 배포 운영성                        |
| 19   | B-6 react-doctor blocking 전환           | CI   | 중     | 품질 게이트 실효화                 |
| 20   | C-4 error.tsx 추가                       | UX   | 소     | 오류 UX                            |
| 21   | D-6 콘텐츠 GEO 가이드 (AGENTS.md)        | GEO  | 소     | 문서 작업                          |
| 22   | C-3 검색 인덱스 분리                     | UX   | 중     | 완료(2026-06-15)                   |
| 23   | B-4 E2E 시간 단축 (측정 후)              | CI   | 중     | 조건부(병목 확인 시)               |
| 24   | A-6 tags 페이지 템플릿화                 | 설계 | 소     | 선택                               |
| 25   | C-5 cacheComponents 재평가               | UX   | -      | 업그레이드 시 체크 항목            |
| 26   | C-6 UX 폴리시 묶음                       | UX   | 소     | 선택                               |

> favicon(C-7-0)은 라이브 버그라 로드맵 1순위로 올렸지만, OG 고도화(C-7-1)와 같은 `next/og` 코드·공통 셸을 건드리므로 **코드 생성 이미지 PR 하나로 함께 처리**한다(아래 묶음 참조).

### 묶어서 진행하면 좋은 단위

- **콘텐츠 파이프라인 PR**: A-1 + A-2 + A-4 + A-5 (스키마 → 로더 공통화 → 캐시 → 테스트가 자연스러운 한 흐름)
- **빌드 산출물 다이어트 PR**: C-1(본문 폰트 서브셋) + B-2(outputs 정리) — standalone 크기 감소가 413 해결의 전제를 만들어 줌
- **CI 정리 PR**: B-3 (+ B-5)
- **GEO PR**: D-1(정책 결정 후) → D-2 + D-3 한 PR(같은 콘텐츠 API 재사용) → D-4 + D-5 한 PR(피드·sitemap 소액 작업 묶음)
- **코드 생성 이미지 PR**: C-7 단독 — favicon 버그 수정(C-7-0) 먼저 + 템플릿 공통화(`shared/lib/og` 셸·폰트 로딩) → OG 긴 텍스트/locale 보강 → 기본 OG 이미지 추가(C-7-1) 순서로 한 PR 안에서 진행. favicon은 단독으로 먼저 빼서 빠르게 배포하고 싶으면 분리 가능.
- **Spotify OAuth callback 보안 보강 PR**: C-8 단독 권장 — `app/api/spotify/*` route와 테스트만 건드리는 소액 보안 작업이다. B-6(react-doctor baseline 해소) 전 선행하면 Security 경고의 실질 위험을 먼저 줄이고, 남는 React Doctor 경고를 구조적 예외로 볼지 2단계 POST 구조로 재설계할지 판단하기 쉽다.

### 비고

- 모든 과제는 `check-types → lint → format:check → test:ci` preflight와 `pnpm --filter blog validate:design`을 통과해야 한다.
- UI에 닿는 과제(C-2, C-4, C-7, A-6)는 `AGENTS.md`의 Blog/Garden UI Contract(shared primitive 우선, semantic token, data-slot)를 따른다.
- 라우팅·레이아웃·메타데이터에 닿는 과제는 `e2e/**` 영향 범위를 함께 검토한다.
