# Design Engineer 성장과 mumak-www 디자인시스템 실행 계획

> 이 문서는 2026-06-12 기준의 기존 `apps/blog/plan.md` 개선 과제 목록을 대체한다. 기존 목록은 대부분 완료되었고, 남은 선택 과제는 현재 Design Engineer 목표와 연결되는 경우에만 이 계획으로 다시 평가한다.
>
> 조사 기준일: 2026-08-21. 저장소 기준: `mumak-www` v1.16.0과 현재 `chore/design-engineer-plan` 브랜치. 외부 채용공고와 SEED 구조는 바뀔 수 있으므로 3개월마다 원문을 재확인한다.

## 결론

목표는 SEED의 규모를 복제하는 것이 아니다. **blog/garden의 탐색→읽기→다음 콘텐츠 이동 흐름 하나를 대상으로 디자인 판단, Figma, 토큰, React 구현, 접근성, 시각 회귀, 문서와 마이그레이션을 끝까지 연결한 대표 사례**를 만드는 것이다.

첫 3개월에는 다음 증거를 우선한다.

- 시각·인터랙션 결정을 사용자 문제와 trade-off로 설명한다.
- Figma Variables와 코드의 semantic token·component state를 대응시킨다.
- `Button`, `ContentCard` 등 6~12개 이하의 지원 대상을 계약과 테스트로 관리한다.
- blog/garden의 대표 화면 4개를 실제로 마이그레이션하고 회귀를 검증한다.
- 결정·기각·되돌림을 문서화해 5분 사례 발표로 설명한다.

토큰 생성 패키지, Storybook, MCP, codemod, 독립 배포는 목표가 아니라 **반복 비용이 확인됐을 때 선택하는 수단**이다. 실제 소비자와 유지 이득을 증명하지 못하면 도입하지 않는다.

## 목차

