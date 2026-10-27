# 결정 기록

> 무엇을 했는지가 아니라 **무엇을 고르고 무엇을 버렸는지**를 남긴다. 되돌린 결정도 지우지 않고 상태만 바꾼다.
>
> 형식: 문제 → 대안 → 선택 → 근거 → 되돌리는 조건.

## D-001. 기준선 캡처를 회귀 테스트가 아니라 문서로 둔다

- 상태: 채택 (2026-08-25, 단계 0)
- 문제: 단계 0은 대표 화면 기준선을 요구한다. 이걸 어디에 둘 것인가.
- 대안
  1. `e2e/`에 `toHaveScreenshot` 스펙으로 바로 추가
  2. 별도 스크립트로 캡처만 하고 단정하지 않음
- 선택: 2. `apps/blog/scripts/capture-baselines.mjs`
- 근거: 지금 시점의 화면은 "지켜야 할 정답"이 아니라 "앞으로와 비교할 사진"이다. 단정으로 만들면 아직 판단하지 않은 상태까지 고정된다. 게다가 CI E2E에 넣으면 아직 안정성을 확인하지 못한 스냅샷이 매 PR을 빨갛게 만든다. `plan.md`도 visual regression을 단계 3으로 배치한다.
- 되돌리는 조건: 단계 3에서 `toHaveScreenshot`을 도입할 때 이 스크립트의 화면 목록을 스펙으로 옮긴다. 그때 이 스크립트는 문서 갱신용으로만 남기거나 폐기한다.

## D-002. 풀페이지는 JPEG, 상호작용 상태는 PNG로 나눈다

- 상태: 채택 (2026-08-25, 단계 0)
- 문제: 무손실 풀페이지 캡처 36장이 24MB였다. 모바일 상세 한 장이 3.4MB로, 저장소 최대 tracked 파일(2.0MB `PretendardVariable.woff2`)을 넘겼다.
- 대안
  1. 캡처를 gitignore하고 로컬 산출물로만 취급
  2. 전부 축소 (DPR 1)
  3. 용도별로 포맷을 나눔
- 선택: 3
  - 긴 글 상세는 풀페이지 대신 **진입부 / 착지점** 앵커 캡처로 분리 (모바일 풀페이지는 3만 px 띠라 문서로도 못 읽는다)
  - 모바일 DPR 3 → 2
  - 목록 풀페이지는 JPEG q85, 포커스 링처럼 1px 대비가 판단 근거인 뷰포트 캡처만 PNG
- 근거: 1은 포트폴리오 증거를 저장소 밖에 두게 되어 목적을 잃는다. 2는 포커스 링 두께 판단을 못 하게 만든다. 용도가 다르므로 포맷도 달라야 한다. 픽셀 단정은 어차피 단계 3이 자기 스냅샷으로 따로 관리한다.
- 결과: 36장 7.7MB, 최대 920KB.
- 되돌리는 조건: 캡처 수가 늘어 총량이 15MB를 넘으면 Git LFS나 외부 호스팅을 검토한다.

## D-003. 포커스 캡처는 실제 Tab 이동 + 애니메이션 정착 후에 찍는다

- 상태: 채택 (2026-08-25, 단계 0)
- 문제: 첫 포커스 캡처에 링이 아예 없었다. 두 번째는 2px가 아니라 0.06px로 찍혔다.
- 원인 (측정으로 확인)
  1. `element.focus()`는 `:focus-visible`을 보장하지 않는다. 브라우저가 "키보드로 온 포커스"로 취급하지 않을 수 있다.
  2. `cardSurfaceClass`의 `transition-all duration-150`이 끝나기 전에 셔터가 내려갔다. Playwright의 `reducedMotion: 'reduce'` 컨텍스트로도 안 멈췄다 — 이 앱의 transition은 `prefers-reduced-motion`을 보지 않기 때문이다.
- 선택: `Tab`을 실제로 눌러 대상에 도달할 때까지 반복하고, 끝이 있는 애니메이션이 전부 끝날 때까지 기다린 뒤 찍는다.
- 부수 소득
  - 도달까지의 Tab 횟수가 그 자체로 접근성 근거가 된다. `/ko/blog` desktop 기준 **14회**.
  - 앱이 반응 축소를 다루지 않는다는 사실이 캡처 과정에서 증명됐다 (`audit.md` §4-1).
- 되돌리는 조건: 없음. 단계 3의 visual regression도 같은 대기 전략이 필요하다.

## D-004. token audit 스크립트를 만들지 않는다 (기각)

- 상태: **기각** (2026-08-25, 단계 0)
- 문제: token 인벤토리(3개 원천 비교, 사용 빈도, 임의값 집계)를 손으로 표에 적으면 곧 낡는다. `analyze-components.mjs`, `validate-design-system.mjs`라는 선례도 있어 스크립트로 만들 유혹이 있었다.
- 검토한 것: `apps/blog/scripts/audit-design-tokens.mjs`를 만들어 `globals.css` / `karaoke/index.css` / `native/theme.ts`의 키 차이와 blog 사용 빈도를 markdown으로 출력.
- 기각 근거
  1. `plan.md` 단계 0의 완료 조건이 "새 코드 추상화는 아직 추가하지 않았다"이다.
  2. `plan.md` §6의 새 도구 문턱은 "실제 화면 2곳 이상 반복 / 접근성 이득 / 반복 비용 기록" 중 2개 이상인데, 지금 이 집계는 **일회성**이다. 기준선은 갱신되는 게 아니라 고정되는 것이 목적이다.
  3. 3개 원천의 key mismatch를 자동 검출하는 건 `plan.md` 단계 5의 명시적 항목이다. 두 번째 소비자가 생긴 뒤에 만드는 게 순서다.
