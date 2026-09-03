# 기준선 audit

> `apps/blog/plan.md` 단계 0 산출물. 새 추상화를 만들기 전에 **지금 무엇이 있고 무엇이 새는지**만 기록한다.
>
> 측정 기준: commit `03f7928`, 2026-08-25. 수치는 전부 이 저장소에서 직접 실행해 얻었고, 재현 명령을 각 절에 적었다.

## 요약

| 영역        | 지금 상태                                                              | 판단                                              |
| ----------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| color token | semantic 이름은 이미 있고 규율도 지켜진다 (`validate:design` 위반 0건) | 이름이 아니라 **값의 대비**가 문제                |
| 대비        | light `--ring` 2.82:1 로 비텍스트 최소치 3:1 미달                      | 포커스 표시 전반에 영향. 단계 1의 1순위           |
| motion      | duration 4종, easing 4종이 전부 하드코딩. 공유 token 0개               | 반복 확인됨. token 후보                           |
| 반응 축소   | `motion-reduce`가 Spotify 위젯에만 있음                                | 본문 표면 전체가 무방비                           |
| component   | `packages/ui` 56개 설치 중 앱이 쓰는 건 22개                           | "설치됨"과 "지원됨"이 분리돼 있지 않음            |
| 테스트      | 1079개 통과, 대상 primitive 라인 커버리지 100%                         | 구조는 덮지만 **상태(hover/focus/disabled)는 0%** |
| FSD 경계    | 같은 레이어 cross-import 4건, 그중 1건은 public API 우회               | 문서화된 규칙인데 검사가 없음                     |
| 상태        | 포커스가 자체 ring과 전역 outline 폴백 두 갈래로 갈림                  | 계약에 어느 쪽인지 명시 필요                      |

## 1. 대표 화면 기준선

`docs/design-system/baselines/`에 10개 화면 × light/dark × desktop/mobile = 36장.

재현:

```bash
pnpm --filter blog build
pnpm --filter blog start:e2e &
cd apps/blog && node scripts/capture-baselines.mjs
```

캡처 목록과 조건은 `baselines/README.md`(스크립트가 생성)에 있다. 캡처가 기록하는 조건: commit, base URL, viewport, theme, locale.

캡처를 만들면서 확인한 것:

- **첫 시도의 focus 캡처에는 링이 없었다.** `element.focus()`는 `:focus-visible`을 보장하지 않아서다. 실제 `Tab` 이동으로 바꾸니 나타났다.
- **두 번째 시도에서도 링이 0.06px로 찍혔다.** `cardSurfaceClass`의 `transition-all duration-150`이 끝나기 전에 셔터가 내려갔기 때문이다. Playwright 컨텍스트의 `reducedMotion: 'reduce'`로도 막히지 않았다 — 이 앱의 transition은 `prefers-reduced-motion`을 보지 않는다. 스크립트에 애니메이션 정착 대기를 넣고서야 2px 링이 잡혔다.
- `/ko/blog` desktop에서 **본문 첫 카드 링크까지 Tab 14회**가 필요하다.

## 2. Token 원천 3곳

| 원천                                   | 형식                | light 키 | dark 키 | 비고                                 |
| -------------------------------------- | ------------------- | -------- | ------- | ------------------------------------ |
| `packages/ui/src/styles/globals.css`   | oklch + Tailwind v4 | 33       | 32      | `--radius`는 light에만 (다크가 상속) |
| `apps/karaoke/src/index.css`           | hex                 | 21       | 17      | 독자 정의. ui와 공통 키 18개         |
| `apps/mumak-native/constants/theme.ts` | hex, TS 객체        | 6        | 6       | Expo 스타터 기본값 그대로            |

재현: `docs/design-system/`의 이 표는 세 파일의 `--*` 선언을 직접 세어 만들었다.

### 갈라지는 지점

- **karaoke에만 있는 키**: `--ease-out-strong`, `--font-japanese`, `--font-utility`.
  저장소 전체에서 **motion을 token으로 가진 유일한 곳**이 karaoke다.
- **ui에만 있는 키**: `destructive*`, `chart-1..5`, `sidebar-*` (총 15개). karaoke는 이 축을 안 쓴다.
- **native는 웹과 사실상 무관하다.** `Colors.light.tint = '#0a7ea4'`(청록)는 Expo 스타터 기본값이고, 웹 브랜드색 `--primary: oklch(0.65 0.2 45)`(주황)와 아무 관계가 없다. 이름이 겹치는 건 `text`/`background` 둘뿐이다.
- **blog는 자기 CSS 변수를 갖지 않는다.** 예외는 `apps/blog/app/prism.css`로, 코드 하이라이트 색 약 30개가 raw hex다(§5 참조).