- [1. 계획의 목표와 운영 원칙](#1-계획의-목표와-운영-원칙)
- [2. Design Engineer 역량 목표](#2-design-engineer-역량-목표)
- [3. 당근 채용공고에서 확인한 증거](#3-당근-채용공고에서-확인한-증거)
- [4. SEED에서 배울 원칙과 복제하지 않을 것](#4-seed에서-배울-원칙과-복제하지-않을-것)
- [5. mumak-www의 현재 기반과 제약](#5-mumak-www의-현재-기반과-제약)
- [6. MVP 범위와 과투자 방지 기준](#6-mvp-범위와-과투자-방지-기준)
- [7. 3·6·12개월 방향](#7-3612개월-방향)
- [8. 단계별 실행 계획](#8-단계별-실행-계획)
- [9. 첫 2주 실행 체크리스트](#9-첫-2주-실행-체크리스트)
- [10. PR 단위와 검증 명령](#10-pr-단위와-검증-명령)
- [11. 측정과 포트폴리오 증거](#11-측정과-포트폴리오-증거)
- [12. 남은 불확실성과 재평가 규칙](#12-남은-불확실성과-재평가-규칙)
- [13. 출처](#13-출처)

## 1. 계획의 목표와 운영 원칙

### 목표

12개월 뒤의 성공은 “SEED급 시스템을 만들었다”가 아니다. 다음 질문에 검토 가능한 산출물로 답할 수 있는 상태다.

- 왜 이 색, 타입, 여백, 모션, 상태가 사용자 경험에 더 적합한가?
- 한 화면의 판단을 어디까지 공통 token·primitive·recipe로 승격했는가?
- Figma와 코드가 같은 이름, 상태, 제약을 사용하는가?
- keyboard, focus, ARIA, contrast, target size, reduced motion을 어떻게 검증했는가?
- 시스템 변경이 실제 화면과 사용자 과업에 어떤 영향을 주었는가?
- 무엇을 만들지 않았고, 왜 보류했는가?

### 운영 원칙

- **결론보다 증거를 남긴다.** 스크린샷, Figma 링크, 코드 diff, 테스트 결과, 사용자 관찰을 함께 보관한다.
- **사용자 흐름부터 시작한다.** token이나 component 수를 늘리는 것 자체를 성과로 보지 않는다.
- **semantic-first로 설계한다.** 값보다 `surface`, `text`, `border`, `action`, `feedback` 역할을 먼저 정의한다.
- **지원됨과 설치됨을 구분한다.** `packages/ui/src/components/`의 전체 파일 수가 아니라 계약과 검증을 갖춘 지원 목록만 관리한다.
- **FSD 경계를 유지한다.** 범용 web primitive는 `packages/ui`, blog의 콘텐츠·locale 지식은 `apps/blog/src/shared/ui`와 상위 FSD 레이어에 둔다.
- **native에는 컴포넌트 공유를 강제하지 않는다.** `apps/mumak-native`는 의미 토큰 이름과 원칙만 공유하고 React Native 구현은 독립적으로 유지한다.
- **작은 PR로 점진 이전한다.** 원천·alias·소비처를 한 번에 전환하지 않는다.
- **검증을 구현 일부로 취급한다.** 접근성, visual baseline, dark mode, responsive, reduced motion이 없는 변경은 완료가 아니다.
- **추정은 명시한다.** 사용자 숙련도, 가용 시간, 채용 평가 비중처럼 확인하지 못한 내용은 사실과 분리한다.

## 2. Design Engineer 역량 목표

### P0 — 3개월 안에 증명할 역량

| 역량                   | 만들 증거                                                    | 완료 기준                                                 |
| ---------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| 시각·인터랙션 크래프트 | before/after, 대안 2~3개, critique log, 상태·모션 사양       | 주요 결정 10개 이상에 사용자 문제·대안·trade-off가 기록됨 |
| Figma 시스템 설계      | Variables, component properties, slots, responsive prototype | 지원 컴포넌트 6개 이상이 코드 API와 이름·상태로 대응됨    |
| 시스템 사고            | 원칙, semantic token, support matrix, exception 목록         | 공통화와 비공통화 결정마다 승격 기준과 근거가 있음        |
| 코드로 검증하는 디자인 | React 구현, keyboard/focus/ARIA, dark/reduced-motion         | 대표 흐름을 mobile·desktop·keyboard로 완료 가능           |
| 사례 설명력            | decision log, 리뷰 기록, 5분 발표                            | 외부 리뷰어가 문제·선택·효과를 다시 설명할 수 있음        |

권장 학습 배분은 코드 40%, 시각·인터랙션과 Figma 40%, 문서·비평 20%다. 이 비율은 현재 Figma 숙련도와 시각 디자인 이력을 확인하지 못한 상태의 **추정**이며, 2주차 리뷰에서 조정한다.

### P1 — 6개월 안에 운영 경험으로 바꿀 역량

| 역량                  | 만들 증거                                  | 완료 기준                                              |
| --------------------- | ------------------------------------------ | ------------------------------------------------------ |
| 토큰 아키텍처         | primitive→semantic→필요한 component token  | 단일 원천 변경으로 산출물 재현, key mismatch 자동 검출 |
| 접근성 내재화         | component별 a11y contract와 자동·수동 검사 | 지원 대상 전부에 검증 또는 명시적 예외가 있음          |
| 컴포넌트 API·조합     | 닫힌 variant와 열린 slot의 근거            | do/don’t가 있고 복사 recipe가 감소함                   |
| 거버넌스·마이그레이션 | ADR, changelog, migration note             | 기존 화면 3개 이상을 점진 전환하고 회귀 없이 배포함    |
| 비평·협업             | 외부 리뷰와 수용·기각·보류 기록            | 최소 3회의 리뷰와 후속 수정이 남아 있음                |

### P2 — 12개월 안에 선택적으로 차별화할 역량

| 역량                 | 시작 조건                                  | 최소 증거                                     |
| -------------------- | ------------------------------------------ | --------------------------------------------- |
| 멀티플랫폼 token     | web과 native가 같은 의미 token을 실제 소비 | semantic key mapping과 플랫폼별 값·제약 표    |
| AI 디자인 워크플로우 | AI가 문서·규칙을 반복 소비                 | 금지 token·variant·a11y 누락을 찾는 validator |
| 오픈소스 기여        | SEED 또는 관련 도구에서 실제 개선점 발견   | 문서·접근성·버그 PR 1건 제출 또는 검토 기록   |
| 채택·영향 측정       | 실제 사용자가 있는 흐름을 변경             | 시스템 지표와 사용자 과업 지표를 분리해 비교  |

## 3. 당근 채용공고에서 확인한 증거

2026-08-21 기준 공식 상세 페이지와 채용 목록에서 Design Engineer - 디자인 시스템 공고와 지원 경로가 확인됐다.[1][2] 정확한 최초 게시일·수정일·마감일은 공개 페이지에서 확인되지 않았다.

### 공고가 직접 요구하는 축

- 높은 디자인 완성도와 사용자 경험 기준.[1]
- 컬러, 모션, 여백, 타이포그래피, 아이콘, 터치감에 대한 독자적 판단.[1]
- 개별 화면의 문제를 여러 팀이 재사용할 수 있는 패턴과 primitive로 시스템화하는 능력.[1]
- Figma 에셋, 디자인 token과 component를 iOS·Android·Web에서 일관되게 다듬는 역량.[1]
- 디자인과 구현의 기술·디자인 부채를 발견하고 동료를 설득하는 협업 능력.[1]
- 사용 가이드, 디자인 원칙, 패턴 라이브러리를 문서화하고 전파하는 역량.[1]
- AI가 component, token, pattern, copy, interaction 기준을 읽을 수 있도록 구조화하는 새로운 워크플로우.[1]

### 프론트엔드 개발자에게 유리한 점과 부족할 수 있는 점

확인된 우대 역량에는 HTML/CSS, React, TypeScript, Figma, 디자인 token·멀티플랫폼 시스템, 접근성, 오픈소스 기여가 포함된다.[1] 따라서 mumak-www의 React·TypeScript·테스트·배포 경험은 강한 기반이다.

그러나 프론트엔드 구현은 공고에서 우대 역량에 놓여 있다. 구현 능력만으로는 다음 증거가 부족할 수 있다.

- 시각적 선택을 “좋아 보인다”가 아니라 사용자, 브랜드, 접근성, 구현 비용으로 설명하는 기록.
- Figma Variables·Properties·Slots를 실제 코드 계약과 연결한 사례.
- 시스템을 다른 사용자가 채택하도록 문서화·리뷰·마이그레이션한 경험.
- 시간 제한 안에 디자인 대안과 동작 prototype을 완성하는 연습.

### 포트폴리오에 보여줄 장면

- 문제 진단 → 디자인 원칙 → 대안 비교 → Figma → token/component 계약 → React 구현 → 접근성·visual 검증 → migration → 결과.
- 반대 의견이나 실패한 추상화를 포함한 decision log.
- “내가 만든 것”과 기존 shadcn·Radix·repository 기반의 명확한 구분.
- 측정 방법, 표본, 한계를 포함한 정량·정성 결과.

## 4. SEED에서 배울 원칙과 복제하지 않을 것

SEED는 UI component 모음이 아니라 디자인 결정을 Figma, Rootage 원천, CSS, React, 문서와 AI 소비 경로에 전달하는 통합 디자인 언어로 설명된다.[3][4][5][8]

### 가져올 원칙

- **의사결정의 압축**: 반복 판단을 token·component·pattern 계약으로 재사용한다.[4]
- **의미 기반 token**: raw value보다 Scale/Semantic 역할을 구분한다.[5]
- **상태와 접근성의 사양화**: hover, pressed, focus, disabled, loading, error, target size와 reduced motion을 초기 계약에 넣는다.[6][9]
- **조합 가능한 API**: variant 경우의 수를 무한히 늘리기보다 slots와 properties로 의미 있는 조합을 연다.[4][9]
- **원천과 생성물의 구분**: 원천을 고치고 산출물을 생성·검증하며 생성 파일을 직접 수정하지 않는다.[8]
- **실제 화면 검증**: component adoption뿐 아니라 사용자 행동과 실제 제품 화면에서 결과를 본다.[4]
- **문서의 단일 원천**: 사람과 AI가 같은 최신 계약을 읽게 하고 동일 내용을 여러 곳에 복사하지 않는다.[7]

### 복제하지 않을 것

- 당근의 브랜드 색, radius, icon 형태를 근거 없이 복제하지 않는다.
- SEED의 component 수, package 수, 조직 규모를 목표 수치로 삼지 않는다.
- 두 번째 실제 소비자가 없는데 Figma→다중 플랫폼 generator부터 만들지 않는다.
- 모든 primitive·semantic·component token을 한 번에 설계하지 않는다.
- Storybook, MCP, codemod, snapshot 배포, 독립 npm 배포를 포트폴리오용 기술 전시로 먼저 도입하지 않는다.
- 공개 전체 접근성 감사 없이 “접근성 완전 준수”라고 표현하지 않는다.

## 5. mumak-www의 현재 기반과 제약

### 현재 저장소에서 확인된 기반

| 영역          | 현재 상태                                                            | 활용 방향                                         |
| ------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| 모노레포      | pnpm workspace + Turborepo                                           | package 경계와 영향 범위 검증에 활용              |
| 웹 primitive  | `packages/ui/src/components/`와 subpath export                       | 지원 대상을 6~12개로 좁혀 계약 추가               |
| 웹 theme      | `packages/ui/src/styles/globals.css`의 light/dark semantic CSS 변수  | 기존 이름을 alias로 보존하며 원천화 검토          |
| blog 구조     | `apps/blog`의 FSD와 `app→widgets→features→entities→shared` 규칙      | product recipe를 `apps/blog/src/shared/ui`에 유지 |
| blog recipe   | `ContentCard`, `ContentSegmentNav`, `PageHeader`, `cardSurfaceClass` | 대표 흐름의 첫 지원 recipe 후보                   |
| 정적 guard    | `apps/blog/scripts/validate-design-system.mjs`                       | raw color, recipe drift, `data-slot` 검사 확장    |
| 접근성 자동화 | `apps/blog/e2e/a11y.spec.ts`의 axe 스캔                              | keyboard·focus·target·reduced-motion 계약과 보완  |
| native theme  | `apps/mumak-native/constants/theme.ts`                               | web component가 아닌 semantic key mapping 후보    |
| karaoke theme | `apps/karaoke/src/index.css`의 독립 light/dark·motion 값             | 별도 theme preset 가능성 검증 대상                |
| CI/E2E        | blog 단위 검사, build, Jest, Playwright                              | 새 GitHub check보다 기존 job에 검증 통합          |

현재 `packages/design-tokens/`는 존재하지 않는다. `packages/ui`에는 자체 test script가 없고 blog에는 Playwright screenshot baseline이 없다. 따라서 “토큰 파이프라인”과 “시각 회귀”는 현재 기반이 아니라 이 계획에서 검증할 제안이다.

### 범용과 product recipe 경계

`packages/ui`에 둘 후보:

- `Button`, `Badge`, `Input`, `Dialog`/`Sheet`, `Tabs`, `Tooltip`처럼 여러 web app에서 재사용할 수 있는 primitive.
- 상태, 접근성 동작, variant가 제품 도메인과 무관한 계약.

`apps/blog/src/shared/ui`에 유지할 후보:

- `ContentCard`, `ContentSegmentNav`, `PageHeader`, `cardSurfaceClass`.
- locale Link, 콘텐츠 meta, blog/garden의 대응 정보 구조가 필요한 recipe.

상위 FSD 레이어에 유지할 것:

- `PostCard`, `NoteCard`, `BlogNav`, `GardenNav` 같은 entity/widget 조합.
- blog/garden route와 번역 문구.

공유하지 않을 예외:

- Spotify vinyl, graph node, OG image 같은 시각화·브랜드 표현.
- karaoke의 읽기 화면에만 필요한 typography와 interaction.
- React Native component 구현 자체.

### 현재 제약

- `packages/ui/src/styles/globals.css`, `apps/karaoke/src/index.css`, `apps/mumak-native/constants/theme.ts`에 theme 원천이 분리돼 있다.
- `packages/ui`의 56개 component 전부를 지원 대상으로 관리하면 범위가 과도하다.
- blog의 axe 스캔은 `.prose` MDX 본문을 제외하므로 콘텐츠 접근성 전체를 보증하지 않는다.
- Figma 파일과 현재 디자인 작업 방식은 저장소에서 확인할 수 없다.
- 사용자의 Figma 숙련도, 시각 디자인 훈련 이력, 주당 가용 시간은 확인되지 않았다.
- 3·6·12개월 기간은 주 6~8시간 투입을 가정한 **추정**이다. 주 3~4시간이면 기간을 약 1.5~2배로 조정한다.

## 6. MVP 범위와 과투자 방지 기준

### 대표 사용자 흐름

MVP는 다음 한 흐름으로 제한한다.

> blog/garden 탐색 → 목록에서 콘텐츠 선택 → 글/노트 읽기 → 연결된 콘텐츠로 이동

대표 화면은 다음 4개다.

- 홈 또는 콘텐츠 진입: `apps/blog/app/[locale]/(main)/(content)/page.tsx`
- blog/garden 목록: `apps/blog/app/[locale]/(main)/(content)/blog/page.tsx`, `apps/blog/app/[locale]/(main)/(content)/garden/page.tsx`
- 글/노트 상세: 각 `[slug]/page.tsx`
- 모바일 header/navigation: `apps/blog/src/widgets/header/`

### 첫 3개월 MVP

포함:

- 제품 원칙 3개.
- 기존 token·component·예외 audit.
- 최초 지원 대상 6개: `Button`, `ContentCard`, `ContentSegmentNav`, `PageHeader`, `Link`/`ArrowLink`, `Badge`.
- color, radius, motion의 최소 semantic token 후보.
- Figma Variables와 `Button`·`ContentCard`의 properties/state.
- 대표 화면 6~10개의 안정적 visual baseline.
- keyboard, focus-visible, ARIA, contrast, target size, reduced motion 검증.
- 실제 화면 4개의 점진 migration과 사례 연구 1개.

제외:

- 전체 56개 UI component 문서화.
- 새로운 독립 docs app 또는 Storybook.
- Figma 양방향 자동 sync.
- 독립 npm 배포, Changesets, codemod, MCP.
- React Native component 공통화.
- 사용처가 하나뿐인 component token.

### 새 token·component·도구를 시작하는 문턱

다음 중 2개 이상을 만족해야 한다.

- 실제 화면 또는 플랫폼 2곳 이상에서 반복된다.
- 접근성·상태 로직을 공유하면 오류 위험이 의미 있게 줄어든다.
- 반복 변경, 동기화, migration 비용이 기록돼 있다.

### 상한

- 제품 원칙: 3~5개.
- 첫 3개월 지원 component: 6~12개.
- 초기 visual baseline: 6~10개.
- 초기 token: 이미 분기 비용이 있는 color, radius, motion 중심.
- 동시 작업: 사용자 흐름 1개, 시스템 기반 1개, 포트폴리오 문서 1개.

### 중단·축소 신호

- 문서·인프라 작업이 실제 화면 개선보다 2주 연속 많다.
- 새 component가 한 화면에서만 쓰인다.
- token 명명 시간이 사용자 문제 검증 시간보다 길다.
- 생성기가 단순 CSS 편집보다 더 많은 유지비를 만든다.
- screenshot test가 실제 변경 신호보다 flaky 재실행 비용을 더 만든다.
- Storybook·MCP·codemod가 채용 키워드 외의 소비자를 갖지 못한다.

## 7. 3·6·12개월 방향

### 3개월 — 대표 사례 하나를 완결한다

방향:

- blog/garden 대표 흐름을 대상으로 시각·interaction 문제를 정의한다.
- Figma와 코드가 같은 semantic key와 component state를 사용한다.
- 지원 component 6~12개에 상태·접근성·사용/금지 계약을 둔다.
- 실제 화면 4개를 migration하고 visual·a11y 회귀를 검증한다.
- 문제→대안→결정→구현→검증→결과를 5분 사례로 만든다.

3개월 gate:

- [ ] 주요 디자인 결정 10개 이상이 기록됐다.
- [ ] Figma와 코드의 대응표가 있다.
- [ ] 지원 component마다 상태표, a11y 계약, 최소 테스트가 있다.
- [ ] 대표 흐름을 mobile·desktop·keyboard로 완료할 수 있다.
- [ ] visual baseline 6~10개가 안정적으로 실행된다.
- [ ] 외부 리뷰 3회와 수용·기각·보류 기록이 있다.
- [ ] 5분 발표와 사례 연구 v1이 있다.

### 6개월 — 시스템을 변경·전파·운영한다

방향:

- 실제 반복이 확인된 token만 type, space, elevation으로 확장한다.
- default web, karaoke, native의 semantic key mapping을 검증한다.
- public API·token 변경에 짧은 ADR, changelog, migration note를 운영한다.
- 두 번째 소비 화면 또는 플랫폼에서 한정 적용한다.
- 10분 발표와 30분 심층 질의에 대비한다.

6개월 gate:

- [ ] 단일 token 원천 또는 의도적으로 축소한 대안이 재현 가능하다.
- [ ] web/native key mismatch를 자동 검출하거나 보류 근거가 있다.
- [ ] 기존 화면 3개 이상에 migration 기록이 있다.
- [ ] 시스템 지표와 사용자 관찰을 최소 한 번 before/after로 비교했다.
- [ ] 독립 사용자가 문서만 보고 지원 component 2개를 올바르게 조합했다.
- [ ] 시간 제한 prototype 연습을 2회 완료했다.

### 12개월 — 선택적으로 확장하고 채용 증거를 정제한다

방향:

- 가장 약한 증거를 우선 보강한다.
- 실제 drift가 반복되면 Figma-code 검사를 반자동화한다.
- 적절한 문제가 있으면 SEED 또는 관련 오픈소스에 작은 기여를 시도한다.
- AI가 구조화 규칙을 읽고 위반을 검출하는 작은 실험을 한다.
- 최신 목표 공고 3~5개와 증거 매트릭스를 갱신한다.

12개월 gate:

- [ ] 미적 판단을 사용자·브랜드·접근성·구현 비용의 언어로 설명한다.
- [ ] Figma와 코드가 같은 이름·상태·원칙을 사용한다.
- [ ] 시스템 변경을 실제 화면, 자동화된 품질, 사용자 과업 중 2종 이상으로 검증했다.
- [ ] 실패, 과한 추상화, 되돌린 결정을 포트폴리오에 정직하게 포함했다.
- [ ] 5분 요약, 15분 사례 발표, 45분 심층 질문 형식으로 설명 가능하다.
- [ ] 각 목표 공고의 핵심 요구사항마다 특정 산출물 링크 또는 “증거 없음” 표시가 있다.

## 8. 단계별 실행 계획

### 단계 0 — 기준선과 문제 정의

기간: 1주차.

목표:

- 새 추상화를 만들기 전에 현재 경험, token, component, 접근성, 예외를 기록한다.
- 디자인시스템 필요성을 코드 중복이 아니라 사용자 경험 문제로 정의한다.

작업:

- [ ] 대표 화면 4개를 light/dark × mobile/desktop으로 캡처한다.
- [ ] hover, pressed, focus-visible, disabled, loading, empty, error 상태를 inventory한다.
- [ ] `packages/ui/src/styles/globals.css`, `apps/karaoke/src/index.css`, `apps/mumak-native/constants/theme.ts`의 의미·이름·값 차이를 표로 만든다.
- [ ] `packages/ui/src/components/`의 설치 목록과 최초 지원 목록을 분리한다.
- [ ] blog product recipe와 Spotify·graph·OG 등 예외를 분류한다.
- [ ] 사용자 경험 원칙 3개와 각 원칙의 좋은 예·나쁜 예를 2개씩 작성한다.
- [ ] 기존 axe, unit, design validator, E2E 범위와 빈틈을 기록한다.
- [ ] 5분 문제 설명을 녹화하고 기술 이름만 나열한 부분을 수정한다.

제안 산출물:

- `docs/design-system/audit.md`
- `docs/design-system/principles.md`
- `docs/design-system/support-matrix.md`
- `docs/design-system/exceptions.md`
- `docs/design-system/decision-log.md`
- `docs/design-system/baselines/`의 화면·상태 캡처

검증 기준:

- inventory의 모든 항목이 실제 파일 경로와 소비 화면을 가리킨다.
- 대표 화면마다 light/dark, mobile/desktop 기준선이 있다.
- 원칙마다 실제 UI 결정을 통과·기각시키는 예가 있다.
- 기존 `build`, unit, design validator 결과를 baseline으로 남긴다.

완료 조건:

- [ ] “왜 이 시스템이 필요한가”를 사용자 문제 중심 한 문단으로 설명한다.
- [ ] 지원 후보 6~12개와 비지원 목록이 분리돼 있다.
- [ ] 다음 단계 범위가 `Button`, `ContentCard`, 최소 token으로 제한돼 있다.
- [ ] 새 코드 추상화는 아직 추가하지 않았다.

### 단계 1 — 최소 수직 절편

기간: 2주차.

목표:

- semantic color/radius/motion 하나의 변경이 Figma→코드→실제 화면→검증으로 이어지는 최소 흐름을 만든다.
- 생성 패키지가 필요한지 작은 prototype으로 검증한다.

작업:

- [ ] 기존 CSS 변수와 대응하는 primitive/semantic/theme schema 초안을 만든다.
- [ ] `Button`과 `ContentCard`의 anatomy, variants, states, accessibility를 표로 만든다.
- [ ] Figma Variables와 두 component의 properties/state를 만든다.
- [ ] Figma key와 코드 key의 대응표를 작성한다.
- [ ] 기존 `packages/ui/src/styles/globals.css`를 깨지 않도록 alias 또는 prototype 경계를 정한다.
- [ ] keyboard, focus-visible, disabled, loading, target size, reduced-motion을 검증한다.
- [ ] light/dark × mobile/desktop의 최소 visual baseline 4개를 만든다.
- [ ] 결정 3개와 기각 1개를 `decision-log.md`에 기록한다.

조건부 제안 경로:

- 생성의 반복 이득이 확인되면 `packages/design-tokens/` prototype을 만든다.
- 입력 후보: `packages/design-tokens/tokens/{primitive,semantic,motion}.json`.
- 출력 후보: `packages/design-tokens/dist/css/variables.css`, `dist/ts/tokens.ts`.
- 아직 두 번째 소비자가 없으면 React Native output은 만들지 않고 key mapping fixture만 둔다.
- 생성 유지비가 크면 package를 만들지 않고 `packages/ui/src/styles/globals.css`와 구조화된 TS mapping을 단일 원천으로 유지한다.

검증 기준:

- semantic token 하나를 바꾸면 영향 화면을 예측하고 visual diff에서 확인한다.
- Figma와 코드 이름·state가 대응표에서 1:1 또는 명시적 예외로 연결된다.
- `Button`과 `ContentCard`가 keyboard로 사용 가능하고 focus가 식별된다.
- 기존 build, unit, design validator에 회귀가 없다.

완료 조건:

- [ ] 최소 수직 절편이 end-to-end로 시연된다.
- [ ] 생성 패키지 유지 또는 축소 결정과 근거가 있다.
- [ ] 지원 계약과 테스트가 실제 구현과 일치한다.
- [ ] 다음 단계로 넘어갈 때 token 종류나 component 수를 선제적으로 늘리지 않는다.

### 단계 2 — 시각·interaction 기준과 component 계약

기간: 3~6주차.

목표:

- 타입, 여백, motion과 상태를 취향이 아니라 읽기 흐름, 정보 위계, 입력 방식, 접근성으로 설명한다.
- 최초 지원 component 6개를 계약 가능한 수준으로 정리한다.

작업:

- [ ] 글 상세의 type hierarchy와 content width 대안 2~3개를 비교한다.
- [ ] title, body, metadata, code, caption의 사용·금지 조합을 정한다.
- [ ] spacing 후보가 실제 반복되는지 빈도표를 만든다.
- [ ] `Link`, `Button`, `ContentSegmentNav`의 hover·pressed·focus·disabled·loading 상태표를 만든다.
- [ ] pointer, touch, keyboard 차이와 reduced-motion 대체를 기록한다.
- [ ] `Button`, `Badge`, `ContentCard`, `ContentSegmentNav`, `PageHeader`, `ArrowLink`의 anatomy·variants·slots·a11y 계약을 작성한다.
- [ ] `packages/ui` primitive와 blog recipe의 경계를 검토한다.
- [ ] do/don’t와 탈출구의 소비자 책임을 문서화한다.

주요 구현 후보:

- `packages/ui/src/components/button.tsx`
- `packages/ui/src/components/badge.tsx`
- `apps/blog/src/shared/ui/content-card.tsx`
- `apps/blog/src/shared/ui/content-segment-nav.tsx`
- `apps/blog/src/shared/ui/page-header.tsx`
- `apps/blog/src/shared/ui/arrow-link.tsx`
- 각 파일과 colocate된 `__tests__/`
- `apps/blog/scripts/validate-design-system.mjs`

검증 기준:

- 상태 누락이 없고 각 motion의 목적, duration, 중단 조건을 설명한다.
- 지원 component마다 semantic HTML, state, keyboard, ARIA, target size, reduced-motion 기준이 있다.
- component API가 복사 recipe보다 읽기 쉽다.
- locale Link, PostCard 같은 product 지식을 `packages/ui`로 올리지 않는다.

완료 조건:

- [ ] 지원 component 6개 전부에 계약과 최소 테스트가 있다.
- [ ] 사용되지 않는 type·space·component token을 만들지 않았다.
- [ ] 자동화 가능한 검사와 수동 검토 항목이 구분돼 있다.
- [ ] visual·interaction 결정 10개 이상이 decision log에 있다.

### 단계 3 — 접근성·visual regression·실제 화면 migration

기간: 7~10주차.

목표:

- 계약을 대표 화면에 적용하고 의도하지 않은 회귀를 자동·수동으로 검출한다.

작업:

- [ ] `apps/blog/e2e/a11y.spec.ts`의 현재 범위와 `.prose` 제외 영역을 명시한다.
- [ ] keyboard focus order, dialog escape/focus trap, target size, contrast, reduced motion 수동 checklist를 추가한다.
- [ ] 기존 blog Playwright에 `toHaveScreenshot`을 소수 도입한다.
- [ ] light/dark, mobile/desktop, 긴 한국어·영어 title fixture를 포함한다.
- [ ] blog/garden 목록을 먼저 migration한다.
- [ ] 글/노트 상세와 모바일 navigation을 다음 PR에서 migration한다.
- [ ] before/after diff와 product 고유 예외를 기록한다.
- [ ] 기존 Next/Jest/act/jsdom 경고가 새 회귀를 가리지 않도록 baseline·소유자를 분리한다.

visual baseline 후보:

- blog index light desktop.
- blog index dark mobile.
- garden index light desktop.
- garden index dark mobile.
- blog detail의 긴 한국어 title.
- garden detail의 긴 영어 title.
- mobile navigation open state.
- keyboard focus-visible state.

검증 기준:

- screenshot 변경은 PR에서 의도된 diff와 원인을 설명한다.
- 심각도 높은 axe 위반 0건을 유지한다. 제외 영역과 수동 검토 한계를 숨기지 않는다.
- 대표 흐름을 mouse, touch, keyboard로 완료한다.
- blog/garden 대응 화면이 같은 primitive와 원칙을 유지한다.

완료 조건:

- [ ] 안정적인 visual baseline 6~10개가 있다.
- [ ] 대표 화면 4개가 같은 semantic token과 원칙을 사용한다.
- [ ] migration이 기존 route, i18n, SSG, E2E를 깨지 않는다.
- [ ] 시스템에 흡수하지 않은 예외와 이유가 문서화돼 있다.

### 단계 4 — 문서, 외부 리뷰와 사례 연구 v1

기간: 11~12주차.

목표:

- 제3자가 시스템을 이해하고 올바르게 사용하게 하며, Design Engineer 사례로 설명한다.

작업:

- [ ] 원칙, token, 지원 component, state, a11y, do/don’t를 한 진입점에서 탐색하게 한다.
- [ ] 별도 Storybook 대신 Markdown 문서 또는 실제 `/design-system` showcase를 우선한다.
- [ ] showcase가 필요하면 `apps/blog/app/[locale]/(main)/(content)/design-system/page.tsx`를 검토한다.
- [ ] 외부 리뷰어 3명에게 5분 walkthrough를 진행한다.
- [ ] 피드백을 수용·기각·보류하고 근거를 기록한다.
- [ ] 가능하면 사용자 3명의 탐색→읽기 과업을 관찰한다.
- [ ] 가장 큰 문제 1개를 재설계하고 재검증한다.
- [ ] 문제→관찰→원칙→대안→Figma→계약→구현→검증→migration→결과의 사례 연구를 작성한다.
- [ ] 당근 공고 요구사항과 artifact URL을 연결한 evidence matrix를 만든다.

검증 기준:

- 제3자가 문서만 보고 `Button`과 `ContentCard`를 올바르게 조합한다.
- 문서와 실제 API의 이름·variant 불일치가 없다.
- 리뷰 피드백을 무조건 따르지 않고 판단 근거를 남긴다.
- 정량 수치에는 측정 방법, 표본, 한계를 함께 쓴다.

완료 조건:

- [ ] 사례 연구 v1과 5분 발표가 있다.
- [ ] 공고의 P0 역량마다 특정 증거 링크가 있다.
- [ ] “내가 만든 것”과 기존 기반이 구분돼 있다.
- [ ] 3개월 gate를 모두 평가하고 미달 항목을 다음 분기의 1순위로 정했다.

### 단계 5 — token 운영과 두 번째 소비자

기간: 4~6개월.

진입 조건:

- 3개월 MVP가 실제 화면에서 운영되고 있다.
- 수동 token 동기화 또는 component 변경 비용이 반복해서 발생했다.

작업:

- [ ] 실제 반복이 확인된 경우에만 type, space, elevation token을 추가한다.
- [ ] default web, karaoke, native semantic key mapping 표를 갱신한다.
- [ ] 생성 산출물이 있다면 직접 수정 방지와 reproducible build 검사를 둔다.
- [ ] 두 번째 소비자로 karaoke 또는 native에 의미 token을 한정 적용한다.
- [ ] native에는 web component 공유를 강제하지 않는다.
- [ ] public API·token 변경에 ADR, changelog, migration note를 운영한다.
- [ ] component 승격 또는 deprecation 사례 1개를 끝까지 기록한다.
- [ ] 4~6시간 제한 디자인→prototype 연습을 2회 진행한다.

검증 기준:

- 동일 입력에서 token 산출물이 재현된다.
- default/karaoke/native의 key mismatch가 자동 검사 또는 명시적 mapping으로 드러난다.
- 두 소비 화면에서 회귀 없이 변경한다.
- 자동화가 줄인 비용을 이전 수동 비용과 비교한다.

완료 조건:

- [ ] token 단일 원천의 이득이 유지비보다 크다는 증거가 있다. 아니면 단순한 CSS/TS 원천으로 축소했다.
- [ ] migration·deprecation 한 사례가 문서화됐다.
- [ ] 시스템 지표와 사용자 관찰 결과가 최소 1회 비교됐다.
- [ ] 10분 발표와 심층 질문에서 핵심 trade-off를 설명한다.

### 단계 6 — 선택적 확장과 채용 대응

기간: 7~12개월.

작업 순서:

- 7개월: 가장 약한 증거 하나를 보강한다.
- 8개월: 실제 Figma-code drift가 반복된 경우에만 반자동 검사를 실험한다.
- 9개월: SEED 또는 관련 오픈소스의 문서·접근성·버그 개선에 작은 기여를 시도한다.
- 10개월: Markdown/`llms.txt` index와 금지 token·variant·a11y 누락 validator를 실험한다.
- 11개월: 목표 공고 3~5개의 최신 요구사항과 evidence matrix를 갱신한다.
- 12개월: 포트폴리오 편집, 발표 리허설, 사전과제 연습, 지원 사이클을 운영한다.

검증 기준:

- Figma sync나 AI 도구가 실제 반복 오류·소비 문제를 줄인다.
- 오픈소스 기여가 채택되지 않아도 재현, 논의, 학습을 정직하게 기록한다.
- 각 채용 요구사항에 특정 파일·Figma frame·테스트·지표를 연결한다.
- 증거가 없는 항목은 과장하지 않고 “없음”으로 표시한다.

완료 조건:

- [ ] 12개월 gate를 평가했다.
- [ ] 선택적 자동화마다 도입 전 비용과 도입 후 효과가 있다.
- [ ] 5분·15분·45분 세 형식의 발표가 일관된다.
- [ ] 다음 12개월에는 가장 약한 역량 하나만 우선순위로 남긴다.

## 9. 첫 2주 실행 체크리스트

### 1주차 — 기준선과 문제 정의

월:

- [ ] 홈, blog 목록, garden 목록, 상세, 모바일 navigation 후보를 확정한다.
- [ ] light/dark × mobile/desktop 화면을 캡처한다.
- [ ] 캡처 환경의 viewport, locale, route, commit을 기록한다.

화:

- [ ] `packages/ui/src/styles/globals.css`의 CSS 변수를 inventory한다.
- [ ] `apps/karaoke/src/index.css`와 `apps/mumak-native/constants/theme.ts`의 대응값을 표로 만든다.
- [ ] raw color, 임의 spacing/type/radius/motion 사용과 의도적 예외를 분리한다.

수:

- [ ] 사용자 경험 원칙 3개를 작성한다.
- [ ] 각 원칙에 좋은 예·나쁜 예 2개씩 연결한다.
- [ ] “사용자 문제 없이 기술만 설명한 문장”을 삭제하거나 다시 쓴다.

목:

- [ ] 설치 component와 지원 component를 구분한다.
- [ ] 지원 후보 6~12개, blog recipe, product/시각화 예외를 분류한다.
- [ ] `packages/ui`와 `apps/blog/src/shared/ui` 경계를 검토한다.

금:

- [ ] keyboard, focus-visible, contrast, target size, reduced motion 기준선을 확인한다.
- [ ] `apps/blog/e2e/a11y.spec.ts`와 `validate-design-system.mjs`가 잡는 것과 못 잡는 것을 기록한다.
- [ ] 기존 blog preflight 결과를 baseline으로 남긴다.

주말:

- [ ] 5분 문제 설명을 녹화한다.
- [ ] 외부 리뷰 1회 또는 자기 비평을 진행한다.
- [ ] 다음 주 범위를 `Button`, `ContentCard`, 최소 token으로 고정한다.

1주차 종료 gate:

- [ ] 대표 화면과 상태 기준선이 있다.
- [ ] audit, principles, support matrix, exceptions 초안이 있다.
- [ ] 다음 주에 만들지 않을 것을 명시했다.
- [ ] 시스템 필요성을 사용자 경험 문제로 설명한다.

### 2주차 — 최소 수직 절편

월:

- [ ] primitive/semantic/theme schema 초안을 만든다.
- [ ] 기존 CSS variable과의 alias·mapping을 정한다.
- [ ] 생성 package를 만들지 않고도 검증할 수 있는 최소안을 먼저 설계한다.

화:

- [ ] CSS/TS 산출 prototype을 만든다.
- [ ] 동일 입력의 재생성 결과가 같은지 확인한다.
- [ ] 생성 이득이 없으면 package 분리를 보류하고 단순 원천으로 축소한다.

수:

- [ ] Figma Variables를 만든다.
- [ ] `Button`과 `ContentCard` properties/state를 만든다.
- [ ] Figma key↔코드 key 대응표를 완성한다.

목:

- [ ] React 구현과 keyboard/focus/disabled/loading/reduced-motion 계약을 연결한다.
- [ ] colocate unit test를 추가하거나 기존 test가 계약을 실제로 막는지 검토한다.
- [ ] target size와 contrast는 자동·수동 검증을 구분한다.

금:

- [ ] light/dark × mobile/desktop visual baseline을 만든다.
- [ ] blog preflight, design validator, build를 실행한다.
- [ ] 의도한 diff와 회귀를 분리한다.

주말:

- [ ] before/after 1쪽을 작성한다.
- [ ] 결정 3개, 기각 1개, 남은 불확실성을 기록한다.
- [ ] 외부 리뷰를 받고 다음 4주 범위를 조정한다.

2주차 종료 gate:

- [ ] Figma와 코드 semantic key 대응표가 있다.
- [ ] token 변경 영향이 visual diff에 나타난다.
- [ ] `Button`·`ContentCard`가 지원 계약과 테스트를 가진다.
- [ ] build·unit·design 검사에 회귀가 없다.
- [ ] 생성 파이프라인을 유지하거나 보류한 근거가 있다.

## 10. PR 단위와 검증 명령

### 권장 PR 분할

PR 1 — audit와 기준선:

- `docs/design-system/{audit,principles,support-matrix,exceptions,decision-log}.md`
- baseline capture와 측정 계획.
- 코드 추상화 없음.

PR 2 — 최소 token prototype:

- 기존 CSS 변수 alias 또는 조건부 `packages/design-tokens/` prototype.
- 생성·drift fixture.
- `Button`·`ContentCard` 수직 절편만 포함.

PR 3 — component contract:

- 최초 지원 component의 state·a11y 계약과 colocate test.
- `validate-design-system.mjs`의 필요한 최소 확장.

PR 4 — visual regression:

- blog Playwright 안에 안정적인 screenshot 6~10개.
- axe·keyboard·reduced-motion 보완.

PR 5 — 실제 화면 migration:

- blog/garden 목록 먼저.
- 상세와 모바일 navigation은 별도 PR로 분리 가능.
- before/after와 migration note 포함.

PR 6 — 문서와 사례 연구:

- Markdown 문서 또는 조건부 `/design-system` showcase.
- evidence matrix와 5분 발표 자료.

### 각 코드 PR의 기본 검증 순서

```bash
pnpm --filter blog check-types
pnpm --filter blog lint
pnpm --filter blog format:check
pnpm --filter blog validate:design
pnpm --filter blog test:ci
pnpm --filter blog build
```

`packages/ui`를 수정하면 추가한다.

```bash
pnpm --filter @mumak/ui lint
pnpm --filter @mumak/ui format:check
```

`packages/design-tokens`를 도입하면 해당 package에 최소한 다음 script를 정의하고 실행한다.

- `build`: token 입력에서 CSS/TS 산출물 생성.
- `check`: schema, semantic key set, generated drift 검증.
- `test`: generator와 key mapping fixture 검증.

라우팅·레이아웃·navigation·card·metadata 변경은 `apps/blog/e2e/**` 영향 범위를 검토한다. screenshot baseline을 도입한 뒤에는 변경 이미지를 자동 승인하지 않고 PR에서 diff 이유를 기록한다.

### 모든 PR의 완료 정의

- [ ] 변경이 대표 사용자 문제와 연결된다.
- [ ] 정확한 파일 경로와 영향 소비자가 기록됐다.
- [ ] 지원 범위와 비지원 범위가 갱신됐다.
- [ ] 자동 검사와 수동 검토 결과가 있다.
- [ ] 접근성, dark mode, responsive, reduced motion 영향을 검토했다.
- [ ] 의도하지 않은 visual diff가 없다.
- [ ] 문서와 실제 API가 일치한다.
- [ ] migration 또는 rollback 방법이 필요한 변경에는 절차가 있다.
- [ ] 실패, 경고, 측정 한계를 숨기지 않았다.

## 11. 측정과 포트폴리오 증거

### 시스템 지표

- raw color·임의 recipe 수.
- 같은 의미인데 이름·값이 다른 token 수.
- 지원 component의 계약·test 보유율.
- visual baseline 수와 flaky 재실행률.
- 접근성 위반 수와 수동 예외 수.
- migration된 대표 화면 수.
- token/component 변경에 걸린 시간과 영향 범위 예측 정확도.
- 문서와 API의 불일치 수.

### 사용자 과업 지표

대표 과업:

- blog/garden에서 원하는 콘텐츠를 찾는다.
- 목록의 분류와 상태를 이해한다.
- 글을 읽고 관련 콘텐츠로 이동한다.
- 모바일과 keyboard에서 같은 과업을 완료한다.

측정 후보:

- 과업 성공 여부와 소요 시간.
- 잘못 선택하거나 되돌아간 횟수.
- focus 또는 navigation을 놓친 지점.
- 정보 위계와 interactive state에 대한 이해.
- 변경 전후 3명 이상의 관찰 메모.

표본이 작으면 제품 성과를 일반화하지 않는다. “3명의 관찰에서 나타난 방향성”과 “정량적으로 입증된 개선”을 구분한다.

### 공고 요구사항→증거 매트릭스

| 공고 역량          | 연결할 증거                                             |
| ------------------ | ------------------------------------------------------- |
| 높은 디자인 완성도 | 대안 비교, type·spacing·motion 선택 근거                |
| Figma 에셋 구축    | Variables·Properties·Slots와 코드 API 대응              |
| token·멀티플랫폼   | default/karaoke/native semantic mapping과 차이의 이유   |
| 재사용 패턴        | `ContentCard`·`ContentSegmentNav` 승격과 보류 사례      |
| 구현 이해          | React 구현, SSR/SSG, i18n, 성능 제약 처리               |
| 접근성             | focus·keyboard·ARIA·target·contrast·reduced-motion 계약 |
| 부채 개선          | 분리된 원천과 recipe drift의 점진 migration             |
| 문서·전파          | do/don’t, support matrix, 외부 리뷰와 수정 기록         |
| AI 워크플로우      | 구조화 규칙을 읽고 위반을 찾는 작은 validator           |
| 장기 방향          | 범위를 늘리지 않는 원칙과 확장 조건                     |

### 포트폴리오 표현 원칙

피할 표현:

- “SEED급 디자인시스템 구축.”
- “56개 component를 지원.”
- “접근성 완전 준수.”
- 표본·측정 방법 없는 “사용자 지표 개선.”

권장 표현:

- “기존 공통 UI를 기반으로 지원 범위를 6개 component로 정의하고 상태·접근성·시각 회귀 계약을 추가했다.”
- “web과 native의 semantic key를 정렬하되 component 공유는 강제하지 않았다.”
- “세 가지 대안을 비교해 정보 위계와 keyboard 탐색을 개선하고 선택·기각 이유를 decision log로 남겼다.”

## 12. 남은 불확실성과 재평가 규칙

### 남은 불확실성

- 당근 공고의 정확한 게시일, 마감일, 코드 작성 비중, Figma 라이브러리 소유 범위, native 협업 범위는 공개 정보로 확정되지 않았다.
- 사전과제의 실제 형식과 평가 기준은 공개되지 않았다.
- 사용자의 현재 Figma 숙련도와 시각 디자인 포트폴리오는 평가하지 않았다.
- SEED의 iOS·Android 구현 저장소 전체는 공개 조사 범위에 없어 모든 멀티플랫폼 세부를 직접 대조하지 못했다.
- mumak-www 감사는 코드·build·test를 확인했지만 Figma workflow와 이 계획의 수동 visual baseline은 아직 실행하지 않았다.
- 12개월 일정은 주 6~8시간 가정의 추정이며 채용 합격을 보장하지 않는다.

### 2주마다 확인

- [ ] 실제 화면 개선과 시스템 인프라의 시간 비율이 균형적인가?
- [ ] 새 token·component가 시작 문턱 2개 이상을 만족하는가?
- [ ] visual test가 안정적 신호를 주는가?
- [ ] 가장 큰 사용자 문제가 다음 작업의 우선순위인가?
- [ ] Figma와 코드의 대응표가 현실과 일치하는가?

### 매월 삭제·보류 리뷰

- [ ] 사용되지 않은 token·variant·component를 제거하거나 비지원으로 표시한다.
- [ ] 중복 문서를 단일 원천으로 합친다.
- [ ] 지난달 실제 UI 변경을 설명하지 못하는 도구를 보류한다.
- [ ] 다음 달에는 가장 약한 채용 증거 하나만 보강한다.

### 3개월마다 외부 사실 재검증

- [ ] 당근 공식 채용공고의 공개·지원 상태를 확인한다.[1][2]
- [ ] SEED 공식 문서와 공개 저장소의 주요 구조 변경을 확인한다.[3][8]
- [ ] 공고 요구사항→증거 매트릭스를 갱신한다.
- [ ] 외부 원문이 바뀌면 확인일과 이전 snapshot을 함께 기록한다.

## 13. 출처

외부 사실은 다음 조사 원문을 기준으로 한다. 저장소 경로에 관한 설명은 현재 로컬 파일을 다시 확인했다.

- [1] https://careers.daangn.com/jobs/role/7791182003 — 당근 Design Engineer - 디자인 시스템 채용공고
- [2] https://careers.daangn.com/jobs — 당근 공식 채용공고 목록
- [3] https://seed-design.io/docs — SEED Design System Overview
- [4] https://seed-design.io/updates/how-seed-evolved — 더 당근답게: SEED는 어떻게 진화했나
- [5] https://seed-design.io/foundations/design-token — SEED Design Token
- [6] https://seed-design.io/foundations/inclusive-design — SEED Inclusive Design
- [7] https://seed-design.io/ai-integration — SEED AI Integration
- [8] https://github.com/daangn/seed-design/blob/aeca066e8e210103cc9f723f757c8c0dc107e45a/TECH.md — 조사 snapshot의 SEED 기술 구조
- [9] https://github.com/daangn/seed-design/blob/aeca066e8e210103cc9f723f757c8c0dc107e45a/packages/rootage/components/action-button.yaml — Action Button spec
- [10] https://github.com/wannysim/mumak-www/tree/528e5ed856a698f79f907c37862bda66fb4176fd — mumak-www v1.16.0 감사 tree
- [11] https://github.com/wannysim/mumak-www/blob/528e5ed856a698f79f907c37862bda66fb4176fd/packages/ui/src/styles/globals.css — 공통 web token과 theme
- [12] https://github.com/wannysim/mumak-www/blob/528e5ed856a698f79f907c37862bda66fb4176fd/apps/blog/AGENTS.md — blog 구조와 UI contract
- [13] https://github.com/wannysim/mumak-www/blob/528e5ed856a698f79f907c37862bda66fb4176fd/apps/blog/scripts/validate-design-system.mjs — blog design validator
- [14] https://github.com/wannysim/mumak-www/blob/528e5ed856a698f79f907c37862bda66fb4176fd/apps/mumak-native/constants/theme.ts — native theme 원천
- [15] https://github.com/wannysim/mumak-www/blob/528e5ed856a698f79f907c37862bda66fb4176fd/apps/karaoke/src/index.css — karaoke theme와 motion
- [16] https://github.com/wannysim/mumak-www/blob/528e5ed856a698f79f907c37862bda66fb4176fd/.github/workflows/ci.yml — CI workflow
- [17] https://github.com/wannysim/mumak-www/blob/528e5ed856a698f79f907c37862bda66fb4176fd/.github/workflows/e2e.yml — E2E workflow
- [18] https://github.com/wannysim/mumak-www/blob/528e5ed856a698f79f907c37862bda66fb4176fd/packages/ui/src/components/button.tsx — 공통 Button 구현
- [19] https://github.com/daangn/seed-design/blob/dev/CONTRIBUTING.md — SEED 기여와 변경 절차
- [20] https://seed-design.io/updates/why-we-hired-a-design-engineer — SEED Design Engineer 역할 설명
