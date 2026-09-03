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

## 열린 질문

결정이 필요하지만 근거가 부족해 아직 못 정한 것. 단계 1 시작 전에 답을 정한다.

### Q-003. sticky 패널의 `dvh` / `svh` / `vh` 혼용이 의도인가

`graph-legend`(dvh), `garden-sidebar`(svh), `post-toc`(vh)가 같은 문제에 다른 단위를 쓴다. 모바일 주소창 동작이 셋 다 다르다. 의도한 차이인지, 작성 시점이 달라 생긴 drift인지 확인이 필요하다.

### Q-004. 포커스를 각 component가 그릴지, 전역 폴백에 맡길지

`Button`, `Badge`, `ContentCard`는 자체 ring을 그린다. `ContentSegmentNav`, `ArrowLink`는 `globals.css`의 전역 `*:focus-visible { outline-2 outline-offset-2 outline-ring }`에 기댄다 (`audit.md` §7-1).

둘 다 `--ring`을 쓰므로 `audit.md` §3-1의 light 대비 문제를 공유하지만, 계약 관점에서는 별개 질문이다.
선택지: (a) 전역 폴백을 기본으로 두고 자체 ring은 예외로 문서화 (b) 지원 component는 전부 자체로 그린다 (c) 지금처럼 두되 계약에 어느 쪽인지만 명시.
