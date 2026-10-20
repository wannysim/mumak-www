# 지원 범위 (support matrix)

> "설치돼 있다"와 "지원한다"를 분리한다. 지원은 **계약 + 테스트 + 문서**가 있고, 깨지면 고칠 책임을 진다는 뜻이다.
>
> inventory 기준선: commit `03f7928`. 소비처·감사 수치의 근거는 `audit.md` §7이고, `현재 테스트` 열은 D-007 같은 후속 결정을 반영해 계속 갱신한다.

## 원칙

- 지원 대상은 첫 3개월 6-12개를 넘기지 않는다.
- 앱 2곳 이상에서 쓰이거나, 상태/접근성 로직 공유로 오류 위험이 줄거나, 반복 비용이 기록된 것만 올린다.
- 지원하지 않는다고 지우는 게 아니다. **계약을 약속하지 않을 뿐**이다.
- 승격은 `decision-log.md`에 근거를 남기고 한다.

## 1. 지원 대상 (단계 1-2)

6개로 시작한다. 전부 대표 흐름(탐색 → 목록 → 읽기 → 다음 콘텐츠)에 실제로 등장한다.

| component           | 위치                                              | 대표 흐름에서의 역할       | 소비처                             | 현재 테스트                                           |
| ------------------- | ------------------------------------------------- | -------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `Button`            | `packages/ui/src/components/button.tsx`           | 검색·테마·언어·메뉴 트리거 | 5개 앱, blog 내 12곳               | Storybook 상태·포커스 + Blog/Garden E2E               |
| `Badge`             | `packages/ui/src/components/badge.tsx`            | 카테고리·성장단계·태그 칩  | 3개 앱, blog 내 12곳               | 없음 (packages/ui)                                    |
| `ContentCard`       | `apps/blog/src/shared/ui/content-card.tsx`        | 목록의 주 타깃             | `PostCard`, `NoteCard`             | 단위 5 case + Storybook 슬롯·포커스 + Blog/Garden E2E |
| `ContentSegmentNav` | `apps/blog/src/shared/ui/content-segment-nav.tsx` | 목록 필터                  | `BlogNav`, `GardenNav`             | 10 case / 100%                                        |
| `PageHeader`        | `apps/blog/src/shared/ui/page-header.tsx`         | 화면 정체성 + h1           | blog·garden 인덱스, 태그, 카테고리 | 3 case / 100%                                         |
| `ArrowLink`         | `apps/blog/src/shared/ui/arrow-link.tsx`          | 보조 이동 경로             | 인덱스 → 그래프, NextReading 하단  | 3 case / 100%                                         |

`cardSurfaceClass`(`shared/ui/card-surface.ts`)는 component가 아니라 recipe지만 `ContentCard`와 `GardenOverview` 타일이 공유하는 단일 소스라 `ContentCard` 계약에 포함해 다룬다.

2026-10-15: D-011의 포커스 계약은 Button·ContentCard에 적용했다. Storybook 16개 검사는 포커스·Controls·테마·시작 화면 접근성을 함께 다루며, 모든 대상의 모든 상태를 보증하는 숫자가 아니다. 실제 제품 검증은 Blog/Garden 범위다. 상세 증거·한계는 [focus-lab.md](./focus-lab.md), 도구와 테마는 [storybook.md](./storybook.md)를 따른다. 위 소비처 수와 기존 단위 커버리지는 inventory 기준선이며 현재 전수 재조사 결과가 아니다.

2026-10-16: D-014로 기본 Button의 Light 글자 대비(기본 4.62:1 / hover 5.90:1)와 독립 버튼 역할 token을 적용했다. Pressed 1px와 네이티브 키보드 동작은 유지하고, reduced-motion에서는 전환을 생략한다. 색·입력·터치·동작 줄이기의 회귀 검사는 `button-product.spec.ts`와 대비 실습 검사에 둔다. loading·실기기 터치 편의성과 다른 component의 motion 계약까지 완료한 것은 아니다.

