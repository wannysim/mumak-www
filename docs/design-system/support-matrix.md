# 지원 범위 (support matrix)

> "설치돼 있다"와 "지원한다"를 분리한다. 지원은 **계약 + 테스트 + 문서**가 있고, 깨지면 고칠 책임을 진다는 뜻이다.
>
> 기준: commit `03f7928`. 근거 수치는 `audit.md` §7.

## 원칙

- 지원 대상은 첫 3개월 6-12개를 넘기지 않는다.
- 앱 2곳 이상에서 쓰이거나, 상태/접근성 로직 공유로 오류 위험이 줄거나, 반복 비용이 기록된 것만 올린다.
- 지원하지 않는다고 지우는 게 아니다. **계약을 약속하지 않을 뿐**이다.
- 승격은 `decision-log.md`에 근거를 남기고 한다.

## 1. 지원 대상 (단계 1-2)

6개로 시작한다. 전부 대표 흐름(탐색 → 목록 → 읽기 → 다음 콘텐츠)에 실제로 등장한다.

| component           | 위치                                              | 대표 흐름에서의 역할       | 소비처                             | 현재 테스트        |
| ------------------- | ------------------------------------------------- | -------------------------- | ---------------------------------- | ------------------ |
| `Button`            | `packages/ui/src/components/button.tsx`           | 검색·테마·언어·메뉴 트리거 | 5개 앱, blog 내 12곳               | 없음 (packages/ui) |
| `Badge`             | `packages/ui/src/components/badge.tsx`            | 카테고리·성장단계·태그 칩  | 3개 앱, blog 내 12곳               | 없음 (packages/ui) |
| `ContentCard`       | `apps/blog/src/shared/ui/content-card.tsx`        | 목록의 주 타깃             | `PostCard`, `NoteCard`             | 4 case / 100%      |
| `ContentSegmentNav` | `apps/blog/src/shared/ui/content-segment-nav.tsx` | 목록 필터                  | `BlogNav`, `GardenNav`             | 10 case / 100%     |
| `PageHeader`        | `apps/blog/src/shared/ui/page-header.tsx`         | 화면 정체성 + h1           | blog·garden 인덱스, 태그, 카테고리 | 3 case / 100%      |
| `ArrowLink`         | `apps/blog/src/shared/ui/arrow-link.tsx`          | 보조 이동 경로             | 인덱스 → 그래프, NextReading 하단  | 3 case / 100%      |

`cardSurfaceClass`(`shared/ui/card-surface.ts`)는 component가 아니라 recipe지만 `ContentCard`와 `GardenOverview` 타일이 공유하는 단일 소스라 `ContentCard` 계약에 포함해 다룬다.

### 왜 이 6개인가

- `Button`, `Badge`: 앱 2곳 이상 사용이 수치로 확인된 7개 중 blog 대표 흐름에 등장하는 둘. `input`/`label`/`textarea`/`card`/`drawer`도 2곳 이상이지만 blog의 탐색-읽기 흐름에 없다.
- 나머지 4개: blog/garden **양쪽** 대응 화면이 공유하는 primitive. 한쪽만 고치면 즉시 drift가 생기는 지점이라 계약의 값이 가장 크다.

### 각 대상에 단계 2까지 갖출 것

- anatomy(구성 요소)와 variant 목록
- 상태표: default / hover / pressed / focus-visible / disabled / loading / empty
- 접근성 계약: semantic HTML, 키보드 조작, ARIA, 타깃 크기, 반응 축소
- do / don't와 탈출구(escape hatch) 사용 시 소비자 책임
- 계약을 실제로 막는 테스트 (구조는 단위 테스트, 상태는 단계 3 visual baseline)

## 2. 지원하지 않음 — blog product recipe

blog의 콘텐츠·locale 지식을 담고 있어 `packages/ui`로 올리지 않는다. FSD 경계를 지키는 쪽이 맞다.