`--radius`: ui `0.625rem` vs karaoke `0.25rem`. karaoke의 선형 모티브와 편집 도구·콘솔 같은 product theme를 위한 의도된 차이로 확인했다 (`decision-log.md` D-008).

## 3. 대비 실측

측정 방법: 실행 중인 앱에서 각 token을 1x1 캔버스에 칠해 sRGB 픽셀을 읽고 WCAG 2.1 상대휘도로 계산했다. `getComputedStyle`이 oklch를 `lab()`으로 직렬화해서 문자열 파싱으로는 잴 수 없다.

| token                 | light   | dark    | light 판정               |
| --------------------- | ------- | ------- | ------------------------ |
| `--foreground`        | 19.80:1 | 18.97:1 | AA 본문                  |
| `--accent-foreground` | 7.92:1  | 11.58:1 | AA 본문                  |
| `--muted-foreground`  | 4.74:1  | 7.66:1  | AA 본문 (여유 없음)      |
| `--primary`           | 3.48:1  | 8.20:1  | 본문 미달, 비텍스트 통과 |
| `--ring`              | 2.82:1  | 7.07:1  | **비텍스트 미달**        |
| `--border`            | 1.26:1  | 1.31:1  | 장식 경계                |

`--primary` 3.48:1과 `--accent-foreground` 7.92:1 / 11.58:1은 `src/shared/ui/wikilink.tsx`와 `linked-notes-section.tsx` 주석에 적힌 값과 정확히 일치한다. 측정 방법이 기존 판단과 같은 자를 쓴다는 뜻이다.

### 3-1. light `--ring` 2.82:1 (1순위)

포커스 표시가 WCAG 2.1 SC 1.4.11(비텍스트 대비 3:1)에 미달한다. 영향 범위가 좁지 않다.

- `packages/ui/src/styles/globals.css`의 `*:focus-visible { outline-ring }` — 앱 전역 기본 포커스
- `ContentCard`의 `has-[...focus-visible]:ring-ring` — 목록의 주 타깃
- `Button`의 `focus-visible:ring-ring/50` — 알파가 섞여 실효 대비는 더 낮다

dark(7.07:1)는 통과한다. 즉 **라이트 모드에서만 키보드 사용자가 손해를 본다.** 기존 axe 스캔은 이걸 잡지 못한다(axe는 포커스 표시 대비를 평가하지 않는다). 7개 axe 시나리오가 전부 통과하는데도 남아 있는 결함이다.

### 3-2. `ContentCard` hover 제목 (해결: D-007)

`content-card.tsx`의 제목 링크는 `group-hover:text-primary`다. light에서 3.48:1이 된다.
제목은 `text-xl font-semibold`(20px / 600)이라 WCAG "큰 텍스트"(24px, 또는 18.66px 이상 bold) 정의에 걸친다. 600을 bold로 볼지에 따라 3:1 통과인지 4.5:1 미달인지 갈린다.

이 기준선 이후 D-007에서 large-scale 예외에 기대지 않기로 결정했다. 검토 중 같은 surface recipe의 `GardenOverview` 16px / 600 제목에도 `group-hover:text-primary`가 남은 것을 추가로 발견했다. 초기 audit이 한 소비처를 놓친 것이다.

두 hover token을 `accent-foreground`로 바꾸고 실제 `bg-muted/40` hover 배경에서 다시 측정했다. 이전 `primary`는 light 3.37:1, 변경 후에는 light 7.66:1 / dark 10.70:1이다. 두 component의 colocated test가 `primary` 회귀를 막는다.

## 4. Motion

재현: `grep -rhoE '\bduration-[a-z0-9\[\]]+' apps/blog/src apps/blog/app --include="*.tsx"`

| 축       | 실제 사용                                                                   | token |
| -------- | --------------------------------------------------------------------------- | ----- |
| duration | `duration-150`(2), `duration-300`(5), `duration-700`(1), `duration-1000`(1) | 없음  |
| easing   | 아래 4종                                                                    | 없음  |

easing 4종이 전부 손으로 쓰였다.

