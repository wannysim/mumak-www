# Stickerbook 기술 조사

조사일: 2026-11-12. 웹 조사 네 갈래(페이지 넘김 물리, 렌더링 스택, 3D 위 글자 선명도, 스티커·WebAssembly)와 저장소 확인을 합친 기록이다. **구현 결정이 아니라 구현 전에 고려할 자료다.** 수치는 각 출처의 측정 조건을 따르며, 버전과 브라우저 지원은 구현 시점에 다시 확인한다. 컨셉은 [plan.md](./plan.md), 재개 순서는 [NEXT.md](./NEXT.md)를 따른다.

사용자는 오버스펙 기술 실험도 즐긴다. 그래서 이 문서는 **기본 경로**와 **재미 트랙**을 나눈다. 재미 트랙은 기본 경로를 깨지 않는 플래그나 실험으로 둔다.

## 한눈에

| 주제           | 기본 경로 (권장)                                                        | 재미 트랙                                                            | 보류·비추천                                   |
| -------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| 3D 엔진        | three `WebGLRenderer` r187, 최소 씬 약 107KB br                         | R3F 9.8.x                                                            | `three/webgpu`, R3F v10 alpha, OGL(유지 정체) |
| 닫힌 책 첫화면 | CSS로 그린 포스터 → WebGL 지연 로드 후 같은 포즈에서 교체               | -                                                                    | 첫 화면부터 WebGL                             |
| 페이지 글자    | HTML/CSS로 한 번 정의, 모든 브라우저 공통으로 foreignObject 사전 래스터 | HTML-in-Canvas(Chrome 157+), 공통 경로와 결과가 같다고 확인된 경우만 | SDF/MSDF(troika), html2canvas                 |
| 곡면 넘김      | 반사 접힘 + 접힘선 정렬 원통을 정점 셰이더로                            | XPBD 종이 시뮬레이션(JS 먼저, 필요 시 Rust WASM)                     | 원뿔 모델 단독, WebGPU compute                |
| 스티커         | 페이지와 같은 원통 함수로 떼기, `gl_FrontFacing`으로 흰 뒷면            | thin-film 무지개 광택 + 기울기 센서                                  | CSS 광택(평면에서만 동작)                     |
| die-cut 테두리 | 빌드 타임에 sharp로 SDF 텍스처 굽기                                     | GPU Jump Flooding(런타임 업로드가 생기면)                            | `feMorphology`(모서리가 각짐)                 |
| WebAssembly    | 넣지 않음. JS + TypedArray                                              | Rust raw export + wasm-opt + SIMD, Vite 8 ESM                        | threads(COOP/COEP 필요)                       |
| 폴더블         | 화면 비율 대응이 기본. 모든 브라우저에서 같은 레이아웃 결과             | Viewport Segments로 책등을 힌지에 정확히 맞춤                        | -                                             |

## 권장 구조 (가설, α 기준)

아래 그림은 1장의 α(펼친 책은 항상 WebGL)를 가정한다. 2026-11-13부터 S1에서 α와 β를 같은 무게로 비교하므로, β가 선택되면 펼친 책은 쉬는 동안 DOM이고 넘김만 WebGL이 된다. 부록 시트 쪽을 따로 WebGL로 둘지는 S1에서 본다(1장).

```
첫 페인트: CSS로 그린 닫힌 책 포스터 (JS 거의 없음, 이미지 0개)
   │ idle 또는 hover 시 three 청크 import() → compileAsync → 텍스처 업로드
   ▼
WebGL 닫힌 책 (포스터와 같은 카메라 포즈에서 교체) ── 드래그: 회전
   │ 클릭 (이미 준비돼 있어 즉시 반응)
   ▼
표지 열림 → 펼친 책 (WebGL 캔버스 하나에 페이지·스티커·광택)
   ├─ 페이지 텍스처: HTML/CSS 페이지 → foreignObject 공통 경로 (실제 DPR 해상도)
   ├─ 넘김: 순수 TS fold 모델 → 정점 셰이더 원통
   ├─ 스티커 떼기: 같은 원통 함수
   └─ 접근성: 캔버스 위 투명 DOM 오버레이 (모든 브라우저 공통)
```

ryo.lu와 같은 수법이다. 첫 화면은 그릴 게 거의 없게 두고, 무거운 세계는 뒤에서 미리 준비해 클릭 즉시 연다.

## 0. 호환성 원칙 (2026-11-12 사용자 요구)

사용자는 여러 환경·디바이스·브라우저에서 **동일한 동작**을 매우 중요하게 본다. 이 원칙이 아래 모든 기술 선택보다 앞선다. 최신 API는 "그 브라우저에서만 더 좋은 경험"이 아니라 "결과가 같을 때만 쓰는 최적화"로 다룬다.

### "동일한 동작"의 정의

- **같아야 하는 것:** 닫힌 책 회전, 클릭 펼침, 드래그와 클릭 곡면 넘김, 스티커 떼기, 사진 보기, 부록 레코드 꺼내기. 동작 규칙(완주·복귀 판정, 속도), 렌더 경로, 글자 모양이 모든 대상 환경에서 같아야 한다.
- **달라도 되는 것:** 화면 크기와 비율에 따른 레이아웃 적응(폴더블 힌지 정렬 포함). 동작 차이가 아니라 같은 규칙의 다른 배치다.
- **입력 장치에서 오는 부가 효과:** 기울기 광택처럼 센서가 있어야 하는 효과는 센서가 없거나 권한이 없을 때 포인터·터치 위치로 같은 효과를 낸다. 핵심 동작이 센서에 의존하지 않는다.

### 기술 선택에 미치는 영향

| 기술                        | 지원 범위                                        | 판단                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebGL2                      | 97.3%, iOS Safari 포함                           | 유일한 기본 렌더 경로                                                                                                                                                                                                                                                           |
| WebGPU                      | 88.6%, Xclipse 폴더블 TBD                        | 쓰지 않는다                                                                                                                                                                                                                                                                     |
| HTML-in-Canvas              | Chrome 157만, iOS 불가                           | 기본 경로에서 제외. 브라우저마다 래스터 경로가 갈리면 Chrome과 Safari의 글자 모양이 달라질 수 있다. foreignObject를 공통 경로로 두고, S1에서 결과가 같다고 확인될 때만 성능·접근성 최적화로 선택한다                                                                            |
| foreignObject 사전 래스터   | 주요 브라우저 전부                               | 공통 경로. Safari 첫 로드 폰트 버그 우회를 실기기 iOS에서 반드시 확인한다                                                                                                                                                                                                       |
| Viewport Segments           | Chromium 계열만                                  | 레이아웃 적응이므로 허용. 미지원 브라우저의 폴더블에서도 화면 비율 기반 레이아웃이 같은 결과를 내야 한다                                                                                                                                                                        |
| DeviceOrientation           | 브라우저마다 권한 정책이 다름                    | 부가 효과로만. 포인터·터치로 같은 광택                                                                                                                                                                                                                                          |
| WASM SIMD                   | Baseline                                         | 허용                                                                                                                                                                                                                                                                            |
| WASM threads                | COOP/COEP 필요, `credentialless`는 Safari 미지원 | 쓰지 않는다                                                                                                                                                                                                                                                                     |
| `Memory.toResizableBuffer`  | Safari 26.2+                                     | 의존하지 않는다. 고정 크기 메모리                                                                                                                                                                                                                                               |
| detect-gpu 기반 저사양 경로 | -                                                | 다른 경험이 되므로 원칙과 충돌한다. 대체 경로는 WebGL2 컨텍스트를 만들 수 없는 환경(미지원 약 2.7%, 지원 브라우저의 생성 실패는 비율 미확인)으로 한정하고, 성능 차이는 같은 렌더 경로 안에서 격자 밀도·시뮬레이션 substep으로 흡수한다. 쉬는 상태 텍스처 해상도는 낮추지 않는다 |

### 구현 규칙

- **시간 기반 동작:** 화면 주사율(60·120Hz, iOS 저전력 모드 30fps)과 무관하게 같은 결과가 나오게 한다. 시뮬레이션은 고정 timestep, easing은 경과 시간 기준, 속도 임계는 px/ms로 잰다. 프레임 수 기준 로직을 쓰지 않는다.
- **입력 통일:** Pointer Events 하나로 마우스·터치·펜을 처리하고, 책 영역은 `touch-action: none`과 pointer capture를 쓴다. iOS Safari의 가장자리 스와이프 뒤로가기가 왼쪽 가장자리 드래그와 겹치지 않도록 책과 화면 가장자리 사이 여백을 둔다(실기기 확인 필요).
- **폰트 통일:** 시스템 폰트에 기대지 않고 같은 woff2를 자체 호스팅해 OS별 글자 폭 차이를 없앤다. 텍스처 경로는 서브픽셀 AA가 빠지므로 Windows ClearType과 macOS 회색조 차이가 오히려 줄어든다(추정, S1에서 확인).
- **동작 규칙은 순수 TS:** fold 모델·놓기 판정·스프링을 플랫폼 API 없는 순수 함수로 두고 고정 timestep으로 돌리면, 단위 테스트가 모든 환경에서 같은 동작을 보증하는 기준이 된다.

### 검증 매트릭스

- **자동 (CI):** 공용 Playwright 설정은 CI에서만 Chromium·Firefox·WebKit 데스크톱을 돌리고, 로컬은 Chromium만 돈다(`CI=1`로 전체 실행). 한계가 있다.
  - Playwright WebKit은 iOS Safari가 아니다.
  - headless 브라우저의 WebGL은 소프트웨어 렌더링일 수 있어서 성능 수치는 의미가 없다.
  - 화면 비교는 브라우저별 기준 이미지가 따로 필요하다.
- **실기기 (스파이크마다 필수):**
  - Apple: iPhone Safari(iOS 26+), iPad Safari, macOS Safari
  - Android: Snapdragon 기기 Chrome, Exynos/Xclipse 기기(Galaxy Flip 계열) Chrome과 Samsung Internet, Galaxy Fold 펼침·접힘
  - 데스크톱: Windows Chrome/Edge, Firefox
- 기기별 결과는 "확인한 기기·브라우저·버전"으로 기록하고, 확인하지 않은 환경을 지원한다고 쓰지 않는다.

## 1. 가장 큰 결정: 글자를 어디서 래스터하나

이전 실패의 본질은 정지 화면(DOM)과 넘김(Canvas 2D 텍스처)의 **래스터라이저와 해상도가 달랐던 것**이다([implementation.md](./implementation.md)). 곡면에서 원근 때문에 글자가 작아 보이는 건 물리적으로 정상이다. 고정해야 하는 건 래스터 소스와 해상도다.

조사 결과가 두 구조로 갈렸다.

|                  | α. 펼친 책은 항상 WebGL                              | β. 쉴 때 DOM, 넘길 때만 WebGL 오버레이                      |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| 권한 조사        | 글자 선명도, 스티커                                  | 페이지 넘김 (Mantine Book 방식)                             |
| DOM↔텍스처 교체  | 없음                                                 | 잡는 순간과 착지 순간                                       |
| 쉬는 상태 선명도 | 텍셀:픽셀 1:1이면 DOM에 가깝다. 서브픽셀 AA는 빠진다 | DOM 그대로라 최상                                           |
| 스티커 떼기·광택 | 같은 씬이라 자연스럽다                               | 떼기가 쉬는 상태에서 일어나므로 결국 WebGL 교체가 또 생긴다 |
| 위험             | 텍스처 품질 관리, Safari foreignObject 폰트 버그     | 교체 순간 튐 = 이전 실패의 재현                             |

**2026-11-13 변경:** 스티커가 사진 페이지에서 빠지고 부록 시트 한 페이지로 옮겨졌다. 쉬는 상태에서 떼기·광택이 일어나는 곳이 그 한 페이지뿐이라 아래 α 판단의 근거가 약해졌다. S1에서는 α와 β를 같은 무게로 비교하고, β라면 부록 시트 페이지만 따로 WebGL로 두는 안도 본다.

**판단 (2026-11-12, 위 11-13 변경으로 S1 진행 방식은 대체됨):** 스티커 떼기와 광택이 쉬는 상태에서 일어나므로 α를 기본 가설로 두었다. 11-13부터는 S1에서 α와 β를 둘 다 만들어 같은 무게로 비교한다. 이 비교는 스티커가 부록 시트 안에만 있다는 전제에 걸려 있다. 뗀 스티커가 다른 페이지로 옮겨질 수 있으면 쉬는 상태의 떼기·광택이 다시 모든 페이지로 퍼지므로, 그 결정([open-decisions.md](./open-decisions.md) G1)을 S1 전에 확인하거나 S1 결론을 조건부로 기록한다. 텍스처 소스는 0장의 호환성 원칙에 따라 모든 브라우저에서 같은 foreignObject 경로를 기본으로 한다. 쉬는 상태의 선명도가 DOM 대비 허용 범위인지는 S1에서 사용자가 직접 보고 판단한다. 어느 쪽이든 공통 원칙은 이렇다.

- 페이지 콘텐츠는 HTML/CSS로 한 번만 정의한다.
- 텍스처 해상도는 페이지 CSS 크기 × 실제 DPR. 이전의 고정 960×1240 텍스처와 DPR 상한 2는 쓰지 않는다.
- 쉬는 카메라는 px을 clip 좌표로 바로 매핑해 텍셀:픽셀을 1:1로 맞춘다(Mantine Book 정점 셰이더 방식). 이전 실패의 글자 축소는 원근 카메라와 월드 단위 크기 불일치가 원인일 가능성이 있다(추정).

### 텍스처 소스 비교

| 방식                                    | 움직일 때 선명도 유지       | 한글                        | 10–12px                      | 접근성                        | 성숙도                                    |
| --------------------------------------- | --------------------------- | --------------------------- | ---------------------------- | ----------------------------- | ----------------------------------------- |
| HTML-in-Canvas → WebGL                  | 상. 같은 텍스처, 기기 픽셀  | 브라우저 폰트 그대로        | DOM과 같음(서브픽셀 AA 제외) | 네이티브 노출, 찾기·번역 동작 | Chrome 157만. Firefox 부정적, WebKit 착수 |
| foreignObject 사전 래스터 → WebGL       | 상. 정적 페이지 한정        | 폰트를 data URL로 넣어야 함 | scale=DPR이면 DOM에 가까움   | DOM 오버레이 별도             | 라이브러리 활발, Safari 버그              |
| SDF (troika-three-text 0.53.1)          | 중. DOM과 다른 래스터라이저 | CJK 대응, woff2 미지원      | 약함(힌팅 없음)              | 숨은 DOM 병행                 | 활발                                      |
| MSDF 사전 아틀라스                      | 중                          | 11,172자라 서브셋 필수      | 약함                         | 숨은 DOM 병행                 | 한글 사례 미확인                          |
| CSS3DRenderer / drei `<Html transform>` | 평면만. 곡면은 띠 근사      | DOM 그대로                  | 정지 시 최상, 변형 중 블러   | DOM 그대로                    | 성숙, 곡면 불가                           |
| html2canvas                             | 하. 렌더러를 자체 재구현    | 미확인                      | 미확인                       | 별도                          | 1.4.1(2022) 이후 정체                     |