### 왜 이 6개인가

- `Button`, `Badge`: 앱 2곳 이상 사용이 수치로 확인된 7개 중 blog 대표 흐름에 등장하는 둘. `input`/`label`/`textarea`/`card`/`drawer`도 2곳 이상이지만 blog의 탐색-읽기 흐름에 없다.
- 나머지 4개: blog/garden **양쪽** 대응 화면이 공유하는 primitive. 한쪽만 고치면 즉시 drift가 생기는 지점이라 계약의 값이 가장 크다.

### 각 대상에 단계 2까지 갖출 것

- anatomy(구성 요소)와 variant 목록
- 상태표: default / hover / pressed / focus-visible / disabled / loading / empty
- 접근성 계약: semantic HTML, 키보드 조작, ARIA, 타깃 크기, 반응 축소
- D-010 포커스 계약: 공통 foundation 사용, 기본/자체 표시 여부와 예외 이유, 대체 표시 없는 outline 제거 금지. Button·ContentCard의 D-011 적용·검증은 완료했으며 나머지 대상과 미검증 배치는 남는다. 자동 a11y 검사와 실제 키보드·대비·잘림·가림 확인의 범위를 구분한다
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

기준선 commit `03f7928` 당시 56개 중 **29개는 어느 앱에서도 import되지 않았다.** 아래 목록은 당시 재고이며 현재 미사용 목록으로 해석하지 않는다. D-015에서 admin 로그인이 `spinner`를 소비하기 시작했고 D-017에서는 공유 LoadingButton의 내부 부품으로 옮겼다. 사용 시작만으로 독립 지원 대상이 되는 것은 아니다.

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
| viewport surface 계약     | D-009에서 전체 화면은 `dvh`, 보조 panel은 `svh`로 정함. `post-toc`·그래프 범례 구현 대기           | 반복 4곳 + 결정 완료 |
| 중앙 정렬 상태 페이지     | `min-h-[50vh]`가 error/not-found 3곳에 복제                                                        | 반복 3곳             |
| 목록 empty 안내 문구      | blog/garden index가 같은 마크업을 인라인 복제                                                      | 반복 2곳             |
| `SwitcherDropdown` 테스트 | 커버리지 33.33%. 대표 흐름의 theme/locale 전환에 쓰인다                                            | 위험 축소            |

`PostTags`는 단계 2의 1순위다. 문서화된 규칙 위반이면서 동시에 대표 흐름 안에 있다.

## 5. 명시적 비목표

`plan.md` §6을 이 문서 수준으로 다시 적는다. 범위가 새면 여기부터 확인한다.

- 새 독립 docs 앱 또는 전체 UI 카탈로그용 Storybook. Button·ContentCard의 최소 학습·검증용 Storybook은 D-012에 따라 이미 구현했다
- Figma 양방향 자동 sync
- 독립 npm 배포, Changesets, codemod, MCP
- React Native component 공통화 (native는 의미 이름과 원칙만 공유)
- 사용처가 하나뿐인 component token
- type / spacing token 신설 — `audit.md` §6에서 반복 근거가 없다고 판명

## 6. 갱신 규칙

- 지원 대상을 추가·제거하면 이 파일과 `decision-log.md`를 같은 PR에서 갱신한다.
- 지원 대상의 public API가 바뀌면 계약 문서와 테스트를 같은 PR에서 갱신한다.
- 인터랙션 변경은 [공통 계약](./interaction-contracts.md)과 아래 적용 현황을 함께 갱신한다. 공통 소스 반영과 실제 소비처 검증은 별도 상태다.
- 3개월 gate에서 지원 개수가 12개를 넘으면 늘린 이유를 적거나 되돌린다.

## 7. 인터랙션 적용 현황

2026-10-20 갱신. develop `360995ed` 위 작업 트리에 타깃 선택 기록과 D-017 포커스·loading 공통화가 있다. 아직 병합 전이다. 검증 결과는 각 실습 기록에 두며 구현 적용과 실제 배치 검증을 구분한다.