- 대신 한 것: 각 절에 재현 명령(`grep` 한 줄)을 적어 수치를 언제든 다시 뽑을 수 있게 했다.
- 되돌리는 조건: 단계 5에서 karaoke나 native에 의미 token을 실제로 적용할 때. 그때는 소비자가 2곳이 되어 문턱을 넘는다.

## D-005. type / spacing token을 신설하지 않는다

- 상태: 채택 (2026-08-25, 단계 0)
- 문제: 디자인시스템이라고 하면 type scale과 spacing scale부터 정의하고 싶어진다.
- 근거 (`audit.md` §6): 실사용 빈도가 이미 좁다.
  - font-size 상위 2개(`text-sm` 33, `text-xs` 20)가 전체의 절반을 넘는다
  - `gap-2`가 28회로 압도적
  - radius는 `--radius` 하나에서 `sm/md/lg/xl`이 파생되는 현 구조로 충분
- 선택: 단계 1의 token 작업을 **color(대비)와 motion 둘로만** 제한한다.
- 반대 근거도 기록: 빈도가 좁다는 건 "이미 일관적"일 수도 있고 "선택지를 몰라서 안 쓴다"일 수도 있다. 단계 2에서 글 상세 type hierarchy 대안을 비교할 때 이 판단을 다시 본다.
- 되돌리는 조건: 단계 2의 type hierarchy 검토에서 현 스케일로 표현 못 하는 위계가 나오면.

## D-006. `plan.md`의 물결표를 escape한다

- 상태: 채택 (2026-08-25, 단계 0)
- 문제: 커밋 `03f7928`의 `apps/blog/plan.md`가 `pnpm --filter blog format:check`를 깨고 있었다. 브랜치에 PR이 없어 CI를 한 번도 안 거쳤다.
- 원인: 한 줄에 `~`가 2개 이상이면 oxfmt가 취소선(`~~`)으로 정규화한다. `plan.md` 199번 줄에 `~`가 3개 있었다.
- 대안
  1. oxfmt가 고친 결과를 그대로 수용
  2. 범위 표기를 `-`로 바꿈
  3. `\~`로 escape
- 선택: 3
- 근거: 1은 내용을 손상시킨다 — 렌더링하면 문장 일부가 취소선이 된다. 2는 문서 전체가 `~`를 범위 구분자로 쓰고 있어 한 줄만 규칙이 달라진다. 3은 GFM에서 `~`로 렌더되고 oxfmt를 통과한다(실측 확인).
- 파급: 이 저장소의 다른 markdown에도 적용된다. 한 줄에 `~`가 하나면 안전, 2개 이상이면 escape. 알려진 `|` → `\|` 함정과 같은 계열이다.

## D-007. 카드 hover 제목에 `accent-foreground`를 쓴다

- 상태: 채택 (2026-08-26, 단계 0)
- 문제: `ContentCard` 제목 링크가 hover 시 `text-primary`로 바뀐다. 기본 light 배경에서는 3.48:1이고 실제 `bg-muted/40` hover 배경에서는 3.37:1이다. 제목은 20px / 600이라 WCAG large-scale text의 3:1 예외를 적용할 수 있는지가 불명확하다. 같은 surface recipe를 쓰는 `GardenOverview`의 16px / 600 제목에도 같은 색이 있어 normal text 기준으로는 명확히 미달한다.
- 대안
  1. hover 색을 `accent-foreground`로 바꾼다.
  2. 색은 `foreground`로 유지하고 underline을 추가한다.
  3. large-scale text로 보고 `primary`를 유지한다.