### HTML-in-Canvas 상태

- Chrome 블로그(2026-10-26): "Chrome 157 marks the official stable release of the HTML-in-Canvas API." 플래그 없이 기본으로 켜지는지는 글에 명시돼 있지 않다. 실기기에서 `canvas.content` 감지로 확인한다. ([출처](https://developer.chrome.com/blog/html-in-canvas))
- API(155에서 이름 변경): `<canvas content="drawable">`와 자식의 `drawable` 속성. 2D는 `drawElementImage`, WebGL은 `texElementSubImage2D`, WebGPU는 `drawElementImageToTexture`. 3D에서는 `updateElementGeometry(DOMMatrix)`로 hit-test와 포커스 링을 맞춘다. 행렬 하나라서 휜 구간의 정확한 hit-test는 안 될 것으로 본다(추정). ([WebGL 가이드](https://developer.chrome.com/docs/web-platform/html-in-canvas/webgl), [explainer](https://github.com/WICG/html-in-canvas))
- 해상도: 캔버스 픽셀 그리드 기준으로 래스터한다. 캔버스를 `devicePixelContentBoxSize`에 맞추면 어떤 화면에서도 선명하다. ([WICG #138](https://github.com/WICG/html-in-canvas/issues/138))
- 안 그려지는 것: 교차 출처 `<img>`·`background-image`, 서브픽셀 AA, 방문 링크, 시스템 색 등. 사진은 동일 출처로 서빙한다(2026-11-12 서술. 사진 경로는 미정이며 10.5와 [open-decisions.md](./open-decisions.md) G1 참고).
- 표준화: WHATWG stage 3, 스펙 PR 미머지. Mozilla 쪽은 지문 수집·성능을 이유로 반대 의견을 냈다. WebKit은 지원 표명 예정이고 기능 플래그 작업을 시작했으며 출시 시점은 미정이다. **iOS 브라우저는 전부 WebKit이라 폴백이 필수다.**
- 선행 사례: [bramus/hic-pageflip](https://github.com/bramus/hic-pageflip)(MIT, 2026-11-11 갱신, HTML-in-Canvas 텍스처 + GLSL 페이지 말기). three.js `HTMLTexture`(r184부터, 실험적).

### foreignObject 폴백

- modern-screenshot 4.7.0, SnapDOM 3.7.4: 브라우저가 직접 그리므로 CSS가 그대로 적용된다. `scale`을 DPR로 주고 폰트를 data URL로 임베드한다. SnapDOM 벤더 벤치는 1200×800에서 17.5ms다(벤더 수치).
- 함정:
  - Mantine Book은 SnapDOM을 `embedFonts:false`로 써서 넘김 중에 시스템 폰트로 바뀐다. 같은 함정을 피한다.
  - Safari에서 폰트를 넣은 SVG를 처음 그릴 때 빈 캔버스가 나오는 버그가 있다. ([WebKit 219770](https://bugs.webkit.org/show_bug.cgi?id=219770))
  - 교차 출처 리소스는 CORS 때문에 임베드에 실패할 수 있다.

### SDF/MSDF를 보류하는 이유

- DOM과 다른 래스터라이저라서 정지는 DOM, 넘김은 SDF로 가면 이전 실패를 그대로 반복한다.
- 힌팅 정보가 없어 작은 글씨에 약하다. 10–12px 정량 비교는 찾지 못했다(미확인). ([three.js 포럼](https://discourse.threejs.org/t/msdf-text-rendering-text-looks-weird-when-zooming-out/87713))
- troika는 woff2를 지원하지 않고, 한글 완성형은 11,172자라 아틀라스 부담이 크다.

### 재래스터 규칙과 대체 경로 (2026-11-13 제안)

엔지니어링 제안이며 확정이 아니다. 미리 래스터한 페이지 텍스처를 언제 다시 그리는지, WebGL2를 쓸 수 없을 때 무엇을 하는지 정한다. α와 β 어느 쪽에도 적용한다. β라면 쉬는 상태는 DOM이 스스로 다시 그리므로 이 규칙은 넘김용 텍스처에만 걸린다. 다만 β는 잡는 순간 최신 키의 텍스처가 있어야 교체 순간 튐이 없다. S1에서 β를 볼 때 이 조건도 잰다.

이 절의 해상도는 페이지 텍스처 해상도다. 2장 "DPR 충돌"의 캔버스 드로잉 버퍼 상한(S2에서 결정)과는 다른 값이다. 쉬는 상태 텍셀:픽셀 1:1은 둘 다 실제 기기 픽셀일 때만 성립한다.

#### 재래스터 키 (제안)

텍스처마다 아래 값을 키로 두고, 키가 바뀐 텍스처만 다시 그린다.

| 키              | 값의 출처                            | 바뀌는 상황                                                                            |
| --------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| 페이지 CSS 크기 | 펼침면 배치 모델의 출력(S2 매개변수) | 창 크기, 회전, Fold 접기·펴기, 브라우저 확대로 배치가 바뀔 때                          |
| 텍스처 배율     | 캔버스의 기기 픽셀 크기 ÷ CSS 크기   | 브라우저 확대, 배율이 다른 모니터로 창 이동                                            |
| 콘텐츠 버전     | 페이지 데이터                        | 부록 레코드 곡 정보처럼 동적인 내용. S6에서 레코드를 텍스처로 그릴 때만                |
| 테마            | 미정                                 | 다크 모드를 지원하기로 하면 넣는다. 지금 문서에는 언급이 없다                          |
| 사진 원본       | 이미지 `decode()` 완료               | 흐린 미리보기를 채택하고 사진을 페이지 텍스처에 굽는 경우, 미리보기가 원본으로 바뀔 때 |

S1에서 사진을 글자 층과 분리해 이미지 그대로 텍스처로 올리는 안을 고르면, 사진은 재래스터가 아니라 해상도 단계를 다시 고르는 일이 된다.

감지 방법:

- **크기:** 캔버스에 ResizeObserver를 건다. `devicePixelContentBoxSize`는 Chrome 84+, Firefox 108+가 지원하고 Safari와 iOS는 지원하지 않는다(MDN browser-compat-data). Safari에서는 `contentBoxSize`에 `devicePixelRatio`를 곱해 반올림한다. 이 옵션을 모르는 브라우저에서 `observe()`가 예외를 던지는지는 미확인이라 감싸서 처리한다.
- **DPR:** `matchMedia('(resolution: Ndppx)')`의 change 이벤트를 듣고, 바뀔 때마다 새 값으로 다시 등록한다(MDN `devicePixelRatio` 문서의 패턴). 브라우저 확대는 DPR을 바꾸고 핀치 확대는 바꾸지 않는다(같은 문서).
- **회전:** 따로 듣지 않는다. 크기 변화로 잡는다.
- **Fold:** 6장대로 resize와 Device Posture change 때 `viewport.segments`를 다시 읽어 배치 모델에 넣는다. 책등 위치만 바뀌고 페이지 CSS 크기가 같으면 다시 그리지 않고 변환만 바꾼다.
- **모바일 주소창:** 주소창만 움직이고 페이지 CSS 크기와 배율이 그대로면 키가 같아 다시 그리지 않는다. 책 크기를 동적 뷰포트 높이에 묶지 않을 때만 성립한다(아래 사용자 판단).
- **핀치 확대:** 키가 바뀌지 않는다. 확대한 화면에서는 텍스처가 늘어나 보인다. [plan.md](./plan.md) 핵심 동작의 "사진 보기" 범위가 정해지면 다시 본다.
- **서체:** 필요한 서체가 `document.fonts.load()`로 준비되기 전에는 래스터하지 않는다. Safari 첫 그리기 버그(1장 foreignObject 폴백)의 우회는 래스터 함수 안에서 처리한다.

#### 다시 그리는 동안 (제안)

- 크기 변화는 멈춘 뒤 150ms(제안값)가 지나면 예약한다. DPR 변화는 바로 예약한다.
- 트리거마다 세대 번호를 올린다. 끝난 작업이 옛 세대면 버린다.
- 순서는 보이는 두 면, 앞뒤 펼침면, 나머지다. 미리 그릴 범위는 S1 측정으로 정한다.
- 새 텍스처가 준비될 때까지 옛 텍스처를 새 크기에 늘려 그린다. 입력은 막지 않는다. 이 구간은 쉬는 상태가 1:1이 아니다. 교체까지 걸리는 시간을 S1에서 잰다.
- 보이는 펼침면은 두 면이 모두 준비되면 같은 프레임에 함께 바꾼다. 한쪽만 선명한 펼침면을 만들지 않는다.
- 옛 텍스처는 교체 직후 해제한다. 교체 순간 메모리는 보이는 면의 두 배까지 오른다. S1에서 잰다.
- DOM 오버레이와 hit 영역은 텍스처를 기다리지 않고 새 배치로 바로 옮긴다. 키보드 포커스는 유지한다.

#### 넘김 중 변경 (제안)

- 넘김, 스티커 떼기, 레코드 끌기가 진행 중이면 텍스처를 바꾸지 않는다(2장 "움직이는 중에 해상도를 바꾸면 선명도 제약을 어긴다"). 세대만 올리고 착지 뒤 바꾼다.
- 넘김 중 페이지 CSS 크기가 바뀌면(회전, Fold 접기·펴기, 창 크기) 포인터가 남아 있어도 그 시점 진행도로 놓기 판정을 적용해 착지시킨다. 잡은 점과 포인터 좌표의 기준이 바뀌어 손가락 추종이 깨지기 때문이다. 같은 판정 규칙이라 환경마다 결과가 같다.
- 크기는 같고 배율만 바뀌면(창을 다른 모니터로 옮김) 넘김을 계속하고 착지 뒤 바꾼다.
- 클릭 넘김의 가상 포인터도 같은 규칙을 따른다.

#### 최대 텍스처 크기 예외 (제안)

- 시작할 때 `MAX_TEXTURE_SIZE`(three `capabilities.maxTextureSize`)와 실제 드로잉 버퍼 크기(`drawingBufferWidth`, `drawingBufferHeight`)를 읽는다. 브라우저는 요청보다 작은 드로잉 버퍼를 줄 수 있다.
- 면마다 텍스처 한 장을 쓴다. 앞뒷면을 한 텍스처에 묶으면 긴 변이 두 배가 된다.
- 긴 변이 한도를 넘거나 드로잉 버퍼가 줄어 1:1이 불가능하면, 측정값과 선택지(그 기기에서만 배율을 균일하게 낮춤, 아래 타일 분할, 해당 기기 미지원 표기)를 사용자에게 올린다. 아래는 균일 축소를 고를 때의 규칙이다. 그 기기에서만 배율을 한도에 맞춰 균일하게 낮춘다. 쉬는 상태와 움직이는 중에 같은 배율을 써서 넘김 중 해상도 변화는 없다.
- 이것은 0장 "쉬는 상태 텍스처 해상도는 낮추지 않는다"의 명시적 예외다. 발생한 기기·브라우저를 스파이크 결과에 적는다. 운영 중 발생을 알 계측은 없다.
- 1:1을 지키는 대안은 한 면을 여러 텍스처로 나누는 것이다. 셰이더와 이음매 비용이 있어 S1에서 대상 기기가 한도에 걸릴 때만 검토한다.
- 한도 초과를 이유로 대체 경로로 보내지 않는다.
- 참고 크기: 390×844 CSS px를 다 쓰는 DPR 3 페이지는 1170×2532다(판형 미정이라 상한 가정). 기기별 실제 한도와, foreignObject를 그리는 2D 캔버스의 Safari 크기 상한은 미확인이다. S1에서 잰다.

#### 재래스터 시나리오 (제안, 쉬는 중은 S1, 넘김 중은 S2)

| 시나리오                             | 기대 결과                                                            |
| ------------------------------------ | -------------------------------------------------------------------- |
| 쉬는 중 DPR 변경(창을 다른 모니터로) | 옛 텍스처를 늘려 보이다가 보이는 두 면을 한 프레임에 교체. 입력 가능 |
| 넘김 중 DPR 변경                     | 착지까지 옛 텍스처, 착지 뒤 교체                                     |
| 쉬는 중 회전, Fold 접기·펴기         | 크기가 멈춘 뒤 재래스터. 오버레이는 즉시 이동                        |
| 넘김 중 회전, Fold 접기·펴기         | 그 시점 진행도로 놓기 판정, 착지 뒤 재래스터                         |
| 데스크톱 브라우저 확대 100%→200%     | CSS 크기와 배율이 함께 바뀌어 재래스터 1회                           |
| 모바일 주소창 숨김·표시              | 책 크기 선택지에 따라 재래스터 없음 또는 매번 재래스터               |
| 한도 초과 기기                       | 균일 축소. 쉬는 상태와 넘김 중 배율 동일. 결과에 기록                |
| 위 시나리오 전체(접근성)             | 키보드 포커스와 스크린리더 위치 유지                                 |

#### 대체 경로 (제안)

트리거는 하나다. **WebGL2 컨텍스트를 만들 수 없을 때**만 대체 경로로 간다. 컨텍스트 손실 뒤 복구가 실패하면 같은 트리거로 본다(아래 손실 복구 6번).

- `getContext('webgl2')`가 null이면 three `WebGLRenderer` 생성자가 예외를 던진다. three는 WebGL2만 요청하므로 WebGL1만 있는 환경도 대체 경로다(blog가 설치한 three r186의 `src/renderers/WebGLRenderer.js`에서 확인. r187은 미확인).
- 트리거가 아닌 것: detect-gpu 등급, 프레임 시간, UA, 최대 텍스처 크기 초과, HTML-in-Canvas 지원 여부. `failIfMajorPerformanceCaveat`는 three 기본값 false를 유지한다. true로 바꾸면 소프트웨어 렌더링 기기를 성능으로 가르게 된다.
- 2장 "기기 성능 감지"도 같은 기준으로 고쳤다. detect-gpu를 측정 용도로라도 남길지는 S3에서 정한다.
- 판정 시점은 S3의 지연 로드 단계다. 포스터가 이미 화면에 있고, 실패하면 three 청크를 받지 않고 포스터가 그대로 닫힌 책이 된다.
- 한 번 대체 경로로 가면 그 세션 동안 유지한다.
- 대상은 0장 표 기준 WebGL2 미지원 약 2.7%다. 지원 브라우저도 GPU 블록리스트나 드라이버 문제로 생성에 실패할 수 있다(비율 미확인).

**0장의 명시적 예외:** 대체 경로는 0장의 "같은 렌더 경로·같은 글자 모양"을 지키지 않는다. 동작 규칙은 같다. 회전 모델, fold 모델(반사 접힘, 책등 제한, 놓기 판정, 가상 포인터), 키보드, 쪽 순서가 같은 순수 TS 모델에서 나온다. 달라지는 것은 렌더 경로(DOM), 곡면(평면 접힘), 광택이다.

**구현 방향:** 별도 렌더러를 만들지 않는다. 공통 DOM 오버레이를 보이게 바꾼 것이 대체 화면이다. 오버레이를 래스터 원본과 같은 페이지 HTML로 만든다는 전제다. 그렇지 않으면 대체 화면용 스타일이 따로 필요하다.

| 요소                     | 기본 경로                    | 대체 경로                                                                                | 같게 유지하는 것                   |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| 닫힌 책 회전             | WebGL 책                     | CSS 3D 포스터를 같은 회전 모델로 돌린다. 2장의 `preserve-3d` 평탄화 제약 안에서만 꾸민다 | 회전 모델, 드래그와 클릭의 구분    |
| 펼침                     | 표지 열림 뒤 1:1 쉬는 카메라 | reduced motion과 같은 전환으로 펼침면 DOM을 보인다                                       | 펼침 입력                          |
| 넘김(드래그·클릭·키보드) | 원통 곡면 셰이더             | 평면 반사 접힘 DOM(3장 비교표 첫 행)                                                     | fold 모델, 놓기 판정, 키 입력      |
| 글자·사진                | 텍스처(α) 또는 DOM(β)        | DOM. 래스터 없음                                                                         | 콘텐츠 원본                        |
| 부록 스티커 시트         | 원통 떼기와 광택 셰이더      | 평면으로 들어 올리는 떼기, 광택 없음. S4 결론이 "부록 시트 한정"일 때의 범위             | 떼기 판정                          |
| 부록 레코드              | S6에서 정하는 경로           | DOM과 CSS로 꺼내고 돌린다. Spotify 정보는 같은 DOM                                       | 꺼내기 판정, 데이터 경로           |
| 기울기 광택              | 셰이더                       | 없음                                                                                     | -                                  |
| 접근성                   | 투명 DOM 오버레이            | 오버레이가 곧 보이는 화면                                                                | 역할, 상태, 키보드, reduced motion |

#### 컨텍스트 손실 복구 순서 (제안)

three r186은 컨텍스트를 만들기 전에 손실·복구 리스너를 등록하고, 손실 때 `preventDefault()`를 호출하고, 복구 때 텍스처와 속성 캐시를 포함한 내부 GL 상태를 새로 만든다(같은 소스에서 확인). 그래서 GPU 자원은 전부 다시 올려야 한다.

1. **손실(`webglcontextlost`):** 렌더 루프를 멈추고 래스터·업로드 작업을 취소한다(세대 번호를 올린다). 순수 TS 모델 상태는 그대로 둔다. 넘김 중이면 그 시점 진행도로 놓기 판정을 적용한다.
2. **손실 동안:** 캔버스가 비므로 대체 경로 화면을 보인다. 오버레이 DOM은 그대로라 포커스와 스크린리더 위치가 유지된다. 복구 때 DOM에서 텍스처로 바뀌는 튐이 생기므로 iOS에서 손실이 얼마나 자주 나는지 S3에서 잰다.
3. **탭이 숨겨져 있으면** 복구 작업을 하지 않고 다시 보일 때 시작한다.
4. **복구(`webglcontextrestored`):** `compileAsync`로 셰이더를 다시 준비하고, 보이는 두 면부터 재래스터 큐로 텍스처를 다시 만든다. CPU 쪽 원본을 남겨 다시 올릴지, 다시 래스터할지는 S1 메모리 측정으로 정한다.
5. 첫 프레임을 그린 rAF에서 대체 화면을 감춘다. S3의 포스터 교체와 같은 방식이다.
6. 복구 이벤트가 5초(제안값) 안에 오지 않거나, 복구가 실패하거나, 한 세션에서 손실이 3회(제안값) 반복되면 생성 실패와 같은 트리거로 보고 세션 동안 대체 경로에 머문다.

검증은 E2E에서 `WEBGL_lose_context` 확장으로 손실과 복구를 일으킨다(three `forceContextLoss`도 같은 확장을 쓴다). [spikes.md](./spikes.md)의 "테스트와 스파이크 운영"을 따른다.

#### 사용자 판단 필요

결론이나 추천 없이 선택지만 적는다.

**책 크기와 모바일 주소창**

| 선택지                  | 보이는 결과                                               | 비용                                                                                                                |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 작은 뷰포트(`svh`) 기준 | 주소창이 숨어도 책 크기가 그대로이고 아래 여백이 늘어난다 | 재래스터 없음                                                                                                       |
| 동적 뷰포트(`dvh`) 추종 | 주소창에 따라 책이 커지고 작아진다                        | α: 주소창이 움직일 때마다 보이는 면을 재래스터하고, 그 사이 늘어난 텍스처가 흐리게 보인다. β: 쉬는 상태는 영향 없음 |
| 큰 뷰포트(`lvh`) 기준   | 주소창이 보일 때 책 아래가 가려질 수 있다                 | 재래스터 없음                                                                                                       |

**대체 경로 화면(컨텍스트 손실 중 화면 포함)을 언제 볼지**

| 선택지                        | 근거·비용                                      |
| ----------------------------- | ---------------------------------------------- |
| G0 정지 화면 비교에 포함      | 처음부터 디자인 대상이 된다. G0 범위가 커진다  |
| G3(S3)에서 실제 동작으로 확인 | G0가 가볍다. 대체 화면 모습은 S3 뒤에 정해진다 |
| G5 공개 전에만 확인           | 비용이 가장 작다. 마지막에 고치게 된다         |

#### 결정 시점 (제안)

| 항목                                     | 시점                                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| 재래스터 키, 감지, 표시 규칙             | G1. S1 시나리오로 검증                                     |
| 최대 텍스처 크기 예외                    | G1. S1에서 기기별 한도를 재고, 예외 방식은 사용자가 고른다 |
| 넘김 중 크기 변경 처리                   | G2. S2 fold 모델의 놓기 판정에 포함                        |
| 대체 경로 트리거, 요소별 동작, 손실 복구 | G3. S3 통과 기준                                           |
| 책 크기와 주소창 (사용자)                | G0                                                         |
| 대체 경로 화면을 볼 시점 (사용자)        | 위 선택지에 따름                                           |

## 2. 닫힌 책과 렌더링 스택

| 선택지                              | 크기 (gzip)               | 버전·유지                       | React 19          | 적합성                                     |
| ----------------------------------- | ------------------------- | ------------------------------- | ----------------- | ------------------------------------------ |
| three `WebGLRenderer` (tree-shaken) | 130.7KB (br 106.7KB)      | r187 (2026-10-30), 매우 활발    | 무관              | 최적. 책·곡면·`ShaderMaterial` 모두 가능   |
| three `WebGPURenderer`              | 224KB (br 179.5KB)        | 매뉴얼상 "still experimental"   | 무관              | 과함. `ShaderMaterial` 미지원이라 TSL 필요 |
| @react-three/fiber                  | 57.7KB (react·three 제외) | 9.8.2 (2026-10-14), v10은 alpha | peer `>=19 <19.4` | 선택. 씬 하나면 이점이 작다                |
| @react-three/drei                   | 전체 521KB, 개별 import   | 10.7.9                          | `^19`             | 필요한 헬퍼만                              |
| OGL                                 | 13.1KB (최소 셰이더)      | 1.0.11, 마지막 커밋 2025-04     | 무관              | 가볍지만 유지 정체                         |
| twgl.js                             | 11.2KB                    | 7.0.0                           | 무관              | 순수 WebGL 보조. 카메라·곡면 직접 구현     |
| CSS 3D                              | 0KB                       | 표준                            | 무관              | 첫 화면 포스터와 WebGL2 미지원 대체용      |

크기 출처: bundlephobia(2026-11-12 조회), [three 0.187 측정](https://github.com/igorxciv/igorcodes/issues/12), [OGL/twgl 측정](https://github.com/kramhash/frapx-bench).

- **WebGPU는 아직 기본으로 쓰지 않는다.** caniuse(2026-10) 기준 WebGPU 88.6%, WebGL2 97.3%다. 대상 폴더블 중 Flip7(Exynos 2500)과 한국판 Flip8(Exynos 2600)은 Samsung Xclipse GPU를 쓰는데, Chrome Android에서 이 GPU의 WebGPU 지원은 TBD다. ([caniuse](https://caniuse.com/webgpu), [gpuweb 구현 현황](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status))
- **저장소 선례:** `apps/blog`가 three 0.186.1을 쓰면서 `three/webgpu`(주석상 원본 약 600KB)를 그래프 번들에서 빼려고 스텁으로 갈아끼웠다(`apps/blog/next.config.mjs`). WebGPU 렌더러의 무게를 이미 겪은 기록이다.
- **CSS 3D의 한계:**
  - `opacity<1`, `filter`, `overflow: hidden`, `clip-path`, `mask`, `isolation`, `mix-blend-mode` 중 하나라도 쓰면 `preserve-3d`가 평탄화된다. 그림자나 페이드를 넣는 순간 3D가 깨지기 쉽다. ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-style))
  - `will-change: transform`이 걸린 요소는 scale이 바뀌어도 다시 래스터하지 않아 흐린 채로 남는다. ([Chrome](https://developer.chrome.com/blog/re-rastering-composite))
  - "글자가 항상 선명하다"는 장점은 정면에 멈춰 있을 때만 맞다.
- **포스터 → WebGL 교체:** 정형화된 공식 패턴은 없다. 업계 조합은 다음 순서다.
  1. HTML/CSS 포스터를 먼저 보여준다.
  2. three 청크를 `import()`로 받는다.
  3. 실제 렌더 조건 그대로 `renderer.compileAsync(scene, camera)`를 호출한다.
  4. 텍스처를 업로드한다. 지연 원인이 셰이더가 아니라 `texImage2D`인 경우도 있다.
  5. 첫 프레임을 그린 뒤 rAF에서 포스터를 페이드한다. 포스터의 각도와 3D 초기 포즈가 정확히 같아야 깜빡임이 없다.
- **렌더 정책:** 드래그나 애니메이션 중에만 그린다(R3F라면 `frameloop="demand"`). `visibilitychange`와 IntersectionObserver로 화면 밖에서는 멈춘다. OffscreenCanvas + Worker는 이 규모에선 도입하지 않는다.
- **DPR 충돌 (스파이크에서 결정):** 관례는 데스크톱 2, 모바일 1.5 상한이다. 하지만 1장의 "실제 DPR 해상도" 원칙과 부딪힌다. 쉬는 상태는 다시 그리지 않으므로 비용은 움직일 때만 든다. 움직이는 중에 해상도를 바꾸면 선명도 제약을 어긴다. 실기기 발열과 프레임으로 S2에서 정한다. iOS 저전력 모드는 rAF를 30fps로 제한한다. ([WebKit 215745](https://bugs.webkit.org/show_bug.cgi?id=215745))
- **기기 성능 감지:** `@pmndrs/detect-gpu` 6.0.30(3.7KB gzip). 데이터 원천인 gfxbench가 2025-12에 갱신을 멈췄고, 기본 설정은 unpkg CDN에서 데이터를 받으므로 자체 호스팅이 필요하다. 0장 원칙에 따라 detect-gpu의 tier로 렌더 경로를 가르지 않는다. CSS 3D 표지와 평면 넘김 대체 경로는 WebGL2 컨텍스트 생성에 실패한 환경에만 쓰며, 이 경로는 0장 "동일한 동작"의 명시적 예외다. (2026-11-12 원문은 tier 0도 대체 조건에 넣었으나 0장과 충돌해 11-13에 고쳤다.)
- **ryo.lu와의 비교:** ryo.lu 메인 JS는 전송 기준 323KB(원본 1.09MB)이고 WebGL·wasm 흔적이 없다. three 최소 씬 약 107KB br은 이 안에 들어간다.

## 3. 곡면 넘김

**결론:** 해석적인 "반사 접힘 + 접힘선 정렬 원통"을 WebGL2 정점 셰이더로 그린다. 물리 시뮬레이션은 재미 트랙이다.

- **반사 접힘:** 잡은 점이 포인터 위치로 접히고, 접힘선은 두 점의 수직이등분선이다. 모서리든 가장자리 가운데든 모델 하나로 처리한다. ([cut-the-knot](https://www.cut-the-knot.org/pythagoras/PaperFolding))
- **원통 감기:**
  - 평면 점을 반지름 r 원통에 감는 각도는 β = x/r이다. πr 너머 구간은 뒤집힌 평면으로 이어 뒷면을 보여준다. ([XBPageCurl](https://github.com/rrader/XBPageCurl))
  - 손가락 아래에 정확히 맞추려면 D/R = θ − sinθ를 이진탐색으로 푼다. 대각선에서 벗어나면 실제 종이는 원뿔처럼 가늘어지지만 원통으로도 충분하다는 실무 의견이 있다. ([Sorrentino 2015](https://ggcrunchy.github.io/projects/GeometryArticles/PageCurl.html))
- **책등 이탈 방지:** 포인터를 책등 끝점 중심, 반경 W(페이지 폭)인 원 안으로 제한한다(Mantine Book `limitPointToCircle`). 원통 반경은 넘김 말미에 줄여서 평평한 착지로 잇는다.
- **원뿔 모델(Hong et al.):** 시간 파라미터로 구동해서 잡은 위치 추종이 약하다. Mantine Book도 포팅만 해두고 실제로는 원통을 쓴다. ([prideout 포트](https://prideout.net/pageturn/))

| 방식                        | 잡은 위치 추종                  | 구현 난이도 | 성능                             | 텍스트 영향                                  |
| --------------------------- | ------------------------------- | ----------- | -------------------------------- | -------------------------------------------- |
| 평면 반사 접힘 (DOM)        | 좋음                            | 낮음        | 최상                             | 없음. 곡면 없음                              |
| CSS affine 띠 근사 (실패 2) | 중                              | 중상        | 띠 수에 비례                     | 띠 이음매·틈                                 |
| 접힘선 정렬 원통 (셰이더)   | 좋음                            | 중          | 좋음                             | 텍스처 소스에 따름. 늘어남 없음(등거리 변형) |
| 원뿔 (Hong 2006)            | 약함                            | 중상        | 좋음                             | 원통과 같음                                  |
| XPBD 천 (JS)                | 정확(잡은 정점 고정), 튜닝 필요 | 상          | 수 ms (추정)                     | 원통과 같음 + 남은 늘어남만큼 왜곡           |
| XPBD + WASM/SIMD            | 같음                            | 상 + 툴체인 | 절대 이득 작음 (추정)            | 같음                                         |
| XPBD + WebGPU compute       | 같음                            | 최상        | 이 규모에선 오버헤드 우세 (추정) | 같음                                         |

### 클릭 넘김과 드래그 넘김을 한 모델로

- 상태는 (잡은 점, 포인터)다. 클릭하면 클릭 위치를 가장자리에 투영해 잡은 점으로 삼고, 가상 포인터를 경로를 따라 움직여 드래그와 같은 모델로 재생한다(StPageFlip `flipNext` 패턴). 그래서 클릭 넘김도 같은 곡면이 나온다.
- 놓았을 때는 진행도가 0.5를 넘거나 속도가 임계를 넘으면 완주, 아니면 복귀한다. 참고값: StPageFlip은 책등을 넘었는지, Mantine Book은 50px 또는 빠른 스와이프, @vysmo/flipbook은 `dragCommit` 0.5.
- 쉴 때는 rAF를 돌리지 않는다. 놓은 뒤 easing 수치(이전 160–280ms, Mantine Book 프로그램 넘김 easeOutCubic 1000ms)는 새로 고른다.

### 참고할 오픈소스

| 이름                                                               | 상태                       | 라이선스        | 곡면 방식                              | 잡은 위치             |
| ------------------------------------------------------------------ | -------------------------- | --------------- | -------------------------------------- | --------------------- |
| [@gfazioli/mantine-book](https://github.com/gfazioli/mantine-book) | 1.0.15 (2026-11-09)        | MIT             | 평면 DOM 접힘 + WebGL2 원통            | 가장자리 임의 점·방향 |
| [bramus/hic-pageflip](https://github.com/bramus/hic-pageflip)      | 2026-11-11 갱신            | MIT             | HTML-in-Canvas 텍스처 + GLSL 원통·원뿔 | 미확인                |
| page-flip (StPageFlip)                                             | 2.0.7 (2021), push 2024-01 | MIT             | 평면 반사 (clip-path)                  | 모서리만              |
| turn.js                                                            | jQuery 의존                | 비상업 조항     | 평면                                   | 모서리                |
| wawa-sensei r3f book slider                                        | push 2024-11               | 라이선스 없음   | SkinnedMesh, 책등 축으로만 굽힘        | 없음 (클릭만)         |
| turngl, webgl-page-curl, @vysmo/flipbook                           | 2025–2026                  | MIT / ISC / MIT | 텍스처 + 원통, 진행도 기반             | 진행도·고정 시작점    |

## 4. 스티커

2026-11-13부터 스티커는 사진 페이지가 아니라 부록 스티커 시트 한 페이지에만 있다. 미니멀·사진 잡지 컨셉과 어색하면 뺄 수 있는 시험 항목이다.

- **떼기:** 페이지와 같은 원통 함수를 쓴다. 축은 드래그 방향에 수직으로 두고, 접힘선은 수직이등분선에 반경 r을 줘서 둥글게 만든다. 뒷면은 `gl_FrontFacing`으로 흰 종이를 그린다. 그림자는 들린 높이에 맞춰 아래 페이지를 어둡게 하고, 착지와 복귀는 JS 스프링으로 처리한다. 상용 규모 참고: [Framer Draggable Sticker](https://www.framer.com/marketplace/components/draggable-sticker/)는 32×32 정점 메시를 쓴다.
- **광택:**
  - CSS 방식([pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css): blend mode + filter + 포인터 변수)은 평면 카드를 기울이는 수준까지만 된다. 휘는 면 위의 광택은 normal도 같이 변형돼야 해서 셰이더가 필요하다.
  - 셰이더 구성 후보: Schlick fresnel, specular, thin-film 무지개 근사, hash로 만든 flake 반짝이, 작은 환경맵 또는 matcap.
  - 물리 기반 thin-film 참고: [KHR_materials_iridescence](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_iridescence/README.md)(Belcour & Barla 2017, 두께 100–400nm, IOR 1.3).
  - [4rknova foil sticker](https://www.4rknova.com/blog/2025/08/30/foil-sticker) 글은 구성이 거의 같지만 CC-BY-NC라 원리만 참고한다.
- **기울기 입력:**
  - iOS의 `DeviceOrientationEvent.requestPermission()`은 사용자 제스처와 HTTPS가 필요하다. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static))
  - Chrome도 2026-06 Intent to Ship으로 센서 권한을 허용/질문/차단 3단계로 바꾸고, 나중에 기본값을 "질문"으로 바꿀 예정이다. 그러니 Chrome도 같은 권한 경로로 처리한다.
  - 탭으로 켜는 버튼을 두고, 실패하거나 데스크톱이면 포인터로 대체한다. 첫 이벤트를 기준값으로 보정하고, low-pass 필터를 넣고, reduced motion을 존중한다.
- **die-cut 테두리:**
  - 빌드 타임에 sharp로 알파 → threshold → 거리장(또는 blur+threshold)을 거쳐 SDF 텍스처 한 장을 굽는다. 셰이더에서 테두리 폭, 안티앨리어싱, 그림자를 자유롭게 조절할 수 있다.
  - `feMorphology`는 커널이 사각형이라 모서리가 각진다. ([Filter Effects](https://www.w3.org/TR/filter-effects-1/))
  - GPU Jump Flooding은 사용자가 런타임에 스티커를 올리는 기능이 생길 때만 검토한다.

## 5. WebAssembly

**결론:** 기본 경로엔 넣지 않는다. 원통 변형은 셰이더에서 끝나고, 시뮬레이션도 JS로 먼저 만든다. WASM은 재미 트랙이다.

- **JS로 충분하다는 근거:**
  - Ten Minute Physics: JS Float32Array로 6,400 삼각형 천을 휴대폰에서 30fps 이상. ([출처](https://matthias-research.github.io/pages/tenMinutePhysics/index.html))
  - 30×40 격자는 1,271 정점, substep당 제약 약 8.5k다. 15 substep이면 프레임당 약 128k 투영이라 중급 폰에서 수 ms로 추정한다. 실측이 필요하다.
- **WASM이 이기는 조건:**
  - Float32Array 덧셈 벤치(2025-09): JS 1.403ms, wasm-bindgen 1.623ms(복사 때문에 JS보다 느림), raw WASM 0.353ms, SIMD 0.231ms. **공유 메모리 뷰 + SIMD일 때만 이득이다.** ([출처](https://dev.to/bence_rcz_fe471c168707c1/rust-webassembly-performance-javascript-vs-wasm-bindgen-vs-raw-wasm-with-simd-4pco))
  - IMC'21: 작은 입력에선 WASM이 크게 빠르지만 중간 크기에서는 역전이 많고, 메모리를 3–6배 더 쓴다. ([출처](https://benchmarkingwasm.github.io/BenchmarkingWebAssembly))
- **진입 조건 (제안값):** 중급 폰에서 시뮬레이션이 프레임당 2ms를 넘을 때만 옮긴다.
- **옮길 때:**
  - wasm-bindgen 없이 Rust raw export로 만든다. LTO, `opt-level` "s"와 "z" 둘 다 측정, `wasm-opt`. 크기 근거: raw export 168B–2.0KB, wasm-bindgen 예제 17,317B(gzip 9,045B). ([surma](https://surma.dev/things/rust-to-webassembly/), [Rust wasm book](https://rustwasm.github.io/book/game-of-life/code-size.html))
  - SIMD는 Baseline(2025-09)이지만 Rust에선 `-Ctarget-feature=+simd128`을 직접 켜야 한다.
  - Vite 8.1부터 wasm ESM integration이 코어에 들어왔다. 이 앱은 `vite ^8.3.5`라 바로 쓸 수 있다. ([Vite 8.1](https://vite.dev/blog/announcing-vite8-1))
  - 정점 버퍼는 wasm 메모리의 Float32Array 뷰를 `bufferSubData`로 올린다. `memory.grow()`는 기존 버퍼를 detach하므로 메모리를 고정 크기로 잡거나 grow 뒤에 뷰를 다시 만든다. ([MDN](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory/grow))
- **threads는 쓰지 않는다:** SharedArrayBuffer는 COOP/COEP 격리가 필요하다. `require-corp`는 CORP/CORS 헤더 없는 외부 이미지·iframe을 막고, COOP는 팝업 통신을 끊는다. `credentialless`는 Safari가 지원하지 않는다. ([web.dev](https://web.dev/articles/coop-coep))
- **툴체인 사실:**
  - wasm-pack은 아카이브되지 않았다. rustwasm org 정리 후 `wasm-bindgen/wasm-pack`으로 옮겨져 유지된다(v0.15.1).
  - wasm-bindgen 0.2.130(2026-10-30)의 CLI는 crate 버전과 정확히 같아야 한다. 공식 배포 가이드는 Vite를 언급하지 않는다.
- **CI:** 저장소 CI에는 Rust 툴체인이 없다. ubuntu-24.04 러너엔 rustup이 있지만 wasm32 target과 binaryen은 따로 설치해야 한다. 권장 방식은 빌드된 `.wasm`을 커밋하고, Rust 소스가 바뀔 때만 도는 검증 job을 두는 것이다. Turborepo 캐시만으로는 CI에서 툴체인을 뺄 수 없다.
- **WebGPU compute:** three.js 공식 compute cloth 예제도 30×30이고 WebGL 백엔드가 TODO 상태다. 이 규모에선 오버헤드가 크다고 보고 쓰지 않는다(추정).

## 6. 폴더블

- **Viewport Segments** (`window.viewport.segments`, `@media (horizontal-viewport-segments: 2)`, `env(viewport-segment-*)`): Chrome/Edge 138+, Samsung Internet 30+. Firefox와 Safari 정식판은 지원하지 않는다. Safari 27.1에서 iPhone Duo용 developer preview가 기능 플래그 뒤에 들어갔다. ([caniuse](https://caniuse.com/mdn-api_viewport_segments), [WebKit 27.1](https://webkit.org/blog/18486/webkit-features-for-safari-27-1/))
- **Device Posture:** Chrome/Edge 132+.
- 기기를 접지 않으면 세그먼트가 1개만 보고된다. 값은 스냅샷이라 resize나 posture가 바뀔 때마다 다시 읽는다. ([Chrome](https://developer.chrome.com/blog/viewport-segments-api-shipped))
- **적용안:** 세그먼트가 2개일 때만 펼친 책의 책등을 `env(viewport-segment-right 0 0)`에 맞추고, 같은 값을 3D 카메라 오프셋에도 반영한다. 힌지 기준으로 WebGL을 배치한 사례는 찾지 못했다.

## 7. 접근성과 동작 줄이기

- WCAG 2.3.3: 상호작용이 촉발한 모션은 끌 수 있어야 한다. ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html))
- reduced motion이면 곡면과 자동 완주를 끄고 즉시 교체나 짧은 crossfade로 바꾼다. 키보드 ←/→로 넘긴다.
- 넘기는 중 숨은 페이지는 `inert` 또는 `aria-hidden` 처리한다.
- 모든 브라우저에서 캔버스 위에 같은 투명 DOM 오버레이를 겹쳐 스크린리더·텍스트 선택·hit-test를 제공한다(권장 구조와 같은 공통 경로). HTML-in-Canvas의 네이티브 노출은 0장 표처럼 결과가 같다고 확인된 경우에만 쓰는 최적화다. ([Chrome 가이드](https://developer.chrome.com/docs/modern-web-guidance/guides/visual-design/expose-canvas-content-to-browser-features))

### 요소별 대응표 (2026-11-13 초안)

2026-11-13 준비도 리뷰를 받아 만든 엔지니어링 초안이며 확정이 아니다. "(제안)"은 엔지니어링 안이고, "미정"은 동작 자체가 정의되지 않은 칸이다. 사용자가 정할 항목은 칸에 U 번호만 적고, 선택지와 비용은 아래 "사용자 판단 대기" 표에 모았다. 결정 시점(G0–G5)은 [open-decisions.md](./open-decisions.md)를 따른다. 9장의 모든 스파이크 통과 기준에 이 표의 해당 행을 넣는다.

**시각은 사용자 결정이다.** 포커스 표시의 모양·색·두께, 조작 영역의 위치·크기·표시, 키 안내를 보일지는 이 표에서 비워 둔다. 표의 크기 기준은 판정 영역(hit region)에 대한 것이고 보이는 크기와 별개다.

전제:

- 0장대로 모든 대상 환경에서 같은 동작이다. 접근성 노출은 위 항목대로 모든 브라우저에서 같은 투명 DOM 오버레이로 한다.
- 오버레이는 렌더 경로와 독립이다. CSS 포스터, WebGL, WebGL2 실패 대체 경로(2장)에서 키보드·스크린리더 열이 같아야 한다.
- reduced motion은 환경 차이가 아니라 사용자 설정이다. 설정이 같으면 모든 환경에서 같은 대체 동작을 낸다.
- "포커스 표시 경로" 열은 α 기준이다. β는 쉬는 상태가 DOM 그대로라 오버레이가 필요 없고, 넘기는 동안의 규칙만 같다.

#### 기준

| 기준                                                                                                               | 수준 | 이 표에서 쓰는 요지                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)                                        | A    | 모든 기능을 키보드로 쓸 수 있다                                                                                                                                                             |
| [2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)                        | A    | 자동으로 시작해 5초 넘게 움직이는 것은 멈출 수 있어야 한다. 버튼 같은 직접 조작으로 시작한 움직임은 자동 시작이 아니다. 초점·hover·스크롤로 시작하면 자동이다                               |
| [2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)  | AAA  | 상호작용이 촉발한 모션 애니메이션을 끌 수 있다. 색·투명도 변화는 모션 애니메이션이 아니다(흐림은 2025-06-27 정오표로 제외 목록에서 빠졌다, [errata](https://www.w3.org/WAI/WCAG22/errata/)) |
| [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)                              | AA   | 키보드 포커스가 보인다                                                                                                                                                                      |
| [2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | AA   | 포커스 받은 요소가 작성자 콘텐츠에 완전히 가려지지 않는다                                                                                                                                   |
| [2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)                    | AA   | 드래그 기능은 드래그 없는 단일 포인터로도 된다. 같은 컴포넌트일 필요는 없고 기능이 같으면 된다. 키보드 대안만으로는 충족하지 않는다. 대안이 스와이프 같은 경로 제스처에 기대면 안 된다      |
| [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)                | AA   | 판정 영역 24×24 CSS px 이상. 예외: 간격(24px 원이 다른 대상·원과 겹치지 않음), 같은 페이지의 동등 컨트롤, 문장 안, 사용자 에이전트 기본, 필수                                               |
| [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)                        | A    | 역할·이름·상태가 보조 기술에 노출된다                                                                                                                                                       |
| [4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)                          | AA   | 포커스를 옮기지 않는 상태 변화는 `role="status"` 등으로 알린다                                                                                                                              |
| [1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)                                  | AA   | 글자를 200%까지 키울 수 있다. 이미지 글자는 제외. α 텍스처 글자는 S1에서 확인한다                                                                                                           |

#### 공통 규칙 (제안)

- **키 범위:** ←/→는 책 영역 안에 포커스가 있을 때만 받는다. 문서 전역에 걸지 않는다. 스크린리더 탐색 모드에서는 화살표를 스크린리더가 먼저 쓰므로, 스크린리더 사용자는 넘김 버튼으로 넘긴다.
- **넘김 버튼:** 클릭 넘김 영역을 오버레이의 네이티브 `<button>`으로 만든다. [APG Carousel](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)의 이전·다음 컨트롤처럼 눌러도 포커스가 버튼에 남아 연속으로 넘길 수 있다. 첫·끝 펼침에서 `disabled`를 쓰면 포커스가 빠지므로 `aria-disabled`를 쓴다.
- **숨은 쪽:** 위 항목의 "`inert` 또는 `aria-hidden`" 중 `inert`를 쓴다. `aria-hidden`만 걸면 안의 링크가 Tab으로 계속 잡힌다. inert 노드는 접근성 API에 노출되지 않는다([HTML](https://html.spec.whatwg.org/multipage/interaction.html#inert-subtrees)). 미리 래스터하려고 문서에 둔 다른 쪽 DOM도 inert로 둬서 오버레이와 두 번 읽히지 않게 한다.
- **넘김 전 포커스 이동:** 포커스가 넘어가는 쪽 안에 있으면 inert를 걸기 전에 책 영역 컨테이너로 옮긴다. 포커스된 요소가 inert가 되면 포커스를 잃는다(어디로 가는지는 브라우저별 확인).
- **쪽 변경 알림:** `role="status"` 영역 하나에 착지 때 한 번 쓴다. 넘기다 놓아 되돌아간 경우는 알리지 않는다. 러닝 헤드의 쪽 번호는 live region으로 만들지 않아 두 번 읽히지 않게 한다. 다른 안: APG Carousel처럼 펼침 묶음을 `aria-live="polite"`로 두면 새 쪽의 대체 텍스트까지 읽지만, 판권면처럼 글이 많은 쪽에서 길어진다.
- **오버레이 투명화:** `opacity: 0`은 포커스 표시와 텍스트 선택 표시까지 지운다. 글자·배경만 투명하게 하고 `:focus-visible`과 선택 표시는 남긴다.
- **오버레이 정렬:** 오버레이가 텍스처 글자와 같은 자리에 오는 것은 쉬는 카메라가 1:1일 때뿐이다(1장). 넘김·펼침 전환 중에는 움직이는 쪽의 오버레이를 inert로 두고, 포커스 표시는 넘김 버튼이나 컨테이너에만 둔다.
- **reduced motion:** `prefers-reduced-motion: reduce`를 시작할 때와 바뀔 때(`matchMedia` change) 읽어 순수 TS 모델의 입력으로 넣는다([C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)). 놓기 판정과 입력 우선순위는 같고 그리는 방식만 바뀐다. 투명도 crossfade는 2.3.3의 모션 애니메이션이 아니다.
- **입력 우선순위:** 같은 면에서는 링크·스티커·레코드의 판정 영역이 넘김(클릭과 드래그 시작)보다 우선한다(9장 S2 보강 제안).

#### 대응표

| 요소                                      | 키보드 (2.1.1)                                                                                                                         | 스크린리더 (4.1.2·4.1.3)                                                                                                                                                           | 드래그 없는 대안 (2.5.7)                                                                                                   | 조작 영역 (2.5.8)                                                                                                                                                                       | reduced motion (2.3.3)                                                                                          | 포커스 표시 경로                                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 닫힌 책 회전                              | (제안) 책 버튼에 포커스가 있을 때 ←/→로 한 단계씩 돈다. 단계(면 목록)는 회전 범위 결정([open-decisions.md](./open-decisions.md) G3) 뒤 | (제안) 앞·뒤 표지와 책등 정보를 각도와 무관하게 DOM 텍스트로 둔다. 각도는 노출하지 않는다                                                                                          | 미정. 클릭이 펼침이라 드래그 없는 회전 수단이 없다. 키보드 회전만으로는 충족하지 않는다(U1)                                | 책 전체가 판정 영역이라 기준을 넘는다                                                                                                                                                   | (제안) 포인터를 따라 도는 직접 조작은 남기고, 놓은 뒤 관성·자동 복귀를 끈다. 키 회전은 즉시 전환 또는 crossfade | (제안) 책 투영 영역을 덮는 오버레이 버튼 하나. CSS 포스터와 WebGL이 같은 DOM 요소를 써서 교체 때 포커스를 잃지 않는다                          |
| 표지 펼치기                               | (제안) 책 버튼에서 Enter·Space                                                                                                         | (제안) `button`. 표지 정보는 `aria-describedby`로 잇는다. 펼친 뒤 상태 영역에 첫 펼침 쪽 번호를 1회 알린다                                                                         | 해당 없음(클릭 동작)                                                                                                       | 책 전체라 기준을 넘는다                                                                                                                                                                 | (제안) 표지 회전·카메라 이동 없이 첫 펼침으로 crossfade. 어느 각도에서 눌러도 같다                              | (제안) 펼친 뒤 책 버튼이 사라지므로 포커스를 책 영역 컨테이너로 옮긴다. 옮기지 않으면 포커스가 body로 빠진다                                   |
| 드래그 곡면 넘김                          | 드래그 자체의 키 대응은 없다. 같은 기능은 클릭 넘김 행                                                                                 | 드래그 과정은 노출하지 않는다. 착지 때 상태 영역 1회, 복귀는 알리지 않는다                                                                                                         | 클릭 넘김이 대안이다([plan.md](./plan.md) 페이지 넘김). 클릭만으로 모든 펼침에 닿는지가 통과 조건                          | (제안) 잡기 시작 판정 영역 24 CSS px 이상. 위치·표시는 사용자 결정                                                                                                                      | 곡면과 자동 완주를 끈다(위 항목). 놓을 때 같은 놓기 판정으로 즉시 교체 또는 crossfade. 끄는 동안 보이는 것은 U7 | 포인터 동작이라 포커스는 움직이지 않는다. 포커스가 넘어가는 쪽 안이면 공통 규칙대로 컨테이너로 옮긴다                                          |
| 클릭 넘김                                 | 책 영역 안 ←/→(위 항목). (제안) 넘김 버튼은 Tab으로 닿고 Enter·Space로 넘긴다                                                          | (제안) `button` 두 개(이전 쪽, 다음 쪽). 끝에서는 `aria-disabled`. 착지 알림은 드래그와 같다                                                                                       | 해당 없음                                                                                                                  | 판정 영역 24 CSS px 이상. 배치(예: georgehatton식 쪽 높이 전체 기둥)와 표시는 사용자 결정([open-decisions.md](./open-decisions.md) G2)                                                  | 즉시 교체 또는 짧은 crossfade(위 항목)                                                                          | 넘김 버튼 자신의 `:focus-visible`. 누른 뒤에도 포커스가 버튼에 남는다                                                                          |
| 사진 보기                                 | 미정(U3). 쪽 안에서 보기만이면 조작이 없다                                                                                             | (제안) 오버레이 쪽 DOM의 `<img alt>`. 대체 텍스트 문구와 저장 위치는 사용자 결정                                                                                                   | 확대·이동이 생기면 필요하다. 미정                                                                                          | 미정                                                                                                                                                                                    | 미정. 확대가 생기면 크기 변화 대신 crossfade(제안)                                                              | 보기만이면 포커스 대상이 아니다. 확대가 생기면 [APG Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)식 포커스 가두기·복귀(제안) |
| 부록 레코드 꺼내기                        | (제안) 레코드 버튼에서 Enter·Space로 꺼내기·넣기. 닫힌 책에서 조작하면 책 버튼과 별도 탭 정지가 생긴다(U2)                             | (제안) `button` + `aria-expanded`. 곡명·아티스트·로딩·실패를 텍스트로 둔다. 곡명이 있으면 앨범 아트는 `alt=""`. 곡 정보 갱신은 알리지 않는다                                       | 클릭으로도 꺼낸다(plan.md 부록 레코드)라 충족. 닫힌 책에서 꺼내기 드래그와 회전 드래그 판별은 S6                           | 가장자리가 24 CSS px보다 작을 수 있다. 닫힌 책 위에서는 바로 옆이 책 판정 영역이라 간격 예외가 어렵다(추정). (제안) 판정 영역을 보이는 가장자리보다 넓게 잡고 겹치는 부분은 레코드 우선 | (제안) 미끄러짐 없이 꺼낸 상태로 바꾸고 회전을 멈춘다. 일반 모션에서는 넣기가 정지 수단이다                     | 펼친 책에서는 오버레이 버튼. 닫힌 책에서 조작하면 회전할 때마다 레코드 투영 영역을 다시 계산한다(S6 비용)                                      |
| 부록 스티커 떼기                          | (제안) 스티커마다 버튼, Enter·Space로 뗀다. 옮기기가 생기면 "고르기 → 놓을 곳 고르기" 키 흐름이 따로 필요하다(U4)                      | (제안) `button`, 이름은 스티커 이름. 뗀 상태의 노출 방식은 뗀 뒤 상태 결정 뒤                                                                                                      | 지금은 드래그 전용이라 대안이 필요하다. 방식은 사용자 결정(U11). 옮기기가 생기면 "고르기 → 놓을 곳 고르기" 흐름도 필요하다 | 스티커 크기·간격 미정. 시트에 촘촘하면 간격 예외를 잰다                                                                                                                                 | (제안) 말림 곡면 없이 상태 전환. 포인터·기울기 연동 광택을 끈다(4장 기울기 입력)                                | α는 오버레이 버튼. β에서 시트 쪽만 WebGL이면 그 쪽에만 오버레이                                                                                |
| 판권면 링크·연락처                        | 링크면 Tab·Enter. 링크 여부 자체가 미정(plan.md 판권면은 평문만 적는다)                                                                | 네이티브 `<a href>`. 이름은 보이는 글자 그대로([2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)). 연락처 공개 범위는 사용자 결정                            | 해당 없음                                                                                                                  | 목록형 링크는 문장 안 예외가 안 될 수 있다. 줄 간격이 24 CSS px 이상이면 간격 예외로 충족(추정)                                                                                         | 해당 없음                                                                                                       | 오버레이 `<a>`의 `:focus-visible`. (제안) hover·focus 표시는 텍스처를 다시 래스터하지 않고 오버레이에서 그린다. 넘김 영역과 겹치면 링크 우선   |
| 러닝 헤드(항목 미정, 쪽 번호를 넣는 경우) | 항목이 링크가 아니면 탭 정지가 없다. 항목 미정(plan.md 러닝 헤드)                                                                      | 캔버스 밖 DOM 텍스트. (제안) 갱신은 착지 때 1회, 잡는 순간 바꾸지 않는다. `03/24` 같은 표기에는 읽기용 문구를 함께 두고 보이는 숫자는 `aria-hidden`. live region으로 만들지 않는다 | 해당 없음                                                                                                                  | 링크가 생기면 판권면 행과 같다                                                                                                                                                          | 숫자 전환 모션이 생기면 끈다                                                                                    | 캔버스 밖 DOM이라 브라우저 기본 경로                                                                                                           |
| 책 닫기·처음으로                          | 미정(U5)                                                                                                                               | 미정                                                                                                                                                                               | 미정                                                                                                                       | 미정                                                                                                                                                                                    | 미정                                                                                                            | 미정                                                                                                                                           |

책 닫기·처음으로는 동작이 정의되지 않았다. 동작이 생기면 (제안) 오버레이 `button`으로 두고, 닫은 뒤 포커스는 닫힌 책 버튼으로 옮기며, 상태 영역에 1회 알리고, reduced motion이면 crossfade로 바꾼다.

#### 스파이크 통과 기준에 넣을 행 (제안)

| 스파이크               | 대응표 행                              | 통과 기준에 넣을 것                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 글자·사진 래스터    | 판권면 링크·연락처, 사진 보기          | 쉬는 상태에서 오버레이 글자와 포커스 표시가 텍스처 글자와 같은 자리(DPR 1·2·3, 재래스터 트리거 시나리오 뒤 포함). 브라우저 확대 200%에서 텍스처 글자가 함께 커짐. 래스터용 쪽 DOM이 접근성 트리에 두 번 나오지 않음 |
| S2 fold 모델           | 드래그 곡면 넘김, 클릭 넘김, 러닝 헤드 | reduced motion을 모델 입력으로 받아 같은 놓기 판정을 씀(단위 테스트). 입력 우선순위. 착지 때만 쪽 알림·쪽 번호 갱신. 넘김 전 포커스 이동과 inert                                                                    |
| S3 닫힌 책과 펼침 전환 | 닫힌 책 회전, 표지 펼치기              | 포스터→WebGL 교체, WebGL2 실패 대체 경로, 컨텍스트 손실 복구에서 같은 책 버튼·키·포커스 유지. 펼친 뒤 포커스 이동. reduced motion crossfade                                                                         |
| S4 부록 스티커 시트    | 부록 스티커 떼기                       | 드래그 없는 떼기 대안(U11 결정안)과 키보드 떼기가 동작함, reduced motion에서 말림과 연동 광택 끔                                                                                                                    |
| S5 재미 트랙           | 드래그 곡면 넘김                       | XPBD 플래그에서도 reduced motion 대체와 놓기 판정이 기본 경로와 같음                                                                                                                                                |
| S6 부록 레코드         | 부록 레코드 꺼내기                     | 클릭 꺼내기, `aria-expanded`, 판정 영역 24 CSS px, reduced motion 회전 정지, 로딩·실패 문구 노출                                                                                                                    |

책 닫기·처음으로는 U5 결정 뒤 S3 또는 5단계에 넣는다.

- 확인 방법(제안): 판정 함수는 단위 테스트로 고정한다. E2E는 오버레이 DOM을 `getByRole`로 단언하고 `page.emulateMedia({ reducedMotion: 'reduce' })`로 대체 동작을 본다(선례 `apps/quant/e2e/operations.spec.ts`). 판정 영역 크기는 `boundingBox()`로 잰다(선례 `apps/blog/stories/button-target-size.spec.ts`). 키보드만으로 닫힌 책에서 판권면까지 가는 시나리오를 하나 둔다.
- 실기기 스크린리더(제안): iOS·macOS VoiceOver, Android TalkBack, Windows NVDA. 0장 매트릭스와 같이 확인한 조합만 기록한다.
- 자동 검사 통과는 포커스 표시 대비를 보증하지 않는다. 대비는 U8 결정 뒤 실측한다.

#### 사용자 판단 대기

결론이나 추천이 아니라 선택지와 비용만 적는다.

| ID  | 항목                                        | 선택지                                                                                                                                                                                 | 근거·비용                                                                                                                                                                                                                                                                                                                                            | 시점                                |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| U1  | 닫힌 책 회전의 드래그 없는 대안(2.5.7)      | (a) 책 가장자리·책등 쪽 탭은 회전, 가운데 탭은 펼침 (b) 회전 컨트롤을 화면에 둔다 (c) 뒤표지·책등 정보를 펼친 책 안 다른 자리에서도 보인다 (d) 끝까지 넘기면 책이 닫혀 뒤표지가 보인다 | (a) "드래그는 돌려보기, 클릭은 펼치기"(plan.md 흐름)에 세 번째 판정이 생기고 발견이 어렵다 (b) "화면에 잡지에 없는 UI를 만들지 않는다"(plan.md 나에 대한 정보)와 부딪힌다 (c) 정보가 두 곳에 생긴다. 2.5.7은 기능이 같으면 다른 컴포넌트여도 된다고 하므로 기능을 "정보 보기"로 볼 수 있는지가 관건이다(해석) (d) U5에 의존하고 책등은 보이지 않는다 | G3                                  |
| U2  | 닫힌 책에서 부록 레코드 조작 여부           | (a) 닫힌 상태에서도 꺼낸다 (b) 펼친 뒤 뒤표지 안쪽에서만 꺼낸다                                                                                                                        | (a) 탭 정지가 하나 늘고, 판정 영역이 책과 겹치며, 회전마다 레코드 위치를 추적한다 (b) 닫힌 책 입력 규칙이 둘로 유지되고, 닫힌 책의 레코드는 보이기만 한다                                                                                                                                                                                            | G3                                  |
| U3  | 사진 보기 범위                              | (a) 쪽 안에서 보기만 (b) 탭하면 확대 (c) 펼침면 전체로 보기                                                                                                                            | (a) 책 영역 `touch-action: none`(0장 구현 규칙) 때문에 모바일에서 핀치 확대가 막힌다 (b)(c) 텍스처 해상도 상한(S1), 제스처 우선순위(S2), 대화상자식 포커스 관리가 늘어난다                                                                                                                                                                           | G1                                  |
| U4  | 뗀 스티커의 행방(plan.md 스티커)            | (a) 시트 안에서만 (b) 다른 쪽에 붙인다                                                                                                                                                 | (b)는 키보드 배치 흐름, 붙인 위치의 스크린리더 노출, 저장 범위가 생기고 S1 α/β 비교의 전제가 바뀐다(1장)                                                                                                                                                                                                                                             | G1                                  |
| U5  | 책 닫기·처음으로·URL 상태                   | (a) 두지 않는다 (b) 끝 쪽에서 더 넘기면 닫힌다 (c) 러닝 헤드 항목 (d) 키(Esc, Home)                                                                                                    | (a) 처음으로 돌아가는 방법이 새로고침뿐이다 (b) 끝 쪽 넘김 버튼의 의미가 바뀐다 (c) 러닝 헤드 항목과 탭 정지가 늘어난다 (d) Esc는 대화상자 닫기로 익숙한 키다. 어느 쪽이든 브라우저 뒤로가기와의 관계를 함께 정한다                                                                                                                                  | G3(닫기를 S3 전환 모델에 넣기 위해) |
| U6  | 기울기 광택 권한                            | (a) 포인터·터치 입력만 (b) 스티커를 처음 누를 때 권한을 묻는다 (c) 권한 버튼을 둔다(4장 기울기 입력 원안)                                                                              | (a) 기울기 효과가 없다 (b) 버튼은 없지만 첫 탭에 OS 권한 창이 갑자기 뜬다. 거절하면 포인터로 대체한다 (c) "화면에 잡지에 없는 UI를 만들지 않는다"와 부딪힌다. 셋 다 reduced motion이면 연동 광택을 끈다(제안)                                                                                                                                        | S4 판정 전                          |
| U7  | reduced motion에서 드래그 넘김 중 보이는 것 | (a) 놓을 때까지 그대로 (b) 쪽이 평면으로 따라 움직인다 (c) 투명도만 바뀐다                                                                                                             | 위 항목은 "곡면을 끈다"만 정했다. (a) 드래그 피드백이 없다 (b) 평면 이동도 모션 애니메이션이다 (c) 2.3.3의 모션 애니메이션이 아니다                                                                                                                                                                                                                  | G2                                  |
| U8  | 보이는 모습                                 | 포커스 표시, 넘김 영역 표시, 키보드를 쓸 때만 표시를 보일지, 키 안내                                                                                                                   | 스파이크는 임시 외곽선으로 진행할 수 있다(제안). 대비 실측은 결정 뒤                                                                                                                                                                                                                                                                                 | G0 이후, G5 전                      |
| U9  | 문구                                        | 버튼 이름, 쪽 알림 형식, 사진 대체 텍스트                                                                                                                                              | 개발 중에는 임시 문구를 쓴다(제안). 사이트 언어는 폰트 서브셋 범위와 함께 G1에서 정한다([open-decisions.md](./open-decisions.md))                                                                                                                                                                                                                    | G5                                  |
| U10 | 목표 준수 수준                              | (a) WCAG 2.2 AA + 2.3.3(AAA) (b) AA만 (c) 그 이상                                                                                                                                      | 이 표는 (a)를 가정했다(위 항목이 2.3.3을 인용). (b)면 reduced motion 대응이 준수 요건에서 빠진다                                                                                                                                                                                                                                                     | G1                                  |
| U11 | 스티커 떼기의 드래그 없는 대안(2.5.7)       | (a) 탭 한 번으로 떼기 (b) 길게 누르기 (c) 별도 컨트롤                                                                                                                                  | (a) 첫 탭이 U6 (b)의 권한 요청과 겹칠 수 있다 (b) 발견이 어렵다 (c) "화면에 잡지에 없는 UI를 만들지 않는다"와 부딪힌다. 키보드 대안만으로는 2.5.7을 충족하지 않는다                                                                                                                                                                                  | S4 판정 전                          |

#### 미확인

- 포인터를 따라 도는 직접 조작이 2.3.3의 모션 애니메이션에 들어가는지. Understanding 문서에 명시가 없다.
- 포커스된 요소가 inert가 될 때 브라우저별로 포커스가 어디로 가는지(Safari 포함).
- VoiceOver·TalkBack의 더블탭이 `touch-action: none`과 pointer capture가 걸린 책 영역에서 오버레이 요소를 정상으로 누르는지.
- α의 텍스처 글자가 1.4.4(이미지 글자는 제외)와 [1.4.12 Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) 관점에서 글자로 다뤄지는지. 브라우저 확대는 다시 래스터해서 따라갈 수 있지만, 사용자 스타일시트·글자 간격 조정이 텍스처에 반영되는지는 래스터 방식에 달렸다(추정). β는 쉬는 상태가 DOM이라 해당하지 않는다.
- 펼친 책 안의 레코드 버튼을 닫힌 책 레코드의 2.5.8 "같은 페이지의 동등 컨트롤"로 볼 수 있는지.
- iOS Safari 페이지 확대가 데스크톱 브라우저 확대처럼 DPR과 레이아웃을 바꾸는지.

## 8. 라이선스 주의

| 대상                                  | 라이선스      | 취급                     |
| ------------------------------------- | ------------- | ------------------------ |
| ryOS                                  | AGPL-3.0      | 코드 사용 금지           |
| turn.js                               | 비상업 조항   | 사용 금지                |
| wawa-sensei r3f book slider           | 라이선스 없음 | 코드 사용 금지           |
| 4rknova foil sticker                  | CC-BY-NC      | 원리만 참고              |
| mantine-book, hic-pageflip, page-flip | MIT           | 참고 가능. 가져오면 고지 |

## 9. 스파이크 계획 (구현 들어갈 때)

시각 방향을 정한 뒤 아래 순서로 작게 확인한다. 통과 기준의 "선명도"는 수치 비교와 함께 사용자가 직접 보고 판단한다. 모든 스파이크는 0장의 실기기 매트릭스에서 같은 동작을 확인해야 통과다.

2026-11-13 준비도 리뷰에서 스파이크가 다루지 않는 요소(사진 텍스처, 재래스터, 닫힌 책 회전, 펼침 전환, 부록 레코드)가 나와 각 항목에 **보강 제안**을 덧붙이고 S6을 신설 제안했다. 보강 제안은 엔지니어링 제안이며 확정이 아니다. 모든 스파이크 통과 기준에는 7장 요소별 대응표의 해당 행이 들어간다.

1. **S1 글자 래스터:** 같은 HTML 페이지를 DOM과 foreignObject 텍스처로 DPR 1·2·3에서 그려 비교한다. 한글 10–12px 작은 글자(판권면 평문·표지 정보처럼 페이지와 표지 안에 들어가는 글자. 쪽 번호는 11-13부터 책 바깥 러닝 헤드의 후보 항목이고, 쪽 안에도 쪽 번호를 두기로 하면 대상에 넣는다)를 포함하고, 쉬는 상태·움직이기 시작·중간·착지를 본다. 같은 텍스처가 브라우저마다 같은 글자 모양으로 나오는지(0장 실기기 매트릭스), Safari 첫 로드 폰트 버그, 사진 CORS도 확인한다. HTML-in-Canvas 텍스처는 foreignObject 결과와 같은지만 비교하고, 다르면 쓰지 않는다. α와 β를 같은 무게로 비교해 하나를 여기서 고른다(1장 11-13 변경).
   - 보강 제안: 사진 텍스처도 DOM `<img>`와 DPR 1·2·3에서 비교한다. 쉬는 중 재래스터 시나리오(DPR 변경, 회전, Fold 접기·펴기, 모바일 주소창)와 폰트 임베드 비용을 측정한다. 결론은 "스티커는 부록 시트 안에만 있다"는 조건부로 기록한다.
2. **S2 fold 모델:** 순수 TS 모델(반사 접힘, 책등 제한, 진행도, 놓기 판정, 가상 포인터 경로)을 단위 테스트로 고정한다. 평면 DOM 접힘으로 감각 기준선을 잡은 뒤 WebGL2 원통 셰이더를 얹는다. 중급 Android, iPhone, Fold 펼침 상태에서 프레임 시간을 잰다. DPR 상한도 여기서 정한다.
   - 보강 제안: 펼침면 배치(좌우 두 쪽, 세로 화면 대안)를 매개변수로 둬서 세로 화면 결정 전에도 착수할 수 있게 한다. 같은 면에서 겹치는 입력(넘김과 링크·스티커·레코드)의 우선순위를 모델에 넣는다. 넘김 중 재래스터 시나리오(1장)도 여기서 잰다.
3. **S3 닫힌 책:** CSS 포스터에서 WebGL로 깜빡임 없이 교체되는지, 첫 화면 무게가 ryo.lu와 비교해 어떤지, 클릭 즉시 펼쳐지는지 확인한다.
   - 보강 제안(이름을 "닫힌 책과 펼침 전환"으로): 닫힌 책 회전 규칙(드래그와 클릭 판별, 회전 범위, 놓은 뒤 동작), 표지 열림부터 펼침면까지(원근 카메라에서 1:1 쉬는 카메라로) 글자 크기·선명도가 이어지는지, WebGL2 컨텍스트 생성 실패 대체 경로와 컨텍스트 손실 복구.
4. **S4 스티커:** 떼기, 광택 셰이더, 빌드 타임 SDF die-cut, 기울기 권한 흐름.
5. **S5 재미 트랙:** XPBD(JS)를 원통 대체 플래그로 붙인다. 책등은 long-range attachment로 고정하고, 잡은 정점을 고정하고, 바닥 충돌을 넣고, 10–15 substep으로 돌린다. 체감이 낫고 예산 안일 때만 채택한다. 프레임당 2ms를 넘으면 Rust raw export + SIMD WASM으로 옮겨본다.
6. **S6 부록 레코드 (신설 제안):** 닫힌 책을 돌릴 때 뒤표지 안쪽 레코드 가장자리가 보이는지, 꺼내기 제스처가 회전·펼침과 구분되는지, 레코드가 도는 동안의 렌더 정책(쉴 때 rAF를 돌리지 않는다는 원칙과의 관계), Spotify 데이터 경로(10장)와 실패·로딩 표시를 확인한다. 레코드 연출 자체는 사용자 결정이다.

측정 항목·후보 임계값, 스파이크 코드 위치·테스트 경계, 결과 기록은 [spikes.md](./spikes.md)에 있다(2026-11-13 제안).

## 10. 사진과 Spotify 데이터 경로 (2026-11-13 조사)

읽기 전용 조사 메모다. 저장소 코드와 문서를 읽었고, 공개 이미지 CDN에는 응답 헤더를 직접 요청해 확인했다. 어느 경로를 쓸지는 사용자 제품 결정이다. 그래서 결론을 쓰지 않고 후보별 비용과 제약만 적는다. 엔지니어링 제안은 "(제안)"으로 표시한다. 시점 표기 G0–G5는 [open-decisions.md](./open-decisions.md)와 같다. 저장소 상태 절의 11-13 Spotify 항목은 이 장에서 자세히 다룬다.

### 10.1 stickerbook 쪽 요구

| 요구                                                      | 근거                      | 데이터 경로에 걸리는 조건                                                                                                                                                                                   |
| --------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 넘기는 동안 사진은 WebGL 텍스처가 된다(α는 쉬는 동안에도) | 1장 α·β                   | 교차 출처 텍스처는 CORS 승인이 필요하다. 교차 출처 이미지를 그려 오염된 2D 캔버스도 텍스처로 쓸 수 없다([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL)) |
| foreignObject 래스터는 이미지를 data URL로 인라인한다     | 1장 foreignObject 폴백    | 라이브러리가 이미지를 fetch한다. 교차 출처면 CORS가 필요하다                                                                                                                                                |
| HTML-in-Canvas(재미 트랙)                                 | 1장 HTML-in-Canvas 상태   | 교차 출처 이미지는 그리지 않는다. CORS를 승인한 이미지는 그리는지 미확인이다                                                                                                                                |
| 텍스처 = 페이지 CSS 크기 × 실제 DPR                       | 1장 공통 원칙             | 원본이 "표시 크기 × DPR"보다 작으면 DOM과 텍스처 모두 확대되어 보인다(10.4)                                                                                                                                 |
| 스티커(fursona)는 투명 배경이다                           | 4장 die-cut               | 알파를 보존하는 경로가 필요하다                                                                                                                                                                             |
| EXIF를 보이지 않는다                                      | [plan.md](./plan.md) 사진 | 화면 표시만 뺐다. 파일 안의 GPS 같은 메타데이터를 지우는지는 경로마다 따로 확인한다                                                                                                                         |
| 사진 목록·순서·크기·alt                                   | 7장 접근성                | 어느 경로든 stickerbook 쪽 데이터로 둔다. admin manifest에는 alt가 없다(10.2)                                                                                                                               |

1장 HTML-in-Canvas 상태에 있는 "사진은 동일 출처로 서빙한다"는 11-12에 쓴 문장이다. 아래 사진 후보 (b)와 맞지 않으므로 경로가 정해지면 함께 고친다.

### 10.2 저장소 사실: admin → R2 → img.wannysim.com

| 항목       | 값                                                                                                                                              | 근거                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 공개 URL   | `https://img.wannysim.com/blog/<asset-id>/content-v1/image.jpg`와 `image.webp`. asset-id는 canonical JPEG의 SHA-256(64자리)이다                 | `apps/admin/src/entities/image/image-upload.ts`, `apps/admin/docs/architecture.md` |
| 출력       | JPEG(q82, 4:2:0, progressive)와 WebP(q79) 한 쌍                                                                                                 | image-upload.ts                                                                    |
| 크기       | 1600×1600 안에서 비율을 유지하고 확대하지 않는다. 크기 단계 없이 rendition은 1개다. 블로그는 Next Image가 크기별로 다시 변환한다                | image-upload.ts, architecture.md                                                   |
| 입력 한도  | JPEG·PNG·WebP·AVIF·정적 GIF. 최대 32 MiB, 50 MP                                                                                                 | `apps/admin/README.md`                                                             |
| 색 공간    | `toColourspace('srgb')`로 sRGB로 바꾸고 EXIF·GPS·ICC·XMP를 남기지 않는다. Display P3 원본은 sRGB로 줄어든다                                     | image-upload.ts, architecture.md                                                   |
| 알파       | `flatten({ background: '#ffffff' })`로 투명 배경을 흰색으로 합성한다                                                                            | image-upload.ts, README.md                                                         |
| 캐시       | 공개 객체 메타데이터에 `Cache-Control: public, max-age=31536000, immutable`을 둔다                                                              | `apps/admin/src/shared/lib/r2-store.ts`                                            |
| CORS       | public 버킷 CORS는 설정하지 않았다. private 버킷만 admin origin의 PUT을 허용한다                                                                | `apps/admin/docs/r2-setup.md`                                                      |
| WAF        | `img.wannysim.com`은 GET·HEAD만 받고 쿼리 문자열을 막는다. `/blog/`로 시작해 `/content-v1/image.jpg` 또는 `image.webp`로 끝나는 경로만 통과한다 | r2-setup.md                                                                        |
| 앱 영역    | writer와 보관함은 `blog/` prefix만 다룬다. 다른 앱은 `<app>/`을 형제로 추가하는 구조이고, 그때 WAF 허용 범위도 바꿔야 한다                      | architecture.md, r2-setup.md, r2-store.ts                                          |
| 발행 한도  | UTC 하루 20회, 최소 간격 5초. 블로그 writer 예약 장부는 8,000,000,000 bytes다                                                                   | architecture.md                                                                    |
| alt와 목록 | manifest에는 asset ID, 인코더, 크기, SHA-256만 담는다. alt는 복사용 스니펫에만 들어간다                                                         | architecture.md                                                                    |

공개 응답 실측(2026-11-13): r2-setup.md 검증 기록의 fixture URL 2건은 404였다. 블로그 about 페이지가 쓰는 발행 객체(`apps/blog/app/[locale]/(main)/(content)/about/page.tsx`의 `PROFILE_IMAGE`에 `/image.jpg`)는 `Origin` 헤더가 있든 없든 200과 `cache-control: public, max-age=31536000, immutable`을 돌려줬고, `Access-Control-*`와 `Vary` 헤더는 없었다. 문서대로 public CORS는 설정돼 있지 않다.

### 10.3 샘플 사진

`apps/stickerbook/public/photos`의 6장은 Unsplash에서 받은 1200px 파생 JPEG다([public/assets.md](./public/assets.md)). 2026-11-13 실측 결과 6장 모두 sRGB ICC가 들어 있고 EXIF는 없으며 progressive JPEG다.

| 파일         | 픽셀      | 비율      | 용량  |
| ------------ | --------- | --------- | ----- |
| deer.jpg     | 1200×1981 | 세로 0.61 | 581KB |
| forest.jpg   | 1200×799  | 가로 3:2  | 335KB |
| lake.jpg     | 1200×800  | 가로 3:2  | 235KB |
| meadow.jpg   | 1200×800  | 가로 3:2  | 53KB  |
| mountain.jpg | 1200×800  | 가로 3:2  | 270KB |
| night.jpg    | 1200×801  | 가로 3:2  | 224KB |

- `public/`의 파일은 해시 없이 `dist`로 그대로 복사된다. 로컬 `dist/photos`와 `dist/assets.md`로 확인했다.
- 실제 사진과 fursona 자산은 아직 없다([plan.md](./plan.md)).

### 10.4 해상도 대조

필요한 원본 긴 변(px)은 사진을 표시하는 긴 변(CSS px)에 DPR을 곱한 값이다. 사진 표시 크기는 아직 정하지 않았다([plan.md](./plan.md) "사진을 충분히 감상할 크기"). 아래 CSS 크기는 비교용 가정이다.

| 표시 긴 변 (가정) | DPR 1 | DPR 2 | DPR 3 |
| ----------------- | ----- | ----- | ----- |
| 200 CSS px        | 200   | 400   | 600   |
| 400 CSS px        | 400   | 800   | 1200  |
| 600 CSS px        | 600   | 1200  | 1800  |
| 800 CSS px        | 800   | 1600  | 2400  |

- 샘플의 긴 변은 1200px(deer만 1981px)이고 admin rendition 상한은 1600px다. 상한을 넘는 칸에서는 DOM과 텍스처 모두 확대되어 보인다.
- admin 상한은 긴 변 기준이라 세로 사진은 폭이 더 줄어든다. 예를 들어 deer 비율이면 969×1600이 된다.
- 원본 해상도는 전송량과 사진의 디테일을 정한다. 페이지 텍스처 메모리는 페이지 CSS 크기 × DPR로 정해지므로 원본 크기와 무관하다. 단, 사진만 따로 텍스처로 올리는 구조라면 원본 크기의 영향을 받는다.
- "사진 보기"에 확대가 생기면 필요한 원본 크기는 확대해서 보이는 크기를 기준으로 한다. 확대를 둘지는 아직 정하지 않았다.
- DPR 3에서 DOM `<img>`와 텍스처의 차이를 판별하려면 1200px보다 큰 원본이 필요하다(추정). S1 글자·사진 래스터의 입력 조건이다.

### 10.5 사진 경로 후보

- **(a) 앱에 커밋:** 저장소에 넣어 빌드에 포함한다. 빌드 타임 리사이즈와 메타데이터 제거를 넣을지는 하위 선택이다.
- **(b) admin → R2 직접 참조:** 페이지가 `img.wannysim.com` URL을 그대로 쓴다.
- **(c) 동일 출처 프록시:** stickerbook 배포의 rewrite가 이미지 경로를 `img.wannysim.com`으로 넘긴다. 받는 바이트는 (b)와 같다.

| 기준                 | (a) 앱에 커밋                                                                                                                                                                                 | (b) R2 직접 참조                                                                                                                                                                                                                                     | (c) rewrite 프록시                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 브라우저 기준 출처   | 동일 출처                                                                                                                                                                                     | 교차 출처                                                                                                                                                                                                                                            | 동일 출처                                                                                                                                                |
| 텍스처·인라인용 CORS | 필요 없다                                                                                                                                                                                     | public 버킷에 CORS 정책이 필요하다(현재 미설정). 사용자가 Cloudflare 대시보드의 R2 버킷 Settings, CORS Policy에서 추가한다. 이미 캐시된 객체에는 퍼지 전까지 새 헤더가 붙지 않는다([Cloudflare](https://developers.cloudflare.com/r2/buckets/cors/)) | 필요 없다                                                                                                                                                |
| CORS 캐시 함정       | 없다                                                                                                                                                                                          | R2는 `Origin`이 없는 요청에 CORS 헤더를 붙이지 않는다(같은 문서). 같은 URL을 `crossOrigin` 없이 먼저 받은 캐시가 다시 쓰이면 실패할 수 있다(추정). WAF가 쿼리 문자열을 막아 `?v=` 같은 우회도 쓸 수 없다                                             | 없다                                                                                                                                                     |
| HTML-in-Canvas       | 그린다                                                                                                                                                                                        | 미확인                                                                                                                                                                                                                                               | 그린다(추정)                                                                                                                                             |
| 크기 단계            | 빌드 스크립트로 원하는 단계를 만들 수 있다. stickerbook에는 이미지 처리 의존성이 없다. 저장소에는 admin이 쓰는 sharp 0.35.5가 있다                                                            | 1600px rendition 1개다. 단계를 늘리려면 admin 인코딩 계약(`content-v2` 등)과 WAF 허용 경로를 바꿔야 한다                                                                                                                                             | (b)와 같다                                                                                                                                               |
| 색 공간              | 처리 방식에 따라 ICC를 보존(P3 유지)하거나 sRGB로 바꿀 수 있다                                                                                                                                | sRGB로 바뀌고 ICC가 없다                                                                                                                                                                                                                             | (b)와 같다                                                                                                                                               |
| 알파(스티커)         | 보존할 수 있다                                                                                                                                                                                | 흰 배경으로 합성되어 스티커에 쓸 수 없다                                                                                                                                                                                                             | (b)와 같다                                                                                                                                               |
| GPS 등 메타데이터    | 커밋 전이나 빌드 때 직접 지워야 한다. 저장소가 공개 저장소다(2026-11-13 `gh repo view`로 확인). 원본을 커밋하면 Git 이력에 남는다                                                             | 발행할 때 제거된다                                                                                                                                                                                                                                   | (b)와 같다                                                                                                                                               |
| 캐시 헤더            | `public/`의 파일은 이름에 해시가 없어 immutable을 걸기 어렵다. `src`에서 import하면 `/assets/` 아래 해시 파일이 되므로 lattice·karaoke `vercel.json`의 `/assets/` immutable 선례를 쓸 수 있다 | 객체에 1년 immutable이 걸려 있다                                                                                                                                                                                                                     | 배포 CDN이 업스트림 캐시 헤더를 따른다. Vercel은 2026-04-06 이후에 만든 프로젝트에서 이것이 기본이다([Vercel](https://vercel.com/docs/routing/rewrites)) |
| 사진 추가 절차       | 커밋하고 배포한다                                                                                                                                                                             | admin에서 발행(하루 20회)한 뒤 stickerbook의 사진 목록을 고쳐 배포한다                                                                                                                                                                               | (b)와 같다                                                                                                                                               |
| 앱 영역              | 해당 없다                                                                                                                                                                                     | `blog/` prefix를 같이 쓰면 블로그 보관함과 용량 장부를 공유한다. `stickerbook/` prefix를 쓰려면 admin 코드와 WAF 규칙을 바꿔야 한다(WAF는 사용자가 Cloudflare UI에서 바꾼다)                                                                         | (b)와 같다                                                                                                                                               |
| 로컬 dev·E2E         | 그대로 동작한다                                                                                                                                                                               | 외부 네트워크에 의존한다. CORS 정책에 로컬 origin도 넣어야 한다                                                                                                                                                                                      | Vite `server.proxy`로 같은 경로를 흉내 낸다. `preview.proxy`의 기본값은 `server.proxy`다([Vite](https://vite.dev/config/preview-options))                |
| 호스팅 의존          | 없다                                                                                                                                                                                          | 없다                                                                                                                                                                                                                                                 | stickerbook 호스팅(미정)이 rewrite를 지원해야 한다                                                                                                       |
| 그 밖의 비용         | 사진 수 × 단계 수만큼 Git 바이너리가 쌓인다                                                                                                                                                   | 블로그 이미지 파이프라인과 묶인다                                                                                                                                                                                                                    | 전송이 배포 CDN을 한 번 더 거친다. 호스팅 전송량에 잡힌다(추정)                                                                                          |

(b)나 (c)를 고르면 스티커는 (a) 방식의 별도 경로로 들여와야 하므로 자산 경로가 두 개가 된다.

### 10.6 저장소 사실: 블로그 now-playing

| 항목            | 값                                                                                                                                                                                                                                                                                                                                                  | 근거                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 경로            | `GET /api/spotify/now-playing`. proxy matcher가 `api`를 제외하므로 locale prefix가 붙지 않는다                                                                                                                                                                                                                                                      | `apps/blog/app/api/spotify/now-playing/route.ts`, `apps/blog/proxy.ts`                                                             |
| 인증            | refresh token grant를 쓴다. 런타임 env는 `SPOTIFY_CLIENT_ID`·`SPOTIFY_CLIENT_SECRET`·`SPOTIFY_REFRESH_TOKEN`이다. access token은 인스턴스 메모리에 캐시하고 만료 5분 전에 갱신한다. 401을 받으면 한 번 강제 갱신한 뒤 재시도한다                                                                                                                    | `apps/blog/src/entities/spotify/api/spotify.ts`                                                                                    |
| 조회 순서       | 먼저 `/v1/me/player`를 부른다. 204거나 상태 코드가 400보다 크면 `recently-played?limit=1`로 대체한다                                                                                                                                                                                                                                                | spotify.ts                                                                                                                         |
| 응답            | 항상 200 `{ data, timestamp }`다. `data`는 `null`이거나 `isPlaying`, `title`, `artist`, `album`, `albumImageUrl`, `songUrl`, `isExplicit`, `progressMs`, `durationMs`, `device`(이름과 종류)를 담는다                                                                                                                                               | route.ts, spotify.ts                                                                                                               |
| 실패            | env 누락, 토큰 실패, API 오류, 최근 재생 없음, 예외가 모두 `data: null` 하나로 나와 원인을 구분할 수 없다. 현재 재생 트랙 문서상 `item`은 null일 수 있다. 코드가 부르는 `/v1/me/player`(Get Playback State)에서도 같은지는 미확인이다. 코드는 `song.item.name`을 바로 읽는다. 이때 난 예외가 잡혀 결과가 `null`이 된다(코드 읽기로 확인, 실측 아님) | spotify.ts, [Spotify Web API](https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track) |
| 캐시            | 재생 중이거나 `null`이면 `no-store, no-cache, must-revalidate`, 일시정지면 `public, s-maxage=30, stale-while-revalidate=120`, 최근 재생이면 `public, s-maxage=60, stale-while-revalidate=300`이다                                                                                                                                                   | route.ts                                                                                                                           |
| CORS            | 라우트에도 `next.config.mjs`의 `headers()`에도 `Access-Control-*`가 없다                                                                                                                                                                                                                                                                            | route.ts, `apps/blog/next.config.mjs`                                                                                              |
| 배포            | 운영 `https://wannysim.com`은 Cloudflare 프록시 뒤의 홈서버 Docker다. develop·main의 green 커밋을 `promote.yml`이 GHCR에 올리면 Watchtower가 반영한다. `dev.wannysim.com`은 Vercel이다(`vercel.json`상 develop만 자동 배포). Spotify env는 홈서버 스택에 있다                                                                                       | `.github/workflows/promote.yml`, `apps/blog/vercel.json`, `apps/blog/docs/home-server-migration.md`                                |
| 클라이언트 선례 | SWR로 폴링한다(재생 중 10초, 일시정지 30초, focus·reconnect 때 재검증). 문서 가시성을 구독한다. 위젯은 앨범 아트를 모서리가 둥근 사각형으로 두고 아트가 없는 원반만 돌린다. 곡이 바뀔 때 아트에 0.4s `fadeInScale` 전환을 건다(reduced motion이면 끈다, `spotify-vinyl.tsx`). `songUrl` 링크와 Spotify 아이콘을 둔다                                | `apps/blog/src/features/spotify-polling/hooks/use-spotify-polling.ts`, `apps/blog/src/widgets/spotify-vinyl/ui/`                   |
| stickerbook     | 서버 코드, `vercel.json`, Vite proxy 설정이 모두 없다                                                                                                                                                                                                                                                                                               | `apps/stickerbook/vite.config.ts`, `apps/stickerbook/package.json`                                                                 |

Cloudflare가 `/api` JSON 응답을 `s-maxage`대로 캐시하는지는 저장소에 기록이 없다(미확인).

앨범 아트 실측: 2026-11-13에 `i.scdn.co/image/...` 2건(300px·640px 판)과, Spotify oEmbed가 돌려주는 `image-cdn-ak.spotifycdn.com` 1건을 `Origin` 헤더를 붙여 GET했다. 세 건 모두 `access-control-allow-origin: *`와 `cache-control: max-age=15780000`을 돌려줬다. 640px 판은 640×640 sRGB였다. 헤더만 보면 `crossOrigin="anonymous"`로 텍스처를 올리거나 인라인하는 데 막힘이 없다(실기기 미확인). 코드는 `album.images[0]`을 쓰고, Spotify 문서상 images는 가장 넓은 것부터 온다.

Spotify 표시 지침([Spotify Design](https://developer.spotify.com/documentation/design)):

- 아트를 자르지 않는다. 애니메이션을 넣거나 왜곡하지 않는다. 아트 위에 글자나 이미지를 겹치지 않는다.
- 모서리는 작은·중간 기기에서 4px, 큰 기기에서 8px로 둥글게 한다.
- Spotify 메타데이터(곡명과 아트 포함)는 Spotify로 링크하고, 로고로 출처를 표시한다.
- 지침 문구대로 읽으면 아트를 원형 라벨에 넣는 것은 자르기, 돌리는 것은 애니메이션, 곡면에 얹는 것은 왜곡에 해당한다. 예외로 볼 여지가 있는지는 미확인이다. 로고와 링크 요구는 [plan.md](./plan.md)의 "잡지에 없는 UI를 만들지 않는다" 기준과 함께 사용자가 판단할 입력이다.

### 10.7 Spotify 경로 후보

- **(a) 블로그 라우트에 CORS 허용 추가**
- **(b) stickerbook 전용 서버리스 함수**
- **(c) stickerbook 배포의 rewrite로 블로그 API를 동일 출처처럼 호출**

| 기준           | (a) 블로그 CORS                                                                                                                                                       | (b) 전용 함수                                                                 | (c) rewrite                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 바꿀 곳        | 블로그 라우트나 `next.config.mjs`의 `headers()`                                                                                                                       | stickerbook에 함수를 추가한다. 토큰·조회 로직은 복제하거나 공유 패키지로 뺀다 | stickerbook 배포 설정만 바꾼다. 블로그 코드는 그대로다                                                  |
| 반영 경로      | 블로그 promote(GHCR, Watchtower)                                                                                                                                      | stickerbook 배포                                                              | stickerbook 배포                                                                                        |
| 비밀값         | 블로그 한 곳에 둔다                                                                                                                                                   | Spotify 비밀값 3종을 stickerbook 배포에도 등록해 두 곳에서 관리한다           | 블로그 한 곳에 둔다                                                                                     |
| 브라우저 요청  | 교차 출처 GET이다. 커스텀 헤더 없이 GET하면 preflight가 없다                                                                                                          | 동일 출처                                                                     | 동일 출처                                                                                               |
| 허용 출처      | stickerbook 도메인이 미정이고 프리뷰 URL은 배포마다 바뀐다. `*`로 열면 아무 사이트나 호출할 수 있다. 특정 출처만 허용하면 공개 캐시에 `Vary: Origin`이 필요하다(추정) | 해당 없다                                                                     | 해당 없다                                                                                               |
| 캐시           | 블로그 응답 헤더를 그대로 쓴다                                                                                                                                        | 새로 정한다                                                                   | 배포 CDN이 업스트림 헤더를 따른다(Vercel 기준, 10.5의 문서)                                             |
| 장애 결합      | 홈서버 블로그가 내려가면 레코드도 실패한다                                                                                                                            | 블로그와 독립이다                                                             | 홈서버 블로그가 내려가면 레코드도 실패한다                                                              |
| Spotify 호출량 | 재생 중 응답은 no-store라 외부 호출이 그대로 Spotify 호출로 이어진다. 429가 나면 블로그 위젯도 `null`을 받는다(추정)                                                  | 같은 Spotify 앱 자격 증명을 쓰면 블로그와 호출 한도를 나눠 쓴다(추정)         | stickerbook 방문자 요청이 블로그로 합쳐진다                                                             |
| 응답 모양      | 블로그 계약을 따른다(`data: null`의 원인을 구분할 수 없다)                                                                                                            | 실패 원인과 로딩 상태를 구분하는 모양을 새로 정할 수 있다                     | 블로그 계약을 따른다                                                                                    |
| 로컬 dev·E2E   | 운영 블로그를 직접 부르거나 mock을 쓴다                                                                                                                               | Vite dev에는 함수 런타임이 없어 플랫폼 CLI나 mock이 필요하다(추정)            | Vite `server.proxy`가 필요하다(`preview.proxy`는 이를 기본값으로 쓴다)                                  |
| 호스팅 의존    | 없다                                                                                                                                                                  | 함수를 돌릴 수 있는 호스팅이 필요하다                                         | rewrite를 지원하는 호스팅이 필요하다. Cloudflare 보안 설정이 데이터센터 IP의 요청을 막는지는 미확인이다 |

경로와 무관하게 걸리는 제약은 다음과 같다.

- 곡명과 아티스트는 임의 문자열이라 콘텐츠 기반 폰트 서브셋으로 덮을 수 없다. 서브셋 밖 글자 처리는 S1 글자·사진 래스터의 폰트 임베드 항목에서 같이 본다.
- foreignObject 경로는 정적 페이지를 전제로 한다. α에서는 곡이 바뀔 때마다 레코드 쪽 텍스처를 다시 래스터해야 한다. S6 부록 레코드의 렌더 정책 항목이다.
- 블로그가 내려간 경우(HTTP 오류)와 `data: null`(200)은 서로 다른 실패다. 각 경우와 로딩 중에 레코드가 무엇을 보일지는 미정이다.
- `device.name`에는 기기 이름이 들어 있다. 블로그 API로 이미 공개되는 값이며, 레코드에 보일지는 사용자 판단이다.
- 곡 정보와 사진 alt는 7장 원칙대로 캔버스 위 DOM 오버레이로 노출한다. 7장 대응표의 해당 행이 S1과 S6 통과 기준에 들어간다.
- (제안) 폴링은 레코드를 꺼냈고 문서가 보일 때만 돈다. E2E는 외부 네트워크 대신 Playwright route로 고정 응답을 준다. S6는 고정 응답 fixture로 시작하면 데이터 경로가 정해지기 전에도 착수할 수 있다.

### 10.8 이 결정이 막는 작업과 시점

- **G0 정지 화면 판단:** 경로 결정이 막는 작업은 없다. 다만 실제 사진의 가로·세로 분포(샘플은 6장 중 5장이 가로 3:2)는 정지 화면 비교에 들어가는 입력이다.
- **G1 S1 전:** 사진이 동일 출처인지 교차 출처인지에 따라 S1 "사진 CORS 확인"의 대상이 정해진다. 그 전에 정하지 못하면 S1 하네스가 동일 출처와 CORS를 승인한 교차 출처를 둘 다 돌린다(제안). DPR 3 비교에 쓸 고해상도 원본도 이때 필요하다.
- **G2 S2 전:** 막는 작업이 없다.
- **G3 S3 전:** 막는 작업이 없다. 닫힌 책의 레코드 가장자리는 데이터 없이 만든다. S4에는 사진 경로와 별개로 알파를 보존하는 스티커 자산 경로가 필요하지만, 대리 투명 PNG로 시작할 수 있다.
- **G4 5단계 전:** 사진 경로, 사진 목록·alt 데이터를 둘 곳, Spotify 경로가 정해져 있어야 한다. Spotify (b)·(c)는 stickerbook 호스팅 결정이 먼저다. 앨범 아트 연출이 Spotify 지침과 맞는지도 이때까지 판단한다.
- **G5 공개 전:** 사진 (b)라면 R2 CORS 정책 추가와 캐시 퍼지가 필요하다(사용자가 Cloudflare UI에서 한다). 사진 (a)라면 메타데이터 제거를 확인한다. 캐시 헤더를 설정하고 Spotify 로고·링크를 점검한다. CSP를 두면 `img-src`·`connect-src`에 고른 출처를 넣는다.

### 10.9 미확인

- R2 커스텀 도메인과 Cloudflare 캐시 조합에서, `Origin` 유무에 따라 CORS 헤더가 다른 응답이 캐시에 섞이는지.
- Cloudflare가 `wannysim.com/api` JSON을 캐시하는지, 데이터센터 IP의 요청을 막는지.
- Spotify 지침에 예외로 볼 여지가 있는지, Spotify 호출 한도 수치.
- HTML-in-Canvas가 CORS를 승인한 교차 출처 이미지를 그리는지(위 미확인 절과 같다).

## 미확인

- HTML-in-Canvas가 Chrome 157에서 플래그 없이 기본 활성인지, 교차 출처지만 CORS를 승인한 이미지가 그려지는지.
- Samsung Internet이 Xclipse GPU 폴더블에서 WebGPU를 켜는지, Surface Duo의 현재 브라우저 상황.
- macOS Safari 26의 WebGPU가 caniuse에서 "partial"로 표기된 이유.
- 10–12px 한글에서 SDF 품질의 정량 비교, troika 첫 글리프 생성 지연.
- iOS 기울기 권한이 세션마다 다시 묻는지, wasm-bindgen bundler 타깃이 Vite 8.1 ESM integration에서 그대로 동작하는지.
- 30×40 XPBD의 실제 모바일 프레임 비용. 위 수치는 모두 추정이다.

## 저장소 상태 (2026-11-12 조사, 11-13 보충)

- stickerbook에는 아직 배포 설정(`vercel.json`)이 없다. 다른 Vite 앱은 `vercel.json`으로 캐시 헤더를 건다. 헤더를 추가하면 로컬 `vite preview` 기반 E2E에는 적용되지 않으므로, 필요하면 Vite `preview.headers`에도 같이 둔다.
- (2026-11-13) 부록 레코드의 Spotify 정보: `apps/blog`에 `/api/spotify/now-playing`이 이미 있지만 CORS 헤더가 없고, stickerbook은 서버·배포 구성이 없다. 블로그 라우트 CORS, stickerbook 전용 함수, 배포 rewrite 중 하나가 필요하다. 후보와 비용은 10.7에 정리했다.
- `apps/blog`는 three 0.186.1을 쓴다. stickerbook에서 three를 넣을 때 버전을 맞출지 정한다.
- `apps/stickerbook/index.html`의 description이 아직 "책상 위 스티커북에서 만나는 작은 사진 전시"다. 책상(11-10에 뺌)과 스티커북 전시(11-13에 사진 잡지로 바뀜)를 모두 전제하므로 구현 때 고친다. 문구와 앱 이름(Stickerbook) 유지 여부는 사용자 확인 뒤 정한다([open-decisions.md](./open-decisions.md)).