**상태 구분:** 적용 = 구현 존재, 미이전 = 선택한 방향으로 아직 바꾸지 않음, 의도된 차이 = 역할·이유가 있는 차이, 미검증 = 해당 환경의 증거 없음. 적용과 미검증은 동시에 성립할 수 있다.

| 항목                         | 공통 구현·제품 적용                                                                        | 미이전·의도된 차이                                                                           | 검증 근거와 한계                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 포커스 D-011·D-017           | 전역·공유 컨트롤 outline, 복합 입력/ContentCard, Blog 트리·skip link와 quant override 적용 | 메뉴 활성 행·비조작 컨테이너·오류 ring은 역할상 예외. 제품별 ring 값 유지                    | [focus-lab](./focus-lab.md)의 갤러리·제품 검증. 모든 설치 컴포넌트·배치의 검증 완료는 아님                            |
| default 색 D-014             | 공유 `button.tsx`와 `globals.css`의 버튼 역할 token                                        | 다른 variant는 이번 색 변경 대상 밖. karaoke/quant는 같은 역할 token에 기존 제품별 값을 유지 | [대비 기록](./button-contrast-lab.md)의 제품 Button 검사. 모든 소비 화면의 override·실제 배경을 전수 검증한 것은 아님 |
| pressed·reduced-motion D-014 | Button 공통 기반에 기존 1px pressed와 전환 생략                                            | popup 트리거는 기존 pressed 이동 예외. Button 밖의 motion은 미이전                           | 제품 Button의 입력·터치·reduce 검사. 모든 애니메이션의 계약 완료 아님                                                 |
| loading D-015·D-017          | 공유 LoadingButton, admin 요청 6종과 Storybook C에 적용                                    | 최초 조회·페이지 이동은 별도 역할. 복사 pending 모델·다른 앱 요청은 아래 경계 참조           | [loading 기록](./button-loading-lab.md)의 단위·Storybook·admin 3브라우저 검증. 실제 발화·정적 spinner 인지는 미검증   |
| 타깃 D-016                   | Storybook C 선택. 제품에는 아직 미적용, 공통 API 없음                                      | 아래 Blog 아이콘 소비처 모두 미이전. 다른 앱·native는 이번 이전 단위 밖                      | [타깃 기록](./button-target-size-lab.md)의 자동 검사와 사용자 실제 모바일 선호. 제품 배치 검증은 남음                 |
| 학습 공간 D-012·D-013        | Storybook 시작 안내·공통 globals theme 및 상태 유지                                        | 제품 테마 전환 API를 새로 통합한 작업은 아님                                                 | [Storybook 안내](./storybook.md)의 실행 결과. Figma 대응이나 전체 카탈로그 완료 아님                                  |

### 포커스: 공통 이전과 표시 위치 예외

