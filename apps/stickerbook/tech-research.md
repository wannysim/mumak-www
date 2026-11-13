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

## 권장 구조 (가설)

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

| 기술                        | 지원 범위                                        | 판단                                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebGL2                      | 97.3%, iOS Safari 포함                           | 유일한 기본 렌더 경로                                                                                                                                                                                               |
| WebGPU                      | 88.6%, Xclipse 폴더블 TBD                        | 쓰지 않는다                                                                                                                                                                                                         |
| HTML-in-Canvas              | Chrome 157만, iOS 불가                           | 기본 경로에서 제외. 브라우저마다 래스터 경로가 갈리면 Chrome과 Safari의 글자 모양이 달라질 수 있다. foreignObject를 공통 경로로 두고, S1에서 결과가 같다고 확인될 때만 성능·접근성 최적화로 선택한다                |
| foreignObject 사전 래스터   | 주요 브라우저 전부                               | 공통 경로. Safari 첫 로드 폰트 버그 우회를 실기기 iOS에서 반드시 확인한다                                                                                                                                           |
| Viewport Segments           | Chromium 계열만                                  | 레이아웃 적응이므로 허용. 미지원 브라우저의 폴더블에서도 화면 비율 기반 레이아웃이 같은 결과를 내야 한다                                                                                                            |
| DeviceOrientation           | 브라우저마다 권한 정책이 다름                    | 부가 효과로만. 포인터·터치로 같은 광택                                                                                                                                                                              |
| WASM SIMD                   | Baseline                                         | 허용                                                                                                                                                                                                                |
| WASM threads                | COOP/COEP 필요, `credentialless`는 Safari 미지원 | 쓰지 않는다                                                                                                                                                                                                         |
| `Memory.toResizableBuffer`  | Safari 26.2+                                     | 의존하지 않는다. 고정 크기 메모리                                                                                                                                                                                   |
| detect-gpu 기반 저사양 경로 | -                                                | 다른 경험이 되므로 원칙과 충돌한다. 대체 경로는 WebGL2 자체가 없는 환경(약 2.7%)으로 한정하고, 성능 차이는 같은 렌더 경로 안에서 격자 밀도·시뮬레이션 substep으로 흡수한다. 쉬는 상태 텍스처 해상도는 낮추지 않는다 |

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

**판단:** 스티커 떼기와 광택이 쉬는 상태에서 일어나므로 α를 기본 가설로 둔다. 텍스처 소스는 0장의 호환성 원칙에 따라 모든 브라우저에서 같은 foreignObject 경로를 기본으로 한다. 쉬는 상태의 선명도가 DOM 대비 허용 범위인지 스파이크 S1에서 사용자가 직접 보고 판단하고, 미달이면 β와 비교한다. 어느 쪽이든 공통 원칙은 이렇다.

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
- 안 그려지는 것: 교차 출처 `<img>`·`background-image`, 서브픽셀 AA, 방문 링크, 시스템 색 등. 사진은 동일 출처로 서빙한다.
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

## 2. 닫힌 책과 렌더링 스택