- 선택: 1
- 근거
  1. WCAG 2.2 SC 1.4.3은 hover 중 표시되는 텍스트에도 적용된다. normal text는 배경과 4.5:1 이상이어야 한다. ([Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum))
  2. large-scale text는 18pt 또는 14pt bold 이상이다. 20px / 600을 이 예외로 볼지는 명세만으로 명확하지 않으므로 경계 해석에 의존하지 않는다. ([WCAG 2.2 large-scale 정의](https://www.w3.org/TR/WCAG22/#dfn-large-scale))
  3. 실제 hover 상태를 Chromium에서 측정하면 `accent-foreground`는 light 7.66:1, dark 10.70:1이다. normal text 기준을 두 테마 모두 충분히 넘는다.
  4. `WikiLink`와 `LinkedNotesSection`에서 이미 검증한 고대비 텍스트 색을 재사용한다. 전용 link token이 없는 현재의 최소 선택이다.
  5. 카드 표면 자체가 hover 시 border, background, elevation으로 반응하므로 underline을 추가하지 않아도 색만이 유일한 상태 신호가 되지 않는다.
- 적용: `ContentCard`와 `GardenOverview`의 hover token을 교체하고 각각의 colocated test에서 `primary` 회귀를 막는다. `ContentCard`를 공유하는 Blog `PostCard`와 Garden `NoteCard`에도 함께 적용된다.
- 검증: headless Chromium에서 실제 hover transition이 끝난 뒤 computed text color와 투명한 surface background를 sRGB로 합성해 WCAG 상대휘도 공식을 적용했다. Blog/Garden 두 표면과 light/dark를 각각 측정했다.
- 되돌리는 조건: 링크 역할을 나타내는 별도 semantic token이 생기고, 그 token이 실제 light/dark hover 배경에서 모두 normal text 4.5:1 이상을 만족하면 이름을 교체한다. `primary` 복귀도 모든 실제 상태에서 4.5:1 이상일 때만 검토한다.

## D-008. karaoke의 radius 차이를 의도된 제품 테마로 유지한다

- 상태: 채택 (2026-08-27, 단계 0)
- 문제: `packages/ui`의 `--radius`는 `0.625rem`이고 karaoke는 `0.25rem`이다. 이 차이가 관리되지 않은 drift인지, 제품별 시각 언어인지 정해야 한다.
- 대안
  1. karaoke도 ui 기본값 `0.625rem`으로 통일한다.
  2. 공통 component의 구현·동작 기반은 공유하고 접근성 요구사항은 공통 원칙으로 다루되, karaoke의 각진 radius 테마를 유지한다.
  3. 지금 바로 공통 디자인시스템에 product별 semantic radius preset을 만든다.
- 선택: 2
- 근거
  1. karaoke는 `@mumak/ui/globals.css`와 `Button`, `Drawer`, `Input` 같은 primitive를 사용하면서 자체 CSS에서 `--radius: 0.25rem`으로 재정의한다. 공통 component 구현·동작 기반을 버린 별도 시스템이 아니라, 공유 기반 위의 product theme다.
  2. 활성 가사에는 시간 구간을 나타내는 1px 수평선과 timestamp가 있고, 이 선형 모티브가 divider, 각진 control, `rounded-none` 표면으로 이어진다. 편집 도구·콘솔 같은 인상은 의도한 시각적 취향이다.
  3. karaoke는 현재 wannysim 브랜드가 포괄하는 제품으로 운영하지 않는다. 제품 성격보다 브랜드 통일을 우선할 근거가 아직 없다.
  4. product별 preset은 두 번째로 같은 분기 구조를 요구하는 소비자가 생기기 전에는 추상화 비용을 정당화하지 못한다.
- 근거에서 제외한 주장: 각진 radius가 전자책 같은 읽기 경험을 만든다는 인과관계는 관찰하거나 검증하지 않았다. 읽기 경험은 활자, 여백, 현재 가사 강조, 자동 스크롤로 별도 평가한다.
- 수용한 비용: karaoke가 공유 component를 가져올 때 product theme override를 유지해야 하고, 명시적 `rounded-none`이 늘어나면 drift를 따로 점검해야 한다.
- 되돌리는 조건: wannysim 디자인시스템이 여러 제품을 포괄하는 브랜드 시스템으로 확장되고 karaoke가 그 브랜드 범위에 편입되면 다시 판단한다. 그때 radius 통일을 미리 답으로 정하지 않고 색, 활자, 밀도, motion, layout을 포함한 전체 시각 언어에서 브랜드 일관성과 제품 고유성을 비교한다.

## D-009. 뷰포트 단위는 표면 역할에 따라 나눈다

- 상태: 채택 (2026-08-31, 단계 0)
- 문제: `graph-legend`, `garden-sidebar`, `post-toc`의 최대 높이가 각각 `dvh`, `svh`, `vh`를 쓴다. 같은 문제에 근거 없이 다른 답을 둔 것처럼 보이지만, 실제 역할은 전부 같지 않다. 모바일 브라우저 UI가 변할 때 사용 가능한 공간과 레이아웃 안정성 중 무엇을 우선할지 계약이 필요하다.
- 확인한 사실
  1. 그래프 전체 화면은 `h-dvh`인 몰입형 surface다. 반면 `graph-legend`는 sticky panel이 아니라 캔버스 왼쪽 아래를 계속 덮는 absolute overlay다.
  2. `garden-sidebar`는 데스크톱 sticky 탐색 패널과 모바일 bottom sheet 모두 `svh`를 쓴다. 현재 구현 결과는 주소창 변화 중 높이가 출렁이지 않는 쪽에 가깝다.
  3. `post-toc`는 `xl` 이상에서만 보이는 sticky 목차이고, 긴 목차는 자체 스크롤한다. `vh`를 선택해야 할 별도 근거는 없다.
- 대안
  1. 현행 혼용을 그대로 둔다.
  2. 모든 surface를 `dvh` 또는 `svh` 하나로 통일한다.
  3. 전체 화면과 보조 panel의 역할을 나눠 단위를 선택하고, 각 예외를 기록한다.
- 선택: 3
  - 그래프처럼 현재 보이는 화면을 빈 공간 없이 채워야 하는 **전체 화면 surface는 `dvh`**를 쓴다.
  - sticky sidebar, 목차, sheet, popover처럼 내용 위에 머무르거나 자체 스크롤하는 **보조 panel의 `max-height`는 `svh`**를 기본으로 한다.
  - panel의 새 코드에는 `vh`를 쓰지 않는다. `post-toc`의 `vh`는 단계 2 구현에서 `svh`로 옮긴다.
  - `graph-legend`는 높이 단위만 바꾸지 않는다. 상시 overlay를 없애고 검색·필터 control 묶음에 정보 버튼을 둔다. 데스크톱은 popover, 모바일은 bottom sheet로 열며, “노드를 클릭하면 자세히 볼 수 있습니다” 안내도 그 안에서만 보여준다.
- 근거
  1. 사용자는 모바일 주소창 변화에 맞춰 panel이 늘고 줄어드는 layout shift가 사용성을 떨어뜨린다고 판단했다. Garden 탐색과 긴 글 목차는 화면을 더 많이 쓰는 것보다 위치와 높이가 안정적인 편이 낫다.
  2. 전체 화면 그래프는 panel과 다르다. 주소창이 사라져 생긴 공간을 캔버스가 채우는 것은 surface 자체의 역할이고, 빈 공간을 남기는 것보다 자연스럽다.
  3. 그래프 범례의 실제 문제는 `dvh`가 아니라 상시 overlay가 캔버스를 가리는 것이다. 단위 통일만으로는 사용자 문제를 해결하지 못한다.
  4. 가장 강한 반론은 `svh`가 주소창이 사라진 뒤 생긴 공간을 쓰지 못해 빈 공간과 내부 스크롤을 늘릴 수 있다는 점이다. 그래도 기본값은 안정성으로 두고 실제 사용성 증거가 있을 때만 예외를 만든다.
- 검증 한계: 실제 모바일 브라우저에서 주소창이 접히고 펴지는 상태를 아직 실측하지 않았다. 이 결정은 surface 역할과 사용자의 layout 안정성 우선 판단을 기록한 것이며, 구현 완료를 뜻하지 않는다.
- 수용한 비용: `svh` panel은 브라우저 UI가 사라진 상태에서 사용 가능한 세로 공간을 전부 쓰지 않을 수 있다. 범례를 on-demand로 바꾸면 색상 의미와 조작 안내의 최초 발견 가능성도 낮아질 수 있으므로 정보 버튼의 accessible name과 위치를 구현 때 검증한다.
- 되돌리는 조건: 실기기 검증에서 `svh` 때문에 큰 빈 공간이나 과도한 내부 스크롤이 생겨 주요 항목의 탐색·조작이 실제로 나빠지면 해당 panel만 `dvh` 예외로 바꾼다. 전체 화면 surface가 주소창 변화 때 의미 있는 재배치나 입력 방해를 일으키면 `dvh`도 다시 판단한다.

## D-010. 공통 foundation이 기본 포커스를 제공하고, 자체 표시는 근거 있는 예외로 둔다

- 상태: 채택 (2026-09-08, 단계 0, Q-004 인터뷰에서 사용자 확인)
- 문제: 개발자가 버튼이나 링크를 추가할 때마다 포커스 스타일을 직접 챙기면 누락될 수 있다. 키보드 사용자는 현재 위치와 조작 대상을 알아볼 수 있어야 하며, foundation과 preset을 정할 때부터 이를 검증해야 한다.
- 확인한 사실
  1. 웹 앱 `admin`, `blog`, `mumak-next`, `mumak-react`, `lattice`, `karaoke`는 진입점에서 `@mumak/ui/globals.css`를 가져온다. 공통 파일은 Tailwind를 불러오고 `--ring`, `@theme inline`, 전역 `*:focus-visible` outline을 정의한다. 공통 foundation 사용은 이미 마련된 전제다.
  2. `Button`과 `Badge`에는 자체 ring이 있고, `ContentSegmentNav`와 `ArrowLink`는 전역 outline을 사용한다. `ContentCard`는 제목 링크의 outline을 끄고 해당 링크에 포커스가 오면 카드 표면에 ring을 그린다. 이는 코드 확인이며 브라우저에서 모든 조합의 가시성을 검증했다는 뜻은 아니다.
  3. 기준선의 light `--ring` 대비는 2.82:1이고 기존 axe 시나리오는 통과했다 (`audit.md` §3-1·§8-2). 공통 색을 쓰거나 자동 검사가 통과한다는 사실만으로 포커스 가시성이 보장되지 않는다.
- 대안
  1. 공통 foundation의 전역 표시를 기본으로 제공하고, 사용자 문제를 설명할 수 있는 자체 표시를 예외로 허용한다.
  2. 지원 component가 모두 자체 표시를 책임진다.
  3. 현행 혼용을 유지하고 어느 방식을 쓰는지만 문서화한다.
- 선택: 1
  - 공유 웹 component를 사용하는 앱은 공통 foundation을 가져와야 한다. Storybook 검증 환경도 같은 foundation과 지원하는 제품 테마를 사용한다.
  - 전역 기본 표시는 개별 구현의 누락을 줄이는 안전망이다. 자체 표시가 가시성을 보완하거나 조작 대상의 범위를 더 명확히 할 때 예외를 허용한다.
  - 기본 outline을 제거하려면 같은 포커스 상태에서 식별 가능한 대체 표시가 있어야 한다. 전역 CSS가 개별 override의 결함을 자동으로 복구한다고 가정하지 않는다.
  - `ContentCard`처럼 제목 링크의 조작 범위를 카드 표면으로 표현하는 것은 예외의 근거가 될 수 있다. 단순한 취향이나 기존 코드에 있다는 사실만으로 예외의 검증을 면제하지 않는다.
- 근거
  1. 사용자는 포커스 스타일을 매번 기억해서 넣는 구조의 누락 위험을 우선 문제로 보았다. 모든 component에 자체 구현을 요구하면 그 부담이 반복된다.
  2. 사용자는 문제가 나타난 뒤 개별 조정하는 것보다 foundation과 preset 색상을 정할 때 Storybook으로 케이스를 확인하는 것을 더 중요하게 보았다. 전역 기본값과 사전 검증은 함께 필요하다.
  3. 현행 혼용의 위치만 적으면 누가 기본을 책임지는지, 언제 기본 표시를 없애도 되는지 설명할 수 없다. 기본 계약과 예외 조건을 함께 명시한다.
- 후속 검증 계약
  - foundation과 component preset의 지원 테마·상태·배치를 Storybook에서 재현하고 자동 a11y 검사를 추가한다. 단계 1에서는 `Button`과 `ContentCard`의 최소 절편부터 시작하고 지원 대상을 늘릴 때 확장한다.
  - 실제 Tab 이동으로 포커스 도달과 조작을 확인하고, 표시의 실제 배경 대비·잘림·가림을 확인한다. 기본 표시와 자체 표시 모두 대상이며, 자동 검사가 다루지 않는 항목은 별도 측정과 수동 확인으로 보완한다.
  - component의 지원 계약에는 기본/자체 표시 여부, 예외 이유, 검증한 테마·상태·배치와 아직 확인하지 않은 범위를 남긴다. Storybook 단독 표면 외에 실제 소비 화면에서도 대표 배치를 확인한다.
  - 참고: [Storybook accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing), [Storybook UI testing](https://storybook.js.org/docs/writing-tests). 도구의 설치·구성은 후속 구현에서 당시 버전의 공식 문서를 확인한다.
- 범위: 이번 결정은 계약 기록이다. Storybook 구축, focus 스타일 변경, light 대비 수정은 포함하지 않는다. 기존 계획의 Storybook 비목표는 전체 UI 카탈로그를 선제적으로 만드는 범위에 유지하고, 여기서 확인한 포커스 검증 용도는 후속 구현 범위에 포함한다.
- 검증 한계: 이번에는 foundation import와 포커스 스타일 소유 위치를 코드로 확인했다. 새로운 브라우저 측정이나 Storybook 검사를 실행하지 않았으며, 기존 자체 ring들이 이 계약을 충족하는지도 아직 판정하지 않았다. light 대비 결함은 단계 1의 미해결 항목으로 남는다.
- 수용한 비용: 모든 소비 앱과 검증 환경이 공통 foundation을 가져와야 한다. 자체 표시의 이유와 검증 범위를 유지해야 하며, 자동 검사 밖의 가시성 확인과 Storybook 운영 비용도 발생한다.
- 되돌리는 조건: 공통 foundation을 가져올 수 없는 웹 소비자를 지원해야 하거나, 이 계약을 적용한 뒤에도 표시 누락·override 충돌이 반복되어 키보드 위치 식별을 해치면 기본 표시의 소유 위치와 예외 범위를 재검토한다. foundation과 preset 검증으로 충분해진 자체 표시도 유지 근거를 다시 본다.

## D-011. 포커스 비교에서 B를 기본안으로 선택한다

- 상태: 채택·코드 적용 (2026-10-15). 사용자가 B와 독립 포커스 토큰을 선택했다. 배포는 별도다.
- 문제: 사용자는 키보드로 이동할 때 색과 디자인이 매번 달라지면 현재 포커스를 새로 찾아야 한다고 설명했다. 같은 시각적 단서를 따라갈 수 있어야 한다.
- 대안: A는 현재 버튼·카드의 서로 다른 ring, B는 버튼·카드·태그의 불투명 2px outline과 2px offset 및 테마별 공통 색이다. 실제 컴포넌트를 Storybook에서 비교했다.
- 사용자 판단: 비교 화면을 본 뒤 “확실히 B 쪽이 더 나아”라고 답했다. B를 다음 구현의 기본안으로 선택한다. 어떤 변수의 기여가 가장 컸는지, 모든 테마·배경을 직접 확인했는지는 이 답변만으로 확정하지 않는다.
- 근거와 한계: 사전 측정에서 B의 버튼 외곽선 대비는 지원한 네 배경에서 7.27:1 이상이었다. 사용자 한 명의 비교이며 일반적인 사용성 개선 수치로 해석하지 않는다. 기존 버튼 글자 대비와 reduced-motion 미해결 항목도 남는다.
- token 결정: 사용자는 서로 다른 역할을 미리 공통화하는 것을 조기 추상화로 보고 분리를 선택했다. 기존 `--ring`을 독립적인 의미 토큰으로 유지하고 light `oklch(0.45 0.15 45)`, dark `oklch(0.85 0.12 50)`를 직접 정의한다. 현재 `--accent-foreground`와 값은 같지만 참조 관계는 없다. 새 token이나 공통 색상 원천은 만들지 않는다.
- 대안과 비용: alias를 유지하면 색상 갱신 한 번으로 두 역할을 바꿀 수 있지만 텍스트 조정이 포커스 식별성까지 바꾼다. 독립 값은 브랜드 변경 때 각 역할의 적합성을 따로 검토해야 한다. 이번에는 사용 목적과 변경 이유가 다르므로 독립 검토 비용을 수용한다.
- 구현: `Button`은 자체 반투명 ring과 destructive 포커스 override를 제거하고 전역 2px solid outline·2px offset을 사용한다. `aria-invalid`의 오류 표시는 유지한다. `ContentCard`는 같은 outline을 카드 표면에 표시한다. Storybook B의 override를 제거해 제품 구현을 직접 검증하고 A에만 이전 표현을 재현한다. 강조 텍스트 색을 바꿔도 포커스 색이 유지되는 브라우저 테스트를 추가했다.
- 범위: 공통 foundation, `Button`, Blog/Garden의 `ContentCard`와 기본 링크. 다른 component의 자체 포커스 override와 `--sidebar-ring`은 이번에 마이그레이션하지 않았다. karaoke/quant의 제품별 `--ring` 값도 유지한다.
- 유지할 계약: D-010의 전역 기본 표시와 근거 있는 예외 원칙. 카드 제목에 포커스가 오면 카드 범위를, 태그에 오면 태그 범위를 표시한다.
- 재검토 조건: 실제 소비 화면에서 잘림·가림·배경 대비 문제가 생기거나 빠른 Tab 이동에서 위치 식별이 어려우면 해당 배치와 포커스 전환을 다시 비교한다.
- 증거: [포커스 실습 기록](./focus-lab.md), `apps/blog/stories/focus-comparison.stories.tsx`와 `focus-comparison.spec.ts`.

## 열린 질문

D-011의 token 연결 질문은 독립 유지로 닫았다. 다음은 선택한 규칙을 Figma Variables·상태와 코드로 대응하는 작업이며 현재 액션은 `NEXT.md`에서 관리한다. Q-001부터 Q-004까지의 기존 결정은 D-007부터 D-010에 보존한다.

## D-012. Storybook을 디자인 시스템 학습 공간으로 확장한다

- 상태: 채택 (2026-10-15, 사용자 제안)
- 문제: 사용할 Figma 파일이 없고, 코드에서 정한 규칙을 어디서 어떻게 관찰할지 구체적인 진입점이 필요하다.
- 대안: Figma 파일을 먼저 만들기 / 기존 Storybook을 확장하기 / 제품 안에 별도 갤러리 라우트를 만들기.
- 선택: 기존 `apps/blog` Storybook에 시작 안내·포커스 규칙·Button/ContentCard Controls를 추가하고 기존 A/B 비교와 연결한다. Figma 대응은 후속 보류한다.
- 근거: 실제 소비 컴포넌트와 CSS를 바로 관찰하고 조작할 수 있다. 이미 설치한 비교 환경을 재사용하며, 제품 라우트와 별도 token 사본을 늘리지 않는다.
- 비용과 한계: Next/i18n 설정과 예제 문구를 유지해야 한다. Figma 에셋 구축 역량의 증거는 생기지 않는다. 전체 컴포넌트 카탈로그·별도 앱·호스팅·CI job은 현재 범위에 포함하지 않는다.
- 되돌리는 조건: 여러 앱의 독립 사용이 늘어 blog 의존이 방해되면 분리를 검토한다. 실제 디자인 협업이나 에셋 제작 필요가 생기면 Figma를 추가한다.

## D-013. Light/Dark를 Storybook 전역 툴바에서 전환한다

- 상태: 채택 (2026-10-15, 사용자 개선 제안)
- 문제: 같은 컴포넌트가 Light/Dark 스토리로 중복되고, 일부 화면에는 개별 테마 선택기까지 있어 전환 위치가 다르다.
- 대안: 각 화면의 테마 선택기 / 공식 `@storybook/addon-themes` / 내장 `globalTypes`·toolbar와 공통 decorator.
- 선택: 내장 globals의 `theme`을 단일 선택 상태로 쓰고 공통 decorator에서 `.dark`와 `color-scheme`을 적용한다. CSS token 표와 시작 링크만 React context로 현재 선택을 읽는다. 기존 next-intl decorator와 같은 경계를 사용한다.
- 근거: 모든 실습에서 같은 위치로 전환하고 스토리 이동에도 선택을 유지한다. 현재 class 기반 CSS에는 추가 의존성이 필요하지 않다. theme은 제품 컴포넌트의 prop이 아니므로 Controls에서 제거한다.
- 구현: Light/Dark 스토리를 제거하고 Rules·Playground·Compare·States로 정리한다. Disabled·Invalid·Title Only는 컴포넌트 상태 예제로 유지한다. 시작 화면 링크에 locale과 theme을 전달한다.
- 비용과 한계: 미리보기 테마만 제어하며 Storybook manager 자체의 색을 동기화하지 않는다. portal 기반 컴포넌트를 추가할 때는 decorator 밖으로 나가는 DOM의 테마 상속을 검토한다.
- 되돌리는 조건: 별도 theme provider·portal·여러 디자인 시스템을 동시에 지원하게 되면 공식 themes addon으로의 전환을 검토한다.
- 근거 문서: [Toolbars & globals](https://storybook.js.org/docs/essentials/toolbars-and-globals), [Themes addon](https://storybook.js.org/docs/essentials/themes).

## D-014. 기본 버튼에 D 기본색과 E hover를 적용한다

- 상태: 채택 (2026-10-16, 사용자 비교·누락 점검 후 제품 반영 승인)
- 문제: Light 기본 주황색 버튼의 글자 대비가 3.34:1이며, 배경 opacity를 낮추는 hover에서는 2.65:1로 더 낮아진다. A는 밝지만 기준 미달이고 B는 읽기 쉬워도 어둡게 느껴졌다. D 기본색 선택 후 D hover 변화가 약하다는 관찰이 나왔다.
- 선택: D 기본 배경 `oklch(0.58 0.18 45)`와 흰 글자, E hover 배경 `oklch(0.52 0.18 45)`를 적용한다. 글자 대비는 기본 4.62:1, hover 5.90:1이다. 기존 pressed 1px 이동과 네이티브 Space/Enter 동작은 유지한다. 동작 줄이기 설정에서는 Button 전환을 생략한다.
- 범위: 공유 Button의 default variant 색. `--button-background`·`--button-foreground`·`--button-hover`는 브랜드 `--primary`와 독립적으로 선언한다. Dark와 karaoke/quant의 별도 테마는 기존 색을 명시적으로 보존한다. 전환 생략은 Button 공통 기반에 적용한다.
- 근거: 기본색의 밝은 인상과 읽기 쉬운 글자를 함께 선택하고, hover는 사용자가 변화를 확인했다. 버튼 문제 때문에 링크·배지의 primary 색까지 바꾸지 않는다. 값이 같아도 역할이 다른 token을 조기 공통화하지 않는다.
- 비용과 한계: 새 버튼 역할 token을 각 테마에서 유지해야 한다. 기본 4.62:1은 4.5:1 기준까지 여유가 작다. 글자 대비 충족이 전체 WCAG 충족을 뜻하지 않으며 loading·실기기 터치 편의성은 별도 후속 범위다.
- 재검토 조건: 실제 소비 화면에서 대비가 4.5 미만이거나 hover/pressed 구분이 어렵다면 해당 상태를 다시 비교한다.
- 증거: [버튼 대비 실습 기록](./button-contrast-lab.md), Storybook의 Compare·Refine·Hover와 실제 Button Playground.

## D-015. 버튼 loading은 원래 너비를 유지하는 spinner 표현을 선택한다

- 상태: 시각적 방향 채택 (2026-10-19, 사용자 Storybook 비교). 후속 요청으로 admin 로그인 버튼에 적용했다.
- 문제: 요청 대기 중 버튼 너비가 바뀌면 주변 요소가 밀릴 수 있고, 사용자는 이런 배치 변화를 피하고 싶다고 설명했다. 동시에 방금 시작한 작업이 진행 중임을 알아볼 수 있어야 한다.
- 대안: A는 문구만 변경, B는 spinner+문구, C는 원래 너비를 유지하고 기존 문구 자리에 spinner만 표시한다.
- 선택: C. 사용자가 방금 시작한 버튼 작업은 원래 너비를 유지하면서 spinner로 진행 상태를 표시한다. 기존 페이지 이동 진행 막대와는 역할을 구분한다.
- 사용자 근거: C의 너비 유지를 선호했고, 버튼의 spinner만으로 본인이 시작한 행위가 진행 중임을 인지할 수 있다고 판단했다. 아래 상태 문구에 의존한 관찰인지 확인했으며, 사용자는 버튼만 보았다고 명시했다.
- 대안 검토: B도 공간을 미리 확보하면 너비를 유지할 수 있다. 너비 유지와 spinner-only는 별개의 선택이며, 이번에는 사용자가 두 특성을 함께 선호했다. A/B가 항상 layout shift를 일으킨다는 측정이나 C가 모든 사용자에게 우월하다는 결론은 아니다.
- 비용과 한계: 대기 중 원래 작업 문구가 보이지 않는다. 긴 대기·여러 작업 동시 실행·reduced-motion의 정적인 표시에서 의미가 충분한지는 별도 확인이 필요하다. 사용자 한 명의 시각적 판단이며 스크린리더 음성 검증은 미완이다.
- 후속 계약: 시각적 문구를 감춰도 접근 가능한 이름과 상태 전달은 유지해야 한다. 실제 소비 버튼을 고르고 loading 연결·중복 요청 방지·성공/실패·포커스·크기 보존을 검증한 뒤 제품에 적용한다. 공유 Button API와 reduced-motion 대체 표현은 이 결정만으로 확정하지 않는다.
- 재검토 조건: 실제 사용에서 무슨 작업을 기다리는지 잊거나, 동작 줄이기에서 대기 상태를 알아보지 못하거나, 내용·locale·배치 변화로 크기가 유지되지 않으면 해당 표현을 다시 비교한다.
- 증거: [loading 실습 기록](./button-loading-lab.md), `apps/blog/stories/button-loading.stories.tsx`와 `button-loading.spec.ts`.
- 제품 적용 범위: admin 로그인. 기존 전체 너비를 보존하며 spinner-only와 접근 가능한 대기 상태, 중복 제출 방지, 실패 재시도, 성공 후 포커스를 연결한다. 공유 API 확정이나 다른 요청 버튼의 일괄 전환은 포함하지 않는다.

## D-016. 아이콘은 시각적 크기를 유지하고 조작 영역을 넓히는 C를 선택한다

- 상태: 방향 채택 (2026-10-20, 실제 모바일 비교). 당시 제품 미적용. 이후 D-018에서 공유 IconButton과 헤더·연결된 GraphToolbar를 이전했다.
- 문제: 작은 아이콘을 정확하게 겨냥해야 하는 부담을 줄이면서 보이는 버튼의 밀도를 유지하고 싶다.
- 대안: A 표면/타깃 32px, B 44px/44px, C 32px/44px. 실습의 아이콘 16px·중심 간격 52px는 동일하다.
- 사용자 판단: B는 선호 후보에서 제외하고 A/C를 고민했다. 이후 실제 모바일 기기로 실습을 조작한 뒤 C가 확실히 좋다고 선택했다. 이는 버튼 loading의 C 선택과 별개의 관찰이다.
- 선택: 시각적 크기와 실제 타깃을 분리하고 아이콘 조작에 44×44 CSS px 공간을 확보하는 방향. 기존 제품 표면은 역할에 맞게 유지하며, 실습의 표면 32px·중심 간격 52px를 전체 제품 규격으로 강제하지 않는다.
- 비용: 보이지 않는 영역도 공간을 차지한다. 이웃 타깃의 중첩·잘림·이벤트 가로채기를 막으려면 실제 소비 배치의 간격과 정렬을 함께 검토해야 한다.
- 일관성 조건: 같은 역할의 소비처를 먼저 목록화하고 공통 primitive/recipe로 이전한다. 일부만 적용하면 남은 곳을 미이전으로 명시한다. 기존 구현이라는 이유만으로 예외로 취급하지 않는다.
- 한계: 사용자 한 명의 실제 모바일 선호다. 기기·브라우저 정보와 정량 오탭률은 기록하지 않았다. 모든 제품 배치·보조기술·사용자의 편의성을 검증한 결과나 WCAG 전체 준수 선언이 아니다.
- 재검토 조건: 인접 조작을 잘못 실행하거나, 포커스 표시·레이아웃이 잘리거나, 좁은 화면에서 필요한 공간을 확보할 수 없으면 해당 배치를 다시 비교한다.
- 증거와 적용: [타깃 실습 기록](./button-target-size-lab.md), [인터랙션 계약](./interaction-contracts.md), [적용 현황](./support-matrix.md#7-인터랙션-적용-현황).

## D-017. 포커스를 공통 기반으로 확대하고 loading C를 공유 조합으로 이전한다

- 상태: 사용자 확대 요청에 따라 코드 적용 (2026-10-20). 같은 날 PR #637로 develop에 squash merge 완료(`314e01b5`).
- 문제: 입력창·사이드바 자체 포커스와 admin 로그인 인라인 loading이 남아 있어 소비처마다 다른 구현이 늘 수 있다.
- 선택: `focus-outline` 규격을 전역과 복합 표면의 단일 utility로 연결하고 일반 컨트롤의 자체 focus ring을 제거한다. 요청 버튼은 native `LoadingButton`이 Button+Spinner를 조합하고 앱이 요청·중복 방지·결과·포커스를 소유한다.
- 대안: 각 앱에 loading 마크업을 복제하면 drift가 반복된다. 모든 Button에 loading/asChild 분기를 넣으면 링크·메뉴 트리거까지 요청 정책을 확장한다. 기존 Button API를 유지하고 native 요청 버튼 조합을 선택했다.
- 이전 단위: 공유 UI 포커스 기반, Blog ContentCard·트리·skip link와 quant의 명시적 focus override. Loading은 admin 로그인·로그아웃·발행·새로고침·더 불러오기·재시도 6종과 Storybook C.
- 예외·한계: 메뉴 활성 행·비조작 컨테이너·오류 ring은 다른 역할로 유지한다. 제품별 theme 값은 보존한다. 다른 앱 loading·복사 pending 모델·실제 보조기술 발화는 완료 범위가 아니다. 당시 타깃 C 제품 미적용. 이후 이전 범위는 D-018과 지원 현황을 따른다.
- 비용: loadingLabel과 앱별 상태 전달이 필요하며 implicit form submit은 앱 guard로 막아야 한다. outline이 바깥에 그려지므로 스크롤·밀집 배치의 여유를 확인해야 한다.
- 재검토 조건: focus가 잘리거나 조작 범위를 오해하게 만드는 배치, spinner만으로 작업을 식별하지 못하는 상황, native 버튼 외의 비동기 조작 요구가 생기면 해당 계약을 다시 검토한다.
- 증거: [포커스 기록](./focus-lab.md), [loading 기록](./button-loading-lab.md), [공통 계약](./interaction-contracts.md), [적용 현황](./support-matrix.md#7-인터랙션-적용-현황).

## D-018. 헤더 이름을 제거하고 모바일 메뉴에 Home을 두는 C 배치를 선택한다

- 결정: Storybook 헤더 배치 C를 선택한다. 헤더의 `Wan Sim` 링크를 제거하고 모바일 메뉴 첫 항목은 `Home`, 데스크톱은 Home·Blog·Garden 링크로 구성한다. 64px 헤더 높이와 작은 아이콘 표면을 유지하며 아이콘 타깃 공간은 44px로 확보한다.
- 사용자 판단: C가 좋아 보인다고 평가한 뒤, 뒤로 버튼 영역이 Garden GraphToolbar의 별도 재현임을 확인하고 C를 선택했다. 구체적인 선호 이유나 이번 확인의 기기는 추가로 보고되지 않았다. D-016의 최초 타깃 C 선택과는 별도 결정이다.
- 비교한 대안: A는 기존 이름·28px 타깃, B는 이름 유지·44px 타깃이다. 사용자는 이번 배치에서 C를 선택했으며 A/B의 기각 이유를 별도로 단정하지 않는다.
- 범위: 비교 실습 선택 후 사용자의 제품 적용 요청에 따라 공유 IconButton과 헤더·연결된 GraphToolbar 이전을 구현했다. GraphToolbar의 뒤로 버튼을 일반 헤더에 추가하지 않는다. 홈 본문의 이름은 유지한다.
- 적용 단위: 공통 IconButton을 사용해 헤더·모바일 검색·공유 switcher와 연결된 GraphToolbar·테마 placeholder를 함께 이전한다. 다른 아이콘 소비처는 지원 현황에서 미이전으로 추적한다.
- 비용과 재검토 조건: 모바일 Home 접근에 메뉴 열기 단계가 추가된다. 사이트 식별이 어려워지거나 홈 접근이 불편해지는 경우, 4px 간격에서 오탭이 관찰되는 경우 배치와 간격을 재검토한다. 사용자 선택만으로 실제 제품·실기기 접근성 검증 완료를 주장하지 않는다.
- 증거: [헤더 배치 기록](./header-layout-lab.md), [다음 작업](./NEXT.md), [적용 현황](./support-matrix.md#7-인터랙션-적용-현황).