- **기본 outline 이전:** Input·Textarea·SelectTrigger·NativeSelect·Checkbox·RadioGroupItem·Switch·Toggle·TabsTrigger/Content·AccordionTrigger·Badge·Item·NavigationMenu trigger/link·MenubarTrigger·Sidebar 조작·CalendarDayButton·ScrollArea viewport·ResizableHandle·SliderThumb. 자체 focus ring을 제거하고 전역 기반을 사용한다. 코드 이전 범위이며 전부 독립 지원 대상으로 승격한 것은 아니다.
- **대체 표면:** InputGroup과 Command 검색은 그룹 외곽, Combobox chips 입력은 chips 외곽, OTP는 활성 slot, ContentCard 제목은 카드 외곽에 `focus-outline`을 표시한다. 내부 addon 버튼·chip 제거·태그는 각자의 포커스를 유지한다.
- **제품 override 이전:** Blog Garden 트리의 링크·펼침 버튼과 main/graph skip link, quant 차트 조작 영역·알림 닫기. Garden 트리 스크롤 경계에 outline 여유를 확보했다. karaoke 가이드의 별도 CSS는 이미 같은 2px/2px 규격이며 제품 ring 값을 유지한다.
- **의도된 표시 차이:** Select/Dropdown/ContextMenu/Menubar 항목은 키보드·포인터 이동에 따른 활성 행 배경을 유지한다. Dialog/AlertDialog 컨테이너와 Command 목록, Blog 그래프 범례·quant의 설명 이동 대상 같은 비조작 컨테이너는 일반 버튼처럼 외곽 전체를 강조하지 않는다. 실제 내부 조작의 포커스는 유지한다.
- **오류·선택 상태:** `aria-invalid` ring/border와 selected/checked 배경은 별도 상태로 보존한다. 제품별 `--ring`·`--sidebar-ring` 값은 삭제하거나 조기 통합하지 않는다.
- **검증 경계:** 새 갤러리는 기본 입력·선택·탭·accordion·badge·Menubar 트리거·Command 검색·복합 입력을 검사한다. Calendar·NavigationMenu·공유 Sidebar·ScrollArea·Resizable·Slider의 모든 배치/잘림은 추가 검증 대상이다. 메뉴 highlight 대비와 실제 스크린리더 발화도 이번 검사만으로 완료 선언하지 않는다.

### 타깃: Blog 아이콘 소비처와 함께 바꿔야 할 배치

아래 경로는 `apps/blog/src/` 기준이다. 직접 Button을 사용하는 아이콘 조작과 공유 소비 배치, 확인된 footer native 링크를 조사했다. **현재는 전부 C 미이전**이다. 먼저 헤더 한 군데만 고치는 대신 공통 표현과 연결된 배치를 함께 이전할 단위를 정한다.

| 소비처                                                      | 현재 크기·역할                                                         | 함께 검토할 부분                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `features/site-search/ui/site-search.tsx`                   | 모바일 검색 icon-sm 28px                                               | 헤더의 테마·언어 버튼과 간격, 전역 검색 열기                                       |
| `widgets/header/ui/mobile-menu.tsx`                         | 메뉴 icon-sm 28px                                                      | `SheetTrigger asChild`, 로고와 간격                                                |
| `shared/ui/switcher-dropdown.tsx`                           | 테마·언어 icon-sm 28px                                                 | Dropdown trigger, 헤더와 GraphToolbar 양쪽                                         |
| `features/switch-theme/ui/theme-switcher.tsx`               | hydration 전 28px placeholder                                          | 전환 후 트리거와 같은 레이아웃 크기                                                |
| `features/graph/ui/graph-toolbar.tsx`                       | 뒤로 36px + 공유 switcher                                              | 오른쪽 gap-1 배치, 포인터 통과 영역, 화면 가장자리                                 |
| `features/graph/ui/graph-controls.tsx`                      | 검색·필터 36px                                                         | 검색 확장·popover·필터 배지. 검색 아이콘 버튼의 접근 가능한 이름 누락도 확인됨     |
| `features/graph/ui/graph-legend.tsx`                        | 힌트 닫기 32px                                                         | 음수 margin, 범례 내부 타깃과 경계                                                 |
| `shared/ui/image-zoom.tsx`                                  | 확대 보기 닫기 32px                                                    | `DialogClose asChild`, 화면 모서리·포커스 복귀                                     |
| `widgets/garden-sidebar/ui/garden-sidebar.tsx`              | 데스크톱 접기·펼치기 icon-sm 28px                                      | 펼침/접힘 양쪽, sidebar 배치                                                       |
| `widgets/footer/ui/footer.tsx` + `social-links.tsx` minimal | 실제 Footer의 RSS·소셜 아이콘 링크. 16px 아이콘, 명시적 44px 타깃 없음 | native anchor/Link 배치·gap-6·좁은 화면. 실제 hit box는 브라우저 측정 전           |
| `widgets/footer/ui/social-links.tsx` compact                | 28px Button 아이콘 링크 recipe                                         | `asChild` anchor. 실제 Footer는 minimal 소비, compact의 제품 소비 여부는 별도 추적 |

