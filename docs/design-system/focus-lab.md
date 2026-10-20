# 포커스 비교 실습

> 현재 공통 계약과 제품 적용·미이전·검증 범위는 [인터랙션 계약](./interaction-contracts.md)과 [지원 현황](./support-matrix.md#7-인터랙션-적용-현황)을 참조한다. 아래 실습 결과는 당시 범위의 증거다.

2026-10-15. Design Engineer 학습 재개의 첫 실습. 사진전 중심 홈 개편은 보류한다.

2026-10-20 후속 D-017에서 공유 컨트롤·복합 입력·Blog 트리/skip link·quant의 포커스 override로 이전 범위를 확대했다. 아래 최초 실습과 마지막 후속 검증 기록을 구분한다.

## 문제와 판단

사용자는 Tab으로 이동할 때 포커스의 색과 디자인이 매번 달라지면 현재 위치를 다시 찾아야 한다고 설명했다. 같은 시각적 단서를 따라갈 수 있어야 한다는 것이 비교 기준이다. D-010의 공통 기본 표시와 근거 있는 예외 계약을 출발점으로 삼는다.

## 비교 범위

| 항목             | A — 현재                                    | B — 검토용 후보                                     |
| ---------------- | ------------------------------------------- | --------------------------------------------------- |
| 구현             | 실제 `Button`, `ContentCard`, locale `Link` | 같은 컴포넌트에 story 전용 CSS 적용                 |
| 버튼             | 반투명 3px ring                             | 불투명 2px outline, offset 2px                      |
| 카드 제목 포커스 | 카드 전체 2px ring                          | 카드 전체 2px outline, offset 2px                   |
| 태그             | 전역 기본 outline                           | 공통 후보와 같은 outline                            |
| 포커스 색        | 현재 `--ring`                               | `--accent-foreground`를 후보의 `--ring`으로만 alias |

2026-10-15 사용자가 B를 선택한 뒤, 서로 다른 역할의 조기 공통화를 피하기 위해 독립 `--ring` 유지를 선택했다(D-011). 위 표는 최초 비교 당시의 구성이다. 이후 공통 token과 Button·ContentCard에 B를 적용했다. 현재 B는 제품 구현을 직접 사용하고 A만 이전 모습을 재현한다. 아직 배포하지 않았다. 색과 형태를 함께 비교했으므로 어떤 변수가 효과를 냈는지 개별적으로 입증하지 않는다.

### 적용한 계약

- `--ring`: light `oklch(0.45 0.15 45)`, dark `oklch(0.85 0.12 50)`. `--accent-foreground`와 현재 값만 같고 참조 관계는 없다.
- 공통 foundation: 불투명 2px solid outline, offset 2px. Button은 기본·destructive·asChild 모두 이 규칙을 사용한다. `aria-invalid` 오류 표시는 유지한다.
- ContentCard: 제목 포커스를 카드 표면으로 표시하고, 태그에 이동하면 개별 태그 링크를 표시한다.
- 범위 밖: 다른 component의 자체 focus override, `--sidebar-ring`, karaoke/quant의 제품별 `--ring`, reduced-motion. 사이트 전체 포커스를 마이그레이션한 것으로 보지 않는다.

## 실행

```bash
pnpm --filter blog storybook
pnpm --filter blog test:focus
pnpm --filter blog build-storybook
```

- 개발 화면: <http://127.0.0.1:6006/iframe.html?id=learning-focus-comparison--compare&viewMode=story>
- Storybook 관리자: <http://127.0.0.1:6006/?path=/story/learning-focus-comparison--compare>. Language 도구로 ko/en, Theme 도구로 Light/Dark를 바꾼다. 별도 테마 스토리와 실습 안의 테마 선택기는 전역 툴바로 통합했다(D-013).
- 테스트는 별도 6007 포트에서 자체 Storybook 서버를 실행한다. 블로그 E2E의 3002 포트와 분리한다.
- `apps/blog/stories/focus-comparison.css`는 A의 이전 표현만 재현한다. B에는 override가 없으며 공통 token·foundation·Button·ContentCard를 직접 사용한다.
- 링크는 키보드로 활성화할 수 있지만 실습을 벗어나지 않게 이동을 막고 상태 메시지를 표시한다. 실제 라우팅 검증은 이 실습의 대상이 아니다.
- `stories/`와 `.storybook/`은 제품 라우트가 아니며, 정적 결과 `storybook-static/`은 Git에서 제외한다. 별도 배포나 CI job을 추가하지 않는다.

## 측정과 한계

Chromium에서 실제 Tab 이동 후 CSS transition이 끝난 색을 canvas 픽셀로 읽었다. 후보 버튼 외곽선과 주변 배경의 대비는 다음과 같다.

| 테마  | 기본 배경 | muted 배경 |
| ----- | --------- | ---------- |
| light | 7.92:1    | 7.27:1     |
| dark  | 11.58:1   | 8.85:1     |

이 값으로 독립 `--ring`을 정의해 기본 배경 대비 결함을 수정했다. 다른 component의 반투명 자체 ring과 sidebar token까지 해결했다는 뜻은 아니다. 기존 `transition-all` 때문에 포커스 직후에는 두께·간격·색이 중간값일 수 있다. 자동 검증은 실제 전환 종료를 기다리며, 사람이 빠르게 Tab을 누를 때의 추적 용이성은 별도로 관찰한다. reduced-motion 지원을 이번 작업에서 완료한 것으로 취급하지 않는다.

Storybook 테스트는 ko/en × light/dark에서 두 배경을 비교하고, Tab/Shift+Tab 순서, disabled 건너뛰기, 제품 표시의 색·두께·간격·대비, 강조 텍스트 색 변경과의 독립성, 링크 실행 후 화면 유지, 모바일 가로 overflow를 확인한다. 별도 fixture는 Button 6개 variant와 aria-invalid·asChild를 검증한다. 제품 E2E는 Blog/Garden의 헤더 버튼·카드·태그에서 테마와 화면 크기별 포커스 이동·대비·가로 여유를 확인한다. 접근성 addon은 관찰용 `todo`이며 가시성 보증으로 사용하지 않는다. `validate:design`은 `src/`만 검사하므로 Storybook 파일은 별도 리뷰한다.

## 다음 학습

이번 검증: blog 단위 테스트 111 suites / 1,080 tests, Storybook 포커스 테스트 6개, 공유 UI 소비 웹 앱 7개의 타입 검사·빌드, Storybook 빌드가 통과했다. blog·ui lint는 기존 파일의 경고가 남는다. 제품 E2E는 focus·a11y·navigation 범위에서 Chromium·Firefox·WebKit 합계 139개 통과, 기존 WebKit navigation 검사 2개 skip이다. 전체 E2E 스위트를 실행한 것은 아니다. 실습 axe 스캔의 light 저장 버튼 글자 대비 3.33:1 결함은 이번 포커스 변경과 별개로 남아 있다.

macOS WebKit의 기본 Tab 탐색은 버튼·링크를 건너뛰므로 새 포커스 검사는 해당 환경에서만 Option+Tab(`Alt+Tab`)을 사용한다. [Safari 키보드 탐색 문서](https://support.apple.com/guide/safari/cpsh003/mac)에 따른 처리이며, 실제 브라우저에서 모든 대상의 `:focus-visible`을 확인했다. OS·브라우저 설정은 변경하지 않았다.

- B 선택·독립 token·제품 코드 적용을 마쳤다. 역할별 변경 이유에 따른 독립 유지 근거는 D-011에 기록했다.
- 사용자의 Storybook 구축 제안에 따라 시작·규칙·버튼·카드 [실습 공간](./storybook.md)으로 확장했다(D-012). Figma Variables·상태 대응표는 후속 보류한다.
- 다른 component의 자체 표시·제품별 theme·reduced-motion은 후속 범위에서 검토한다.

도구 구성은 [Storybook Next.js Vite 문서](https://storybook.js.org/docs/get-started/frameworks/nextjs-vite)와 [접근성 addon 문서](https://storybook.js.org/docs/writing-tests/accessibility-testing)를 확인했다. 설치는 Storybook 10.6.2 기준이다. 전이 의존성 `tsconfck@3.1.6`의 TypeScript peer 범위가 `^5.0.0`이라 저장소의 TypeScript 7.0.2와 경고가 남는다. 실제 타입 검사와 Storybook 실행·빌드 결과를 별도로 확인한다.

## 후속 공통 이전 — D-017

2026-10-20. 사용자가 공유 컨트롤까지 포커스 통일을 요청했다. 전역과 복합 표면이 같은 `focus-outline` utility를 사용하도록 정리하고, 일반 컨트롤의 자체 ring override를 제거했다. Blog 트리·skip link와 quant 차트·알림 닫기도 같은 기반을 사용한다. Garden 트리는 스크롤 경계에 4px 여유를 확보했다.

InputGroup·Command 검색·Combobox chips·OTP·ContentCard는 조작을 대표하는 표면에 표시한다. Menubar 트리거는 공통 outline, 열린 메뉴의 활성 항목은 기존 배경 표시를 사용한다. 오류 ring과 제품별 token 값은 유지한다. 전체 이전 목록과 검증하지 않은 배치는 [지원 현황](./support-matrix.md#7-인터랙션-적용-현황)에 둔다.

`Components / Focus contract / Controls`에서 실제 공유 구현을 관찰한다. 기본 컨트롤과 복합 입력, 오류·disabled 상태, 메뉴 열기·닫기, ko/en·Light/Dark를 함께 확인할 수 있다.

후속 검증:

- admin·Blog·quant·karaoke·mumak-next·mumak-react의 타입·lint·format·단위·빌드 검증. quant Python 검사는 시스템 Python 3.9가 `dataclass(slots=True)`를 지원하지 않아 설치된 Python 3.12로 실행해 57개 통과했다. 머신 설정은 변경하지 않았다.
- Blog focus·garden·a11y·navigation·theme E2E: 기존 202개 통과·기존 2개 skip, 신규 트리·skip link 검사 12개는 locator 수정 후 별도 재실행에서 통과. Chromium·Firefox·WebKit과 모바일/데스크톱 Light/Dark를 포함한다. 전체 Blog E2E 실행은 아니다.
- Command 수정 후 Blog를 다시 빌드하고 실제 그래프 필터의 키보드 열기·입력 그룹 outline·4px 외곽 여유·검색·Escape 포커스 복귀를 3브라우저에서 확인했다(3개 통과).
- admin E2E 33개, quant E2E 66개 통과. 각 앱의 Chromium·Firefox·WebKit 회귀를 확인했다.
- Storybook 기존 69개 통과. 신규 포커스 검사 8개는 키보드 타이밍 수정 후 별도 재실행에서 통과했다. Radix의 비동기 Radio 포커스 이동은 keydown→선택 확인→keyup으로 검증한다. 아주 짧은 key tap의 동작까지 확인한 결과는 아니다.
- 정적 Storybook build와 `validate:design` 통과. 실제 스크린리더 발화, 모든 설치 컴포넌트의 소비 배치·잘림, 메뉴 활성 행의 대비를 전수 검증한 것은 아니다.
- LAN 개발 서버의 실제 Storybook manager에서 Checkbox를 조작하고 Light 갤러리·Dark 복합 입력·모바일 loading C를 캡처해 육안 확인했다. 페이지 오류 0건이며 C의 대기 전후 너비는 동일했다.

검토 과정에서 Command 입력의 숨긴 outline에 대체 표시가 없고 Menubar 트리거도 같은 문제가 있음을 발견했다. 두 곳을 수정하고 새 갤러리의 표면·키보드 검증에 포함했다. 초기 D-011 기록의 “다른 component는 범위 밖”은 당시 범위이며 현재 상태는 D-017을 따른다.
