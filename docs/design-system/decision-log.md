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

## 열린 질문

결정이 필요하지만 근거가 부족해 아직 못 정한 것. 단계 1 시작 전에 답을 정한다.

### Q-001. `ContentCard` hover 제목 대비

`content-card.tsx`의 제목 링크는 hover 시 `text-primary`가 되고, light에서 3.48:1이다.
제목은 `text-xl font-semibold`(20px / 600)로 WCAG "큰 텍스트" 정의(24px, 또는 18.66px 이상 bold)의 경계에 있다. 600을 bold로 보면 3:1 통과, 아니면 4.5:1 미달이다.

선택지: (a) hover 색을 `accent-foreground`(7.92:1)로 바꾼다 (b) hover에 색 대신 underline을 쓴다 (c) 큰 텍스트로 보고 유지한다.
관련: 사이트의 다른 링크는 이미 (a)를 택했다 — `wikilink.tsx`와 `linked-notes-section.tsx`가 같은 이유로 `accent-foreground`를 쓴다.

### Q-002. `--radius`가 ui 0.625rem, karaoke 0.25rem인 것이 의도인가

karaoke의 각진 톤이 의도라면 예외로 문서화한다. 아니면 단계 5의 key mapping 대상이다.

### Q-003. sticky 패널의 `dvh` / `svh` / `vh` 혼용이 의도인가

`graph-legend`(dvh), `garden-sidebar`(svh), `post-toc`(vh)가 같은 문제에 다른 단위를 쓴다. 모바일 주소창 동작이 셋 다 다르다. 의도한 차이인지, 작성 시점이 달라 생긴 drift인지 확인이 필요하다.

### Q-004. 포커스를 각 component가 그릴지, 전역 폴백에 맡길지

`Button`, `Badge`, `ContentCard`는 자체 ring을 그린다. `ContentSegmentNav`, `ArrowLink`는 `globals.css`의 전역 `*:focus-visible { outline-2 outline-offset-2 outline-ring }`에 기댄다 (`audit.md` §7-1).

둘 다 `--ring`을 쓰므로 Q-001과 같은 대비 문제를 공유하지만, 계약 관점에서는 별개 질문이다.
선택지: (a) 전역 폴백을 기본으로 두고 자체 ring은 예외로 문서화 (b) 지원 component는 전부 자체로 그린다 (c) 지금처럼 두되 계약에 어느 쪽인지만 명시.
