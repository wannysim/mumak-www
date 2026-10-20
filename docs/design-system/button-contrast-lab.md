# 버튼 상태와 글자 대비 비교

> 현재 공통 계약과 제품 적용·미이전·검증 범위는 [인터랙션 계약](./interaction-contracts.md)과 [지원 현황](./support-matrix.md#7-인터랙션-적용-현황)을 참조한다. 아래 실습 결과는 당시 범위의 증거다.

2026-10-16. **D 기본색 + E hover 제품 반영(D-014).** 비교·누락 점검 후 사용자가 반영을 승인했다. 아래 비교·검증 이력의 “미적용”은 제품 반영 전 시점의 기록이다. PR #633의 병합 커밋 `bb64e38`에서 `feature/button-contrast-lab`으로 분기했다.

[Storybook 비교 화면](http://127.0.0.1:6006/?path=/story/learning-button-contrast--compare&globals=locale:ko;theme:light). 실행은 `pnpm --filter blog storybook`.

## 비교 범위

| 안            | Light 기본 배경       | Light 글자                  | Light hover 배경              |
| ------------- | --------------------- | --------------------------- | ----------------------------- |
| A · 적용 전   | 제품 `--primary`      | 제품 `--primary-foreground` | 기존 primary의 80% alpha      |
| B · 배경 조정 | `oklch(0.56 0.18 45)` | 제품 `--primary-foreground` | `oklch(0.52 0.18 45)`, 불투명 |
| C · 글자 조정 | 제품 `--primary`      | `oklch(0.15 0.02 45)`       | 기존 primary의 80% alpha      |

모두 실제 `@mumak/ui/components/button`을 사용한다. A·B·C의 당시 색은 Storybook의 `data-button-contrast` 범위에서 버튼 역할 token을 덮어써 보존한다. Dark에서는 세 안 모두 제품 값을 상속한다. C의 글자 값이 현재 Dark 글자 값과 같아도 역할을 공통화한 결정이 아니다. `--ring`·`--accent-foreground`도 변경하지 않는다.

버튼 문구·크기·굵기·포커스·disabled 처리는 동일하다. B는 배경의 기본색과 hover 방식을 함께 바꾼 후보이므로 단일 변수 실험은 아니다. 실제 제품에 적용한 token 범위와 다른 소비자 영향은 아래 제품 반영 기록에 둔다.

## 측정값

2026-10-16 macOS headless Chromium 148.0.7778.96, 1440×1100, ko, 전환이 끝난 상태. 글자/버튼 배경의 WCAG 대비다. 기본 14px 글자에 **4.5:1**을 적용한다. Disabled는 요구 대상에서 제외하여 참고값으로만 적는다. 근거: [WCAG 2.2 SC 1.4.3 해설](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

| Theme / 바탕 | 안    | 기본·키보드 focus | Hover·마우스 pressed | Disabled (참고) |
| ------------ | ----- | ----------------: | -------------------: | --------------: |
| Light / 기본 | A     |              3.34 |                 2.65 |            1.86 |
| Light / 기본 | B     |              4.79 |                 5.65 |            2.13 |
| Light / 기본 | C     |              5.67 |                 7.14 |            1.99 |
| Light / 보조 | A     |              3.34 |                 2.71 |            1.88 |
| Light / 보조 | B     |              4.79 |                 5.65 |            2.16 |
| Light / 보조 | C     |              5.67 |                 6.98 |            2.02 |
| Dark / 기본  | A·B·C |              8.19 |                 5.63 |            2.78 |
| Dark / 보조  | A·B·C |              8.19 |                 6.06 |            3.08 |

모든 수치는 `:1`. 과거 기본값 3.33:1은 이전 측정 기록이며, 이번 Canvas 측정은 3.34:1이다. 둘 다 기준 미달이다. 소수 둘째 자리 수치보다 원시값과 기준 충족 여부로 판단한다.

- `getComputedStyle`의 글자색·배경색을 1px sRGB Canvas로 변환한다. 8-bit 색 변환·합성의 양자화가 포함되므로 소수점 수준의 차이가 날 수 있다.
- 버튼 배경의 alpha와 disabled의 group opacity를 단색 바탕 위에 합성한다. 글자 가장자리의 안티앨리어싱 픽셀을 표본으로 삼지 않는다.
- sRGB를 선형화한 상대휘도로 `(L밝음 + 0.05) / (L어두움 + 0.05)`를 계산한다. 화면은 소수 둘째 자리로 반올림하되 4.5 판정에는 원시값을 쓴다.
- 실제 pointer·keyboard 이벤트와 CSS transition에 따라 재측정한다. 전환 도중에는 중간색 수치가 보일 수 있다.
- 이 helper는 실습의 불투명 단색 바탕과 텍스트 버튼 전용이다. 이미지·gradient·중첩된 부모 opacity·다른 소비 화면·모든 브라우저/디스플레이를 검증한 것은 아니다.
- 이 표는 글자 대비다. 포커스 outline 대비는 별도 브라우저 검사로 확인한다.

## 관찰할 상태

1. 각 버튼의 기본 글자를 읽고 주황색의 강조 정도를 비교한다.
2. 마우스를 올린 뒤 누른 채 유지한다. 현재 pressed 표현은 1px 아래 이동이며 별도 pressed 색은 없다. pointer pressed에는 hover 색도 함께 적용된다.
3. Tab으로 이동하고 Space·Enter로 실행한다. hover가 없는 키보드 focus·Space pressed의 글자색은 기본 상태와 같다.
4. disabled가 실행되지 않고 Tab 순서에서 빠지는지 확인한다. 숫자는 참고하고 활성 버튼과의 구분을 관찰한다.
5. 보조 바탕과 Dark로 전환한다. 테마를 바꿔도 실행 횟수와 바탕 선택은 유지된다.

Loading·invalid·다른 variant의 대비 수정은 이번 비교 범위 밖이다. 기존 Playground에서는 variant·invalid를 계속 관찰할 수 있다.

## 제품 반영 전 실습 검증과 제한

- blog `check-types → lint → format:check → test:ci`: 통과. 단위 테스트 111 suites / 1,080개. 기존 lint 경고 9개와 기존 Jest jsdom navigation 로그는 남아 있다.
- `validate:design`: 160개 파일 통과. Storybook 후보의 시각 검토를 이 정적 검사로 대체하지 않는다.
- `test:storybook`: 최초 비교 25개 통과. D 후속 비교 추가 후 34개, E·터치 회귀 포함 최종 44개 통과. 실제 hover·pointer pressed·Space pressed·focus, Enter/Space 실행, disabled Tab 제외·합성 참고값, Light/Dark × 기본/보조 바탕, 테마 전환 시 상태 유지, 다른 스토리로의 색 누출을 확인한다.
- ko/en × Light/Dark의 390px 모바일 레이아웃과 axe 검사 통과. 의도적으로 결함을 보여주는 A의 활성 버튼만 axe 대상에서 제외하고 A의 대비 미달은 별도 수치로 확인한다.
- `build-storybook`: 통과. 빌드의 module directive 경고는 남아 있다.
- 제품 컴포넌트·라우트는 변경하지 않아 Next 제품 build·전체 제품 E2E는 이번에 실행하지 않았다. 정적 Storybook build와 Storybook 브라우저 테스트를 실행했다.

## 첫 관찰 이후의 D 비교

사용자 관찰:

- A는 밝지만 버튼만 보면 크게 방해되지는 않는다.
- B는 구분이 잘 되지만 상대적으로 어두운 인상이 아쉽다.
- C는 Dark에서 어두운 글자의 가시성이 좋지 않게 느껴졌다.

조건 확인: 이번 Dark 화면은 A·B·C가 모두 동일한 제품 색이다. 따라서 세 번째 관찰을 C만의 수치상 결함으로 해석하지 않는다. Light A는 글자 대비 AA 미달, B는 충족함을 설명한 뒤 사용자가 **“A의 밝은 인상을 살리면서 B의 가독성을 확보하고 싶다”**는 방향에 동의했다. 특정 안의 선택이나 제품 적용 승인은 아니다.

[후속 비교 · Refine](http://127.0.0.1:6006/?path=/story/learning-button-contrast--refine&globals=locale:ko;theme:light)에 A·B·D를 나란히 둔다. 기존 A·B·C는 Compare에 보존한다.

| D · 밝기 조정                    | 값                            |
| -------------------------------- | ----------------------------- |
| Light 기본 배경                  | `oklch(0.58 0.18 45)`         |
| Light 글자                       | `oklch(1 0 0)`                |
| Light hover 배경                 | `oklch(0.56 0.18 45)`, 불투명 |
| 기본·키보드 focus 대비           | 4.62:1                        |
| Hover·마우스 pressed 대비        | 5.00:1                        |
| Disabled 참고값 · 기본/보조 바탕 | 2.12 / 2.15:1                 |

같은 환경·방법으로 측정했다. D의 활성 상태는 불투명하므로 기본/보조 바탕에서 값이 같다. Dark는 기존 제품 값을 그대로 사용한다. 배경의 밝기뿐 아니라 글자를 기존의 거의 흰색에서 순백색으로 바꾼 실험이다.

D는 B보다 조금 밝지만 A만큼 밝지는 않다. 기본 대비 4.62:1은 B의 4.79:1보다 기준까지의 여유가 작다. **밝은 인상이 얼마나 회복되는지와 대비 여유를 함께 비교**하며, D를 권장안이나 최종안으로 확정하지 않는다. 밝은 글자를 유지하면서 배경을 밝힐수록 글자 대비가 낮아지는 제약은 남는다.

후속 검증은 Compare·Refine 양쪽에 같은 상태·테마·모바일 검사를 적용한다. 전체 Storybook 테스트는 34개다.

## D 선택 후 hover 보완과 누락 점검

사용자는 “D 좋네!”라고 답한 뒤 Light hover가 잘 보이지 않는다고 지적했다. D의 기본색 선택은 유지하고 hover 비교를 다시 열었다. [Hover 실습](http://127.0.0.1:6006/?path=/story/learning-button-contrast--hover&globals=locale:ko;theme:light)에 D와 E를 나란히 둔다. E는 기본 배경·흰 글자·150ms 전환을 그대로 두고 hover 배경만 `oklch(0.52 0.18 45)`로 바꾼다. 밝기 L 변화 폭은 D의 0.02에서 E의 0.06으로 커진다.

- E 글자 대비: 기본·키보드 focus·Space pressed **4.62:1**, hover·마우스 pressed **5.90:1**. 기본/보조 바탕에서 동일하다.
- E disabled 참고 대비: 기본 2.12:1, 보조 2.15:1. Dark는 기존 제품 색을 유지한다.
- 사용자 관찰: “E는 확실히 그 부분도 차이 나네.” 이후 추가 누락 점검을 요청했다. pressed 등의 후속 선택까지 완료된 것으로 해석하지 않는다.

### 실제로 발견한 결함

Chromium 터치 에뮬레이션(`hasTouch`, 390×844)에서 E를 탭하고 떼어도 hover 색과 “Hover · 마우스 올림” 라벨이 남았다. 제품의 Tailwind hover utility는 hover 가능 여부를 제한하지만 실습용 후보 CSS에는 그 조건이 빠져 있었다.

- 후보 hover CSS를 `@media (hover: hover)`로 제한한다.
- 상태 라벨도 같은 조건을 확인한다. 터치의 sticky `:hover`만으로 hover 상태라 표시하지 않는다.
- 수정 전 터치 회귀 테스트 Light/Dark 2개가 의도대로 실패했다(`/tmp/button-hover-touch-red.log`). 수정 후 같은 검사 2개가 통과했다(`/tmp/button-hover-touch-green.log`).

### 상태별 확인과 남은 판단

| 항목            | 관찰                                                            | 상태                                        |
| --------------- | --------------------------------------------------------------- | ------------------------------------------- |
| 키보드 focus    | 공통 2px outline, Tab 도달·Space/Enter 실행                     | 확인                                        |
| Pointer pressed | hover 색 + 1px 아래 이동                                        | 기존 동작 유지, 충분한 피드백인지 판단 필요 |
| Space pressed   | 기본색 + 1px 아래 이동                                          | 기존 동작 유지, 색 추가는 미선택            |
| Disabled        | 실행 불가·Tab 제외, opacity 50%                                 | 동작 확인, 대비 수치는 참고                 |
| Reduced motion  | no-preference/reduce 모두 `transition: all 0.15s`               | 기존 미대응, 이번 색 비교로 해결하지 않음   |
| 터치 크기       | 현재 저장 버튼 약 70×32 CSS px                                  | 실기기 터치 편의성은 미검증                 |
| 제품 적용       | 공유 `--primary`는 버튼 외에도 사용, karaoke/quant는 별도 theme | 버튼 적용 범위 결정과 소비 화면 검증 필요   |

E 후속 검증: `check-types → lint → format:check` 통과(기존 lint 경고 9개), `test:storybook` **44 passed**, `test:ci` **111 suites / 1,080 tests passed**, `build-storybook`·`validate:design` 통과. 단위 테스트 최종 로그는 `/tmp/button-hover-jest.log`다. Storybook 최종 로그는 `/tmp/button-hover-storybook.log`, 빌드는 `/tmp/button-hover-build.log`다. Hover 스토리 자체의 ko/en × Light/Dark 모바일 axe 검사에는 후보 버튼 제외가 없다. 기존 Compare/Refine의 A만 알려진 미달 예외로 남는다.

글자 대비가 기준을 넘는 것과 hover/pressed가 눈에 잘 구분되는 것은 다른 평가다. E의 개선은 사용자 한 명의 관찰이며 모든 사용자·입력 방식의 사용성 개선으로 일반화하지 않는다. 브라우저 검증은 Chromium 에뮬레이션이며 실기기·모든 브라우저 검증은 아니다.

## 제품 반영 전 판단 기록

- 기본색: D 선택.
- Hover: D의 변화 폭 부족을 확인하고 E에서 차이가 보인다는 사용자 관찰을 얻음.
- Pressed·reduced-motion: 위 미결정/미대응 항목 유지.
- 제품 적용: 미실시. 제품 파일 변경 전 hover 재검토로 돌아왔다.
- 재검토 조건: 기본 대비가 4.5 미만으로 떨어지거나 실제 소비 화면·입력 방식에서 상태가 구분되지 않으면 다시 비교한다.

다음 액션의 정본은 [NEXT.md](./NEXT.md)다.

## 제품 반영

사용자는 E hover 차이와 누락 점검을 확인하고, Space와 Enter의 네이티브 동작 차이를 이해한 뒤 “좋아. 이거 반영하자”로 제품 적용을 승인했다.

| 역할                  | Light                 | Dark                        |
| --------------------- | --------------------- | --------------------------- |
| `--button-background` | `oklch(0.58 0.18 45)` | `oklch(0.75 0.18 50)`       |
| `--button-foreground` | `oklch(1 0 0)`        | `oklch(0.15 0.02 45)`       |
| `--button-hover`      | `oklch(0.52 0.18 45)` | `oklch(0.75 0.18 50 / 80%)` |

- default variant에만 새 색을 연결한다. 브랜드 primary·링크·배지·다른 variant 색은 바꾸지 않는다.
- karaoke/quant는 기존 Light `#263cff` / `#f8f9ff`, Dark `#8390ff` / `#111423`, hover alpha 80%를 독립 버튼 token에 명시한다. quant의 OS Dark 첫 페인트 블록도 포함한다.
- Button 기반에 `motion-reduce:transition-none`을 추가한다. reduce에서는 색과 pressed 1px 이동이 즉시 반영되고, no-preference에서는 기존 150ms 전환을 유지한다.
- Space는 눌린 동안 active를 유지하고 keyup에 한 번 실행된다. Chromium의 Enter는 keydown마다 실행되어 길게 누르면 반복 입력으로 실행 횟수가 늘 수 있다. 공유 Button에서 네이티브 키 처리를 바꾸지 않는다. 비동기 작업의 중복 요청 방지는 소비 화면 책임이다.
- Compare의 A는 “적용 전”으로 이름을 바꾸고 당시 색을 보존한다. 제품 Playground에는 실제 반영된 Button을 표시한다. 새 색으로 바뀐 제품 기대값만 갱신하고 과거 후보의 측정 기대값은 유지한다.
- 새 제품 회귀 검사의 적용 전 실행에서 색상/hover/터치/reduced-motion 4개가 실패했다. 함께 발견한 테스트의 포커스 이동 순서 오류는 focus 후 Space로 키보드 입력을 시작하도록 수정했다. 원본 로그: `/tmp/button-product-red.log`.

Reduced-motion 적용 후 기존 터치 검사 2개가 “실제 :active는 해제됐으나 실습 라벨이 Pressed에 남음”을 잡았다. Chromium이 터치 피드백을 위해 약 150ms active를 유지한 뒤 해제할 때, 전환을 꺼 놓으면 transitionend가 없기 때문이다. 측정 loop를 animation뿐 아니라 `:active` 동안에도 이어가도록 고쳤다. 테스트를 완화하지 않고 같은 Light/Dark 터치 검사를 다시 실행한다. 적용 전 실패 로그는 `/tmp/button-product-storybook-final.log`, 수정 후 전체 검사는 `/tmp/button-product-storybook-green.log`다.

### 제품 검증 결과

| 범위            | 명령·관찰                                                                     | 결과                                                                    |
| --------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 정적 검사       | blog·admin·karaoke·quant `check-types → lint → format:check`, ui lint/format  | 통과, 기존 lint 경고 유지                                               |
| Storybook       | `pnpm --filter blog test:storybook --workers=1`                               | 49 passed, `/tmp/button-product-storybook-green.log`                    |
| 제품 build      | blog·admin·karaoke·quant build                                                | 통과                                                                    |
| Blog 단위       | `pnpm --filter blog test:ci --maxWorkers=2`                                   | 111 suites / 1,080 passed, `/tmp/button-product-jest-final.log`         |
| 소비 앱 단위    | admin / karaoke / quant (JS)                                                  | 156 / 349 / 121 passed                                                  |
| quant Python    | 기존 uv Python 3.12에서 동일 unittest 실행                                    | 57 passed, `/tmp/button-product-consumers-quant-python312.log`          |
| Storybook build | `pnpm --filter blog build-storybook`                                          | 통과, `/tmp/button-product-storybook-build-final.log`                   |
| 디자인 검사     | `pnpm --filter blog validate:design`                                          | 160개 파일 통과                                                         |
| Blog E2E        | `pnpm --filter blog test:e2e e2e/focus.spec.ts e2e/theme.spec.ts --workers=1` | 15 passed, `/tmp/button-product-blog-e2e.log`                           |
| 소비 앱 E2E     | admin / karaoke / quant                                                       | 6 / 57 / 22 passed                                                      |
| 실제 제품색     | Product Playground·admin 로그인                                               | Light 기본 4.6197:1, hover 5.8990:1; Dark 기본 8.1885:1, hover 5.6336:1 |

측정 원본은 `/tmp/button-product-measurements.json`, 동일 1000×700 조건의 전후 스크린샷은 `/tmp/button-product-before-{light,dark}.png`와 `/tmp/button-product-after-{light,dark}.png`다. 제품색 측정은 Playground의 단색 바탕을 기준으로 한다. admin에서는 실제 CSS 색과 disabled를 별도로 관찰했다.

소비 앱 상세 로그는 `/tmp/button-product-consumers-*`에 둔다. karaoke 동의 버튼과 quant 로그인 버튼의 Light/Dark 파랑·hover alpha 보존, quant의 OS Dark 첫 페인트와 사용자 Light 전환도 브라우저로 확인했다.

quant의 기본 `python3`는 이 머신에서 3.9라 `dataclass(slots=True)` import가 실패했다. 이미 설치된 uv Python 3.12에서는 동일 57개가 통과했다. 기본 명령의 환경 문제는 남아 있으며 머신 설정이나 제품 코드를 바꾸지 않았다. lint에는 blog 9개·karaoke 10개·quant 4개의 기존 경고가 있고 admin Jest worker 종료 경고도 남는다.

최초 병렬 검증은 빌드·테스트 부하와 개발 서버 HMR이 겹쳐 timeout이 발생했다. Blog unit은 theme-switcher 1개만 timeout이었고 단독 3개 검사는 통과했으나, 부분 실행에 전체 coverage threshold가 적용되어 명령 자체는 실패했다. 이어 전체 `test:ci --maxWorkers=2`에서 111 suites / 1,080개와 coverage 기준이 모두 통과했다. Storybook 실행을 1 worker로 분리한 뒤, 남은 터치 라벨 결함을 수정해 49개가 모두 통과했다. 새로운 제품 테스트의 포커스 순서·실습 카운터 문구 기대값도 실제 Playground에 맞췄다. 기존 대비·터치 회귀 검사는 완화하지 않았다.

미검증 범위: Blog 전체 E2E 재실행, 모든 소비 앱의 전체 build/E2E, 실제 모바일 기기. karaoke E2E의 mobile WebKit을 제외한 이번 제품색·입력 측정은 Chromium 기준이다. 기본 대비는 기준을 넘지만 여유가 작고, 모든 UI 상태나 사이트 전체의 WCAG 준수를 증명하지 않는다.