| 선택지                              | 크기 (gzip)               | 버전·유지                       | React 19          | 적합성                                     |
| ----------------------------------- | ------------------------- | ------------------------------- | ----------------- | ------------------------------------------ |
| three `WebGLRenderer` (tree-shaken) | 130.7KB (br 106.7KB)      | r187 (2026-10-30), 매우 활발    | 무관              | 최적. 책·곡면·`ShaderMaterial` 모두 가능   |
| three `WebGPURenderer`              | 224KB (br 179.5KB)        | 매뉴얼상 "still experimental"   | 무관              | 과함. `ShaderMaterial` 미지원이라 TSL 필요 |
| @react-three/fiber                  | 57.7KB (react·three 제외) | 9.8.2 (2026-10-14), v10은 alpha | peer `>=19 <19.4` | 선택. 씬 하나면 이점이 작다                |
| @react-three/drei                   | 전체 521KB, 개별 import   | 10.7.9                          | `^19`             | 필요한 헬퍼만                              |
| OGL                                 | 13.1KB (최소 셰이더)      | 1.0.11, 마지막 커밋 2025-04     | 무관              | 가볍지만 유지 정체                         |
| twgl.js                             | 11.2KB                    | 7.0.0                           | 무관              | 순수 WebGL 보조. 카메라·곡면 직접 구현     |
| CSS 3D                              | 0KB                       | 표준                            | 무관              | 첫 화면 포스터와 저사양 대체용             |

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
- **기기 성능 감지:** `@pmndrs/detect-gpu` 6.0.30(3.7KB gzip). 데이터 원천인 gfxbench가 2025-12에 갱신을 멈췄고, 기본 설정은 unpkg CDN에서 데이터를 받으므로 자체 호스팅이 필요하다. tier 0이거나 WebGL 컨텍스트 생성에 실패하면 CSS 3D 표지와 평면 넘김으로 대체한다.
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
  - Vite 8.1부터 wasm ESM integration이 코어에 들어왔다. 이 앱은 `vite ^8.3.1`이라 바로 쓸 수 있다. ([Vite 8.1](https://vite.dev/blog/announcing-vite8-1))
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
- HTML-in-Canvas를 못 쓰는 브라우저에서는 캔버스 위에 투명 DOM을 겹쳐 스크린리더·텍스트 선택·hit-test를 제공한다. ([Chrome 가이드](https://developer.chrome.com/docs/modern-web-guidance/guides/visual-design/expose-canvas-content-to-browser-features))

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

1. **S1 글자 래스터:** 같은 HTML 페이지를 DOM과 foreignObject 텍스처로 DPR 1·2·3에서 그려 비교한다. 한글 10–12px 작은 글자(쪽 번호·정보 문구)를 포함하고, 쉬는 상태·움직이기 시작·중간·착지를 본다. 같은 텍스처가 브라우저마다 같은 글자 모양으로 나오는지(0장 실기기 매트릭스), Safari 첫 로드 폰트 버그, 사진 CORS도 확인한다. HTML-in-Canvas 텍스처는 foreignObject 결과와 같은지만 비교하고, 다르면 쓰지 않는다. α와 β 중 하나를 여기서 고른다.
2. **S2 fold 모델:** 순수 TS 모델(반사 접힘, 책등 제한, 진행도, 놓기 판정, 가상 포인터 경로)을 단위 테스트로 고정한다. 평면 DOM 접힘으로 감각 기준선을 잡은 뒤 WebGL2 원통 셰이더를 얹는다. 중급 Android, iPhone, Fold 펼침 상태에서 프레임 시간을 잰다. DPR 상한도 여기서 정한다.
3. **S3 닫힌 책:** CSS 포스터에서 WebGL로 깜빡임 없이 교체되는지, 첫 화면 무게가 ryo.lu와 비교해 어떤지, 클릭 즉시 펼쳐지는지 확인한다.
4. **S4 스티커:** 떼기, 광택 셰이더, 빌드 타임 SDF die-cut, 기울기 권한 흐름.
5. **S5 재미 트랙:** XPBD(JS)를 원통 대체 플래그로 붙인다. 책등은 long-range attachment로 고정하고, 잡은 정점을 고정하고, 바닥 충돌을 넣고, 10–15 substep으로 돌린다. 체감이 낫고 예산 안일 때만 채택한다. 프레임당 2ms를 넘으면 Rust raw export + SIMD WASM으로 옮겨본다.

## 미확인

- HTML-in-Canvas가 Chrome 157에서 플래그 없이 기본 활성인지, 교차 출처지만 CORS를 승인한 이미지가 그려지는지.
- Samsung Internet이 Xclipse GPU 폴더블에서 WebGPU를 켜는지, Surface Duo의 현재 브라우저 상황.
- macOS Safari 26의 WebGPU가 caniuse에서 "partial"로 표기된 이유.
- 10–12px 한글에서 SDF 품질의 정량 비교, troika 첫 글리프 생성 지연.
- iOS 기울기 권한이 세션마다 다시 묻는지, wasm-bindgen bundler 타깃이 Vite 8.1 ESM integration에서 그대로 동작하는지.
- 30×40 XPBD의 실제 모바일 프레임 비용. 위 수치는 모두 추정이다.

## 저장소 상태 (2026-11-12)

- stickerbook에는 아직 배포 설정(`vercel.json`)이 없다. 다른 Vite 앱은 `vercel.json`으로 캐시 헤더를 건다. 헤더를 추가하면 로컬 `vite preview` 기반 E2E에는 적용되지 않으므로, 필요하면 Vite `preview.headers`에도 같이 둔다.
- (2026-11-13) 부록 레코드의 Spotify 정보: `apps/blog`에 `/api/spotify/now-playing`이 이미 있지만 CORS 헤더가 없고, stickerbook은 서버·배포 구성이 없다. 블로그 라우트에 CORS를 열거나 stickerbook 쪽 함수를 따로 둬야 한다.
- `apps/blog`는 three 0.186.1을 쓴다. stickerbook에서 three를 넣을 때 버전을 맞출지 정한다.
- `apps/stickerbook/index.html`의 description이 아직 "책상 위 스티커북에서 만나는 작은 사진 전시"다. 책상을 뺀 컨셉에 맞게 구현 때 고친다.
