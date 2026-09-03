# 예외 목록

> 시스템에 흡수하지 **않기로 한** 것과 그 이유. 예외가 없는 시스템은 거짓말이거나 아직 실제 화면을 안 만난 시스템이다.
>
> 규칙: 예외는 여기 적힌 것만 인정한다. 새 예외를 만들면 이 파일에 이유와 함께 추가한다. 이유 없이 늘어나면 그건 예외가 아니라 규칙이 틀린 것이다.

## 1. 코드로 강제되는 예외

`apps/blog/scripts/validate-design-system.mjs`가 실제로 들고 있는 allowlist.

### `src/widgets/spotify-vinyl/`

raw 색 규칙에서 제외된다.

- 이유: LP판을 사실적으로 그리는 스큐어모픽 위젯이다. `#1DB954`(Spotify 브랜드 그린), 무채색 음영, `inset` 그림자는 테마 대상 표면이 아니라 그림이다.
- 범위: `bg-[#1DB954]`(5), `text-[#1DB954]`(2), `shadow-[inset_...]`(3), `bg-[conic-gradient(...)]`(1), `text-[11px]`, `text-[9px]`
- 흡수하지 않는 근거: 브랜드 그린은 Spotify 소유고 테마에 따라 바뀌면 안 된다. 음영은 물성 표현이라 semantic 이름이 붙지 않는다.
- 부수 효과: 저장소에서 `motion-reduce`를 제대로 다루는 유일한 위젯이기도 하다. 예외 구역이 오히려 모범인 상태다 (`audit.md` §4-1).

## 2. 문서로만 존재하는 예외

코드 allowlist로 강제하지 않고 `apps/blog/AGENTS.md` 또는 `decision-log.md`에서 근거를 관리한다.

### Garden sidebar의 PARA 라벨 하드코딩

- `PARA_CATEGORIES` / `PARA_LABELS`의 Projects / Areas / Resources / Archives는 번역하지 않고 영어로 둔다.
- 이유: PARA는 고유명사 체계다. 번역하면 원 출처와의 연결이 끊긴다.
- 조건: 이 정책을 바꾸려면 먼저 문서를 고친다.

### karaoke의 product-specific radius

- `apps/karaoke/src/index.css`는 공유 ui의 `--radius: 0.625rem`을 `0.25rem`으로 재정의하고, 주요 control과 가사 표면은 `rounded-none`을 사용한다.
- 이유: 활성 가사의 수평 시간선에서 시작한 선형 모티브를 divider와 각진 control로 확장해, 편집 도구·콘솔 같은 product-specific 시각 언어를 유지한다.
- 경계: `@mumak/ui`의 component 구현·동작 기반은 계속 공유하고 접근성 요구사항은 공통 원칙으로 다룬다. 각진 형태가 전자책 같은 읽기 경험을 만든다는 검증되지 않은 효익은 이 예외의 근거가 아니다.
- 재평가 조건: karaoke가 향후 여러 제품을 포괄하는 wannysim 브랜드 시스템에 편입될 때 전체 시각 언어 기준으로 다시 판단한다. 자세한 결정은 `decision-log.md` D-008.

### blog / garden의 의도된 비대칭

`AGENTS.md` "UI / 디자인 Contract"가 근거를 적어 둔 것들. 시스템이 "통일"하려 들면 안 되는 지점이다.

| 차이                                          | 이유                                                 |
| --------------------------------------------- | ---------------------------------------------------- |
| `NextReading`이 blog에만 있다                 | garden은 노트 그래프가 같은 역할을 한다              |
| garden index에서 PARA overview가 nav보다 위   | garden의 1순위 결정이 PARA 분류라서                  |
| `GardenNav`가 0건 status 세그먼트를 감춘다    | 빈 목록으로만 이어지는 항목에 nav 자리를 주지 않는다 |
| `/garden/category/[key]`에 활성 세그먼트 없음 | nav의 축은 status인데 그 화면의 축은 category라서    |
| 성장 단계 배지를 홈에 노출하지 않는다         | evergreen이 0건이라 없는 편집 관행을 광고하게 된다   |

## 3. 시각화 · 생성 이미지

토큰 규율의 대상이 아닌 표면.

| 대상            | 위치                  | 이유                                                       |
| --------------- | --------------------- | ---------------------------------------------------------- |
| 그래프 뷰       | `src/features/graph/` | WebGL 캔버스. CSS token이 닿지 않고 색이 데이터 인코딩이다 |
| OG 이미지       | `src/shared/lib/og/`  | Satori 렌더. CSS 변수를 못 읽어 값을 직접 넣어야 한다      |
| 코드 하이라이트 | `app/prism.css`       | GitHub 테마 색 약 30개가 raw hex (아래 참조)               |

### `prism.css`가 예외인지 부채인지

`validate:design`은 `src/**`의 `.ts(x)`만 스캔하므로 CSS 파일은 애초에 보지 않는다. 즉 이건 "허용된 예외"가 아니라 **검사 범위 밖**이다.

- 지금 판단: 구문 강조 색은 GitHub 테마를 따르는 편이 독자에게 익숙하고, semantic token 6개로 표현할 수 있는 축이 아니다. 예외로 인정한다.
- 단, `.highlight-line`의 `border-left: 4px solid var(--accent-foreground)`처럼 이미 token을 쓰는 부분이 있다. 여기까지는 token을 유지한다.
- 재평가 조건: 다크 모드 코드블록 대비 불만이 나오면 그때 token화를 검토한다.

## 4. 예외가 아니라 아직 안 고친 것

여기 있는 항목은 "예외"로 방치하면 안 된다. 갈 곳이 정해져 있다.

| 항목                                               | 실제 정체               | 갈 곳    |
| -------------------------------------------------- | ----------------------- | -------- |
| light `--ring` 2.82:1                              | WCAG 2.1 SC 1.4.11 미달 | 단계 1   |
| 본문 표면에 `motion-reduce` 없음                   | 반응 축소 미대응        | 단계 1-2 |
| `note-card` → `post-card/ui/post-tags` 깊은 import | FSD 규칙 위반           | 단계 2   |
| sticky max-height의 `dvh`/`svh`/`vh` 혼용          | 근거 없는 3가지 답      | 단계 2   |
| `min-h-[50vh]` 3곳 복제                            | 미추출 recipe           | 단계 2   |
| `SwitcherDropdown` 커버리지 33.33%                 | 테스트 공백             | 단계 2   |
| `AGENTS.md`가 axe를 "미도입"이라고 적음            | 문서 지연               | 이 PR    |

## 5. 이전 `plan.md`에서 넘어온 보류 항목

2026-06-12 개선 과제 목록에서 완료되지 않고 남은 3개. 새 계획과의 관계를 명시해 이력이 끊기지 않게 한다.

| 항목 | 내용                                  | 처리                                                             |
| ---- | ------------------------------------- | ---------------------------------------------------------------- |
| A-6  | blog/garden tags 페이지 골격 템플릿화 | 단계 2의 `ContentSegmentNav` / `PageHeader` 계약 작업에서 재평가 |
| C-5  | `cacheComponents`(PPR) 재평가         | 이 계획 밖. Next 메이저 업그레이드 시 체크 항목으로 유지         |
| C-6  | View Transitions 등 UX 폴리시         | 단계 1-2의 motion token 작업에 흡수 검토                         |

A-6은 당시에도 "primitive 공유가 이미 잘 되어 있어 효용이 낮으면 보류 가능"으로 적혀 있었다. 단계 2에서 실제 반복 비용을 다시 재고, 근거가 없으면 정식으로 기각하고 이 표에서 지운다.