`Navigation` 오른쪽은 28px 버튼 + gap-2(8px), `GraphToolbar`의 switcher는 28px + gap-1(4px)다. 현재 중심을 유지한 채 영역만 44px로 덮으면 각각 8px·12px가 겹치는 계산이므로, 공간 확보 없이 overlay만 추가할 수 없다. 이는 코드 치수에 따른 계산이며 제품 브라우저 측정 결과는 아니다.

이 표의 경계 밖도 미리 구분한다.

- 데스크톱 `shared/ui/search-trigger.tsx`는 텍스트 검색 트리거(h-9)다. 모바일 검색과 같은 기능이지만 아이콘 전용 표현을 그대로 강제할 대상은 아니다.
- 그래프 필터 해제·상세 이동, 모바일 Garden 트리, footer 텍스트 모드는 텍스트 버튼/링크다.
- 공유 Dialog·Sheet의 기본 닫기, 검색 입력 지우기 등 나머지 native button/link는 직접 Button import 조사만으로 포괄되지 않는다. 아이콘 타깃 전체 완료 선언 전에 별도 목록화·검증이 필요하다.
- admin·karaoke·mumak-next·mumak-react·quant에도 공유 Button 소비처가 있다. 이번 상세 목록은 Blog 범위이며 다른 앱의 타깃 적합성은 미검증이다.

### Loading: admin 소비처와 역할 경계

아래 경로는 `apps/admin/components/` 기준이다. 대기 요청 버튼 6종을 공유 C로 이전했다. LoadingButton은 Button 계약에 포함하는 조합이며 독립 지원 대상 개수를 늘리지 않는다.

| 소비처                               | 현재 상태                                     | 적용 판단에 필요한 구분                                      |
| ------------------------------------ | --------------------------------------------- | ------------------------------------------------------------ |
| `admin-session.tsx` 로그인           | 공유 C 적용, 동기 guard·status·성공 후 포커스 | 기존 이름·너비·실패 재시도 보존                              |
| 같은 파일 로그아웃                   | 공유 C 적용, 동기 guard·status·실패 재시도    | 대기 중 포커스 유지, 성공 후 로그인 입력으로 복귀            |
| `image-upload-form.tsx` 발행         | 공유 C 적용, 동기 제출 guard                  | 입력 잠금과 외부 업로드/검증 단계 안내 유지                  |
| `image-library.tsx` 새로고침·더 보기 | 공유 C 적용, 시작 버튼에만 loading 표시       | 최초 조회 구분, 새로고침 시 경로 초기화 보존                 |
| 같은 파일 재시도                     | 공유 C 적용, 실패한 cursor로 재요청           | 대기 중 버튼 유지, 성공 후 사라지면 새로고침으로 포커스 복귀 |
| 같은 파일 폴더 경로/폴더 열기        | 받은 목록을 prefix로 동기 필터링              | 현재 비동기 요청이 아니므로 버튼 loading 대상 밖             |
| 이미지 URL·스니펫 복사               | 완료/오류 안내, pending 표현 없음             | 짧은 clipboard 작업에 loading 표시가 필요한지 판단 전        |

Blog의 `progress-provider.tsx`는 페이지 이동 진행 상태를 담당하므로 C 버튼 표현의 누락으로 분류하지 않는다. 다른 앱의 데이터 조회·재생·동기화 등은 이름에 loading이 있다는 이유만으로 같은 역할로 묶지 않는다. 다음 실행 순서는 [NEXT.md](./NEXT.md)를 따른다.

LoadingButton은 모든 웹 앱에서 가져올 수 있지만 다른 앱의 요청 버튼은 자동으로 이전되지 않는다. quant 새로고침·karaoke 가져오기/공유 등은 기존 상태 전달과 역할을 대조하는 후속 목록화 대상이다. 이번 admin 이전 완료에 포함하지 않는다.