- `cubic-bezier(0.23, 1, 0.32, 1)` — `apps/karaoke/src/index.css`의 `--ease-out-strong`
- `cubic-bezier(0.25, 1, 0.5, 1)` — `blog/src/widgets/spotify-vinyl` (주석: ease-out-quart)
- `cubic-bezier(0.1, 0.5, 0.2, 1)` — `blog/src/app/providers/progress-provider.tsx`
- `ease-out`, `ease-linear` — Tailwind 기본값

karaoke와 blog가 각자 "강한 ease-out"을 정의했고 곡선이 서로 다르다. **소비처 2곳 이상 + 반복 비용 확인**이라 `plan.md` §6의 새 token 문턱을 넘는 첫 후보다.

### 4-1. 반응 축소가 Spotify에만 있다

`motion-reduce:` 사용처는 `widgets/spotify-vinyl` 6곳뿐이고, `prefers-reduced-motion` 미디어쿼리를 직접 읽는 곳은 `app/providers/progress-provider.tsx` 하나다.

대표 흐름에 있는 모션은 전부 무방비다.

| 위치                  | 모션                                         | 반응 축소 |
| --------------------- | -------------------------------------------- | --------- |
| `card-surface.ts`     | `transition-all duration-150` + hover shadow | 없음      |
| `content-card.tsx`    | `active:scale-[0.99]`                        | 없음      |
| `content-segment-nav` | `transition-[color,box-shadow]`              | 없음      |
| `arrow-link.tsx`      | `group-hover:translate-x-0.5`                | 없음      |
| `next-reading`        | `transition-colors` hover 배경               | 없음      |

`transition-colors`만 있는 항목은 위험이 낮지만, `scale`과 `translate`는 전정기관 민감 사용자가 실제로 영향을 받는 축이다.

기준선 캡처가 이 사실을 우연히 증명했다: Playwright의 `reducedMotion: 'reduce'` 컨텍스트로도 카드 ring transition이 멈추지 않아 스크립트에 별도 정착 대기를 넣어야 했다.

## 5. 임의값과 raw 색

`validate:design`은 153개 파일에서 위반 0건이다. 즉 **raw Tailwind 팔레트 색과 임의 z-index는 이미 잡히고 있다.** 아래는 그 규칙이 보지 않는 축이다.

재현: `grep -rnoE '\b(?:[a-z-]+)-\[[^]]+\]' apps/blog/src apps/blog/app --include="*.tsx"`

### 5-1. viewport 기반 최대 높이 — 3개 파일, 4개 선언, 3가지 단위

| 파일                                 | 값                          |
| ------------------------------------ | --------------------------- |
| `features/graph/ui/graph-legend.tsx` | `max-h-[calc(100dvh-9rem)]` |
| `widgets/garden-sidebar` (desktop)   | `max-h-[calc(100svh-7rem)]` |
| `widgets/garden-sidebar` (drawer)    | `max-h-[80svh]`             |
| `widgets/post-toc`                   | `max-h-[calc(100vh-8rem)]`  |

뷰포트 단위가 `dvh`/`svh`/`vh` 세 가지로 갈렸다. 모바일 주소창이 접히고 펴질 때 셋이 서로 다르게 동작한다. 의도된 차이라는 근거가 코드에 없다.

후속 관찰(2026-08-31): `graph-legend`는 sticky panel이 아니라 캔버스 위의 absolute overlay다. 세 선언을 같은 종류로 묶은 이 audit의 분류를 바로잡고, 전체 화면과 보조 panel의 계약을 `decision-log.md` D-009로 정했다.

### 5-2. 중앙 정렬 상태 페이지 — 3곳 동일 복제

`min-h-[50vh]`가 `app/[locale]/not-found.tsx`, `(main)/not-found.tsx`, `(main)/error.tsx`에 그대로 반복된다.

### 5-3. 나머지

- `breadcrumbs.tsx`: `max-w-[40vw]` / `max-w-[60vw]` — 모바일 말줄임 폭
- `graph-controls.tsx`: `max-w-[200px]` 2회
- `prism.css`: 코드 하이라이트 색 약 30개가 raw hex. `validate:design`은 `src/**`의 `.tsx`만 보므로 CSS 파일은 스캔 대상이 아니다.
- 임의 `text-[11px]`, `text-[9px]`, `bg-[#1DB954]` 등은 전부 `spotify-vinyl` 안이고, 이미 allowlist에 있다(§`exceptions.md`).