| 대상                             | 이유                                                |
| -------------------------------- | --------------------------------------------------- |
| `PostCard`, `NoteCard`           | `ContentCard` 슬롯 조립. 도메인 meta를 안다         |
| `BlogNav`, `GardenNav`           | `ContentSegmentNav` 조립. 카테고리/status 축을 안다 |
| `Breadcrumbs`                    | locale 라우팅 의존                                  |
| `WikiLink`, `BrokenWikiLink`     | garden 전용 문법                                    |
| `SearchPalette`, `SearchTrigger` | 검색 인덱스 구조 의존                               |
| `ExternalLink`                   | 이미 단일 소스이고 `validate:design` 규칙이 지킨다  |
| `ClientErrorBoundary`            | 실패 격리 인프라. 시각 결정 대상 아님               |
| `SwitcherDropdown`               | 커버리지 33.33%. 먼저 테스트가 필요하다 (§4)        |

## 3. 지원하지 않음 — `packages/ui` 미사용 재고

56개 중 **29개는 어느 앱에서도 import되지 않는다.**

```text
alert, alert-dialog, aspect-ratio, avatar, button-group, calendar, carousel,
chart, combobox, context-menu, direction, empty, field, form, hover-card,
input-otp, item, menubar, native-select, navigation-menu, pagination,
resizable, scroll-area, select, sidebar, slider, sonner, spinner, table
```

추가로 5개(`dialog`, `input-group`, `separator`, `toggle`, `tooltip`)는 `packages/ui` 내부 부품으로만 쓰인다.

이들은 shadcn 설치 결과물이다. 문서화하거나 계약을 붙이지 않는다. `plan.md` §6이 명시적으로 제외한 "전체 56개 UI component 문서화"가 이것이다.

지우지도 않는다. shadcn 재설치 비용이 0에 가깝고, 제거는 이 계획의 목적이 아니다. 필요하면 별도로 `knip`을 돌려 판단한다.

## 4. 승격 후보 (단계 2에서 재평가)

audit에서 반복이 확인됐지만 단계 1 범위에는 넣지 않는다.

| 후보                      | 근거                                                                                               | 문턱 충족            |
| ------------------------- | -------------------------------------------------------------------------------------------------- | -------------------- |
| `PostTags` → `shared/ui`  | blog·garden 카드가 둘 다 쓰는데 `widgets/post-card` 내부에 있다. FSD 같은 레이어 cross-import 위반 | 반복 2곳 + 규칙 위반 |
| motion token (`--ease-*`) | easing 4종이 손으로 쓰였고 karaoke/blog가 곡선까지 다르다                                          | 소비처 2곳 이상      |
| sticky 패널 max-height    | 같은 문제에 `dvh`/`svh`/`vh` 3가지 답, 4개 파일                                                    | 반복 4곳             |
| 중앙 정렬 상태 페이지     | `min-h-[50vh]`가 error/not-found 3곳에 복제                                                        | 반복 3곳             |
| 목록 empty 안내 문구      | blog/garden index가 같은 마크업을 인라인 복제                                                      | 반복 2곳             |
| `SwitcherDropdown` 테스트 | 커버리지 33.33%. 대표 흐름의 theme/locale 전환에 쓰인다                                            | 위험 축소            |

`PostTags`는 단계 2의 1순위다. 문서화된 규칙 위반이면서 동시에 대표 흐름 안에 있다.

## 5. 명시적 비목표

`plan.md` §6을 이 문서 수준으로 다시 적는다. 범위가 새면 여기부터 확인한다.

- 새 독립 docs 앱 또는 Storybook
- Figma 양방향 자동 sync
- 독립 npm 배포, Changesets, codemod, MCP
- React Native component 공통화 (native는 의미 이름과 원칙만 공유)
- 사용처가 하나뿐인 component token
- type / spacing token 신설 — `audit.md` §6에서 반복 근거가 없다고 판명

## 6. 갱신 규칙

- 지원 대상을 추가·제거하면 이 파일과 `decision-log.md`를 같은 PR에서 갱신한다.
- 지원 대상의 public API가 바뀌면 계약 문서와 테스트를 같은 PR에서 갱신한다.
- 3개월 gate에서 지원 개수가 12개를 넘으면 늘린 이유를 적거나 되돌린다.