## 6. 타입·여백·radius 실사용 빈도

승격 후보를 "느낌"이 아니라 반복 횟수로 고르기 위한 표다. `apps/blog/src` + `app` 기준.

| 축          | 상위 사용                                                             |
| ----------- | --------------------------------------------------------------------- |
| font-size   | `text-sm` 33, `text-xs` 20, `text-lg` 8, `text-4xl` 7, `text-base` 6  |
| font-weight | `font-semibold` 20, `font-medium` 14, `font-bold` 11, `font-normal` 3 |
| gap         | `gap-2` 28, `gap-1` 13, `gap-4` 8, `gap-3` 8, `gap-1.5` 7             |
| 수직 리듬   | `space-y-8` 10, `space-y-4` 9, `space-y-6` 8, `space-y-3` 7           |
| radius      | `rounded-full` 22, `rounded-md` 20, `rounded-lg` 8, `rounded-sm` 2    |

읽을 점.

- 타입 스케일은 이미 좁다. `text-sm` + `text-xs`가 전체의 절반을 넘는다. **type token을 새로 만들 근거가 지금은 없다.** `plan.md` §6의 "사용처가 하나뿐인 token을 만들지 않는다"에 부합한다.
- `gap-2`가 압도적이다. spacing token도 마찬가지로 지금은 이득이 없다.
- radius는 `rounded-full`(배지·아바타)과 `rounded-md`/`rounded-lg`(표면)로 갈린다. `--radius` 한 개가 `sm/md/lg/xl`을 파생하는 현 구조로 충분하다.

즉 **단계 1에서 손댈 축은 color(대비)와 motion 둘뿐이고, type/space는 건드리지 않는다.**

## 7. Component 인벤토리

재현: `@mumak/ui/components/*` import를 `apps/**` 전체에서 세었다.

| 구분                               | 개수 | 내용                                                         |
| ---------------------------------- | ---- | ------------------------------------------------------------ |
| `packages/ui`에 설치됨             | 56   | `packages/ui/src/components/*.tsx`                           |
| 앱이 실제로 import                 | 22   |                                                              |
| `packages/ui` 내부 부품으로만 쓰임 | 5    | `dialog`, `input-group`, `separator`, `toggle`, `tooltip`    |
| 어느 곳에서도 안 쓰임              | 29   | `alert`, `calendar`, `carousel`, `chart`, `form`, `table` 등 |

앱 2곳 이상에서 쓰이는 것은 7개뿐이다.

| component  | 앱 수 | 사용 앱                                       |
| ---------- | ----- | --------------------------------------------- |
| `button`   | 5     | admin, blog, karaoke, mumak-next, mumak-react |
| `badge`    | 3     | blog, mumak-next, mumak-react                 |
| `input`    | 3     | admin, blog, karaoke                          |
| `card`     | 2     | mumak-next, mumak-react                       |
| `drawer`   | 2     | blog, karaoke                                 |
| `label`    | 2     | admin, karaoke                                |
| `textarea` | 2     | admin, karaoke                                |

blog가 쓰는 14개: `button`(12), `badge`(12), `skeleton`(9), `command`(6), `sheet`(5), `tabs`, `popover`, `kbd`, `input`, `dropdown-menu`, `drawer`, `collapsible`, `breadcrumb`, `accordion`.

blog 고유 primitive는 `apps/blog/src/shared/ui/`에 11개 + `card-surface.ts` recipe 1개.

### 7-1. 지원 후보 6개의 상태 inventory

`plan.md` 단계 0이 요구하는 상태 목록(hover / pressed / focus-visible / disabled / loading / empty / error)을 지원 후보 6개에 대해 코드에서 훑었다.

| component           | hover     | pressed          | focus-visible         | disabled  | loading   | empty         |
| ------------------- | --------- | ---------------- | --------------------- | --------- | --------- | ------------- |
| `Button`            | 있음      | `translate-y-px` | 자체 ring             | 있음      | 없음      | 해당 없음     |
| `Badge`             | `[a]`만   | 없음             | 자체 ring             | 없음      | 없음      | 해당 없음     |
| `ContentCard`       | 있음      | `scale-[0.99]`   | 자체 ring (has-)      | 없음      | 없음      | 해당 없음     |
| `ContentSegmentNav` | 있음      | 없음             | **전역 outline 폴백** | 없음      | 없음      | 세그먼트 숨김 |
| `PageHeader`        | 해당 없음 | 해당 없음        | 해당 없음             | 해당 없음 | 해당 없음 | 해당 없음     |
| `ArrowLink`         | 있음      | 없음             | **전역 outline 폴백** | 없음      | 없음      | 해당 없음     |

읽을 점.

- **포커스 처리가 두 갈래다.** `Button`/`Badge`/`ContentCard`는 자체 ring을 그리고, `ContentSegmentNav`/`ArrowLink`는 `globals.css`의 전역 `*:focus-visible { outline-2 outline-offset-2 outline-ring }`에 기댄다. 둘 다 `--ring`을 쓰므로 §3-1의 대비 문제를 똑같이 물려받는다. 계약에는 "자체로 그리는가, 폴백에 기대는가"를 명시해야 한다.
- **`Button`에 loading 상태가 없다.** `disabled`는 있지만 "진행 중" 표현이 없다. 지금은 필요한 화면이 없어서 결함은 아니지만, 계약에 "없음"으로 적어야 소비자가 직접 만들지 않는다.
- **pressed를 표현하는 방식이 셋으로 갈린다.** `Button`은 `translate-y-px`, `ContentCard`는 `scale-[0.99]`, 나머지는 없음. 셋 다 반응 축소 대응이 없다 (§4-1).
- **`Badge`의 hover는 `[a]` 하위 선택자 안에만 있다.** 링크로 쓸 때만 hover가 생긴다. 의도된 설계지만 문서화되지 않았다.

### 7-2. empty 상태가 두 패턴으로 갈려 있다

| 패턴           | 사용처                                                              |
| -------------- | ------------------------------------------------------------------- |
| `return null`  | `LinkedNotesSection`, `GardenOverview`, `PostTags`, `GraphLegend`   |
| 안내 문구 렌더 | blog index, garden index (동일 마크업 인라인 복제), `SearchPalette` |

blog index와 garden index가 `<p className="text-muted-foreground">{t('empty')}</p>`를 각자 인라인으로 들고 있다. 대응 화면이 같은 마크업을 복제한 전형적인 drift 후보다.

0건이 라우트 자체의 부재를 뜻하는 경우(`/blog/tags/[tag]`, `/garden/status/[status]` 등)는 `notFound()`로 보낸다. 이건 일관돼 있다.

지원 대상 선정은 `support-matrix.md` 참조.

## 8. 기존 검증이 잡는 것과 못 잡는 것

| 검사                          | 범위                               | 결과           | 사각지대                                         |
| ----------------------------- | ---------------------------------- | -------------- | ------------------------------------------------ |
| `validate:design`             | `src/**` 6개 규칙                  | 153파일 위반 0 | CSS 파일, 임의 크기/높이, motion, 대비           |
| `e2e/a11y.spec.ts` (axe)      | WCAG 2.1 A/AA, 7개 시나리오        | 통과           | **포커스 표시 대비**, `.prose` 본문, 키보드 순서 |
| 단위 테스트                   | 108 suite / 1079 test              | 전부 통과      | hover/pressed/focus/disabled/loading 상태        |
| `analyze-components.mjs`      | 레이어 **상향** 참조, 순환, fan-in | 위반 0 보고    | **같은 레이어 cross-import**(실제로 4건 있음)    |
| `check-types`/`lint`/`format` | 앱 전체                            | 통과           | 시각 결과                                        |

### 8-1. 커버리지 100%가 상태를 안 덮는다

대상 primitive의 라인 커버리지는 전부 100%다.

| 파일                      | Stmts | Branch |
| ------------------------- | ----- | ------ |
| `content-card.tsx`        | 100   | 100    |
| `content-segment-nav.tsx` | 100   | 100    |
| `page-header.tsx`         | 100   | 100    |
| `arrow-link.tsx`          | 100   | 100    |
| `card-surface.ts`         | 100   | 100    |
| `post-tags.tsx`           | 100   | 100    |
| `post-card.tsx`           | 100   | 75     |
| `switcher-dropdown.tsx`   | 33.33 | 0      |

하지만 테스트가 단언하는 것은 슬롯 구조, `aria-current`, 장식 아이콘의 `aria-hidden`, 링크 href다. hover·pressed·focus·disabled·loading은 **CSS로만 존재해서 jsdom에서 검증 불가능하다.** 이 축은 단계 3의 visual regression 없이는 못 덮는다.

`switcher-dropdown.tsx`(33.33%)는 대표 흐름의 locale/theme 전환에 쓰이는데 커버리지가 비어 있다.

### 8-2. AGENTS.md가 실제와 어긋난다

`apps/blog/AGENTS.md`의 "알려진 follow-up"은 이렇게 적혀 있다.

> visual regression(`toHaveScreenshot`)과 axe 접근성 스캔은 아직 미도입.

axe 스캔은 이미 `e2e/a11y.spec.ts`에 7개 시나리오로 들어와 있다. 문서가 뒤처졌다.

### 8-3. FSD 같은 레이어 cross-import 4건

`AGENTS.md`는 "같은 레이어 간 cross-import는 금지"라고 명시하는데, 검사가 없어서 4건이 살아 있다.

| import                                                      | 방식       | 심각도                    |
| ----------------------------------------------------------- | ---------- | ------------------------- |
| `widgets/note-card` → `widgets/post-card/ui/post-tags`      | 깊은 경로  | **높음. public API 우회** |
| `widgets/garden-highlights` → `widgets/note-card`           | public API | 낮음                      |
| `features/graph` → `features/switch-locale`, `switch-theme` | public API | 낮음                      |
| `entities/tag` → `entities/post`                            | public API | 낮음                      |

첫 항목이 실질적인 문제다. `PostTags`는 blog와 garden 카드가 **둘 다** 쓰는 태그 칩인데 `post-card` 내부에 산다. 이름도 소속도 실제 사용과 어긋난다. `shared/ui` 승격의 가장 명확한 후보다.

`analyze-components.mjs`는 `LAYER_ORDER.indexOf(from) < LAYER_ORDER.indexOf(to)`만 보므로 같은 레이어(인덱스 동일)는 통과시킨다.

## 9. 저장소 함정 (작업 중 발견)

### 9-1. oxfmt가 markdown 물결표 2개를 취소선으로 바꾼다

한 줄에 `~`가 2개 이상이면 oxfmt가 취소선(`~~`)으로 정규화한다. 커밋된 `apps/blog/plan.md`가 이 때문에 `format:check`를 깨고 있었다.

```text
- 주 6~8시간 ... 주 3~4시간      →  주 6~~8시간 ... 주 3~~4시간   (내용 손상)
- 주 6\~8시간 ... 주 3\~4시간    →  그대로 유지                   (안전)
```

한 줄에 `~`가 하나면 안전하다. 2개 이상이면 `\~`로 escape한다. 이미 알려진 `|` → `\|` 함정과 같은 계열이다.

이 audit PR에서 `plan.md` 199번 줄을 escape로 고쳤다.

### 9-2. 문서용 캡처를 무손실로 두면 저장소 최대 파일을 넘는다

모바일 풀페이지 PNG 한 장이 3.4MB로, 기존 최대 tracked 파일(2.0MB `PretendardVariable.woff2`)을 앞섰다. 대응:

- 긴 글 상세는 풀페이지 대신 진입부/착지점 앵커 캡처로 분리
- 모바일 DPR을 3에서 2로
- 풀페이지는 JPEG q85, 포커스 링처럼 1px 대비가 근거인 뷰포트 캡처만 PNG

결과 36장 7.7MB, 최대 920KB.

## 10. 다음 단계로 넘기는 것

단계 1(2주차)의 범위를 이 audit이 이렇게 좁힌다.

**손댄다**

- `--ring` light 대비 (§3-1) — 유일하게 확인된 접근성 결함
- motion token 최소 집합 (§4) — 소비처 2곳 이상이 확인된 유일한 축
- `Button`, `ContentCard` 수직 절편

**안 손댄다**

- type / spacing token — 빈도가 이미 좁다 (§6)
- `packages/ui`의 안 쓰이는 29개 — 지원 목록에 넣지 않는다 (§7)
- `PostTags` 승격, D-009 viewport 계약 구현, 상태 페이지 recipe, 목록 empty 문구 — 실재하는 후보지만 단계 2로 미룬다

**결정 상태**

- viewport 단위 혼용: 전체 화면은 `dvh`, 보조 panel은 `svh`로 계약을 정했다 (`decision-log.md` D-009). 구현은 단계 2로 미룬다.
- 포커스를 각 component가 그릴지 전역 폴백에 맡길지는 아직 결정이 필요하다 (§7-1).
