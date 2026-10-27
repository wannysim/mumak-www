# Stickerbook prototype

## 현재 구현 방향 (2026-10-27)

관찰 기준은 손을 따라 움직이는 페이지, 놓았을 때의 완주·복귀, 작은 화면에서 읽을 수 있는 사진, 사진·스티커·페이지 제스처 간 충돌이다. 사용자가 실제 기기에서 판단할 프로토타입이며 최종 디자인 승인은 아니다.

정지 상태와 넘김 중 모두 같은 HTML을 사용한다. CSS `clip-path`로 앞·뒷면을 자르고, 12개 좁은 띠의 affine transform으로 말림을 근사한다. 평평한 부분은 원래 크기 그대로이며 뒷면 글자는 거울상이 되지 않는다. Three.js와 수동 Canvas 텍스처 경로는 제거했다. 원인·물리 책 모델·최신 검증은 [motion.md](./motion.md)를 따른다.

| 검토안                    | 판단                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Canvas 텍스처 해상도 증가 | 샘플링만 개선하며 CSS의 최소 글자 크기·레이아웃과 수동 그리기의 불일치는 남는다.                                 |
| HTML 캡처 후 텍스처       | 수동 배치 중복은 줄지만 비트맵으로 바뀌는 경계와 준비 시간이 남는다.                                             |
| HTML 앞뒷면 + CSS 곡면 띠 | 채택. CSS와 폰트·이미지 소스가 동일하며 정지/이동 중 표현의 이중화를 없앤다. 대신 곡면은 제한된 기하학적 근사다. |

최초 실험은 Three.js 0.180.0 + HTML이었다. 단일 CSS 3D 판은 곡률이 없었고, StPageFlip은 루프 정리와 portrait DOM 복제 비용 때문에 채택하지 않았다. 사용자가 실제 이동 중 텍스트 축소와 해상도 저하를 지적해 위 방식으로 교체했다. 최초 실험의 검증 수치는 아래 역사 기록이며 현재 렌더러의 증거로 사용하지 않는다.

시각 디자인은 사용자 피드백으로 흰 책상·주황 표지·크림슨 디테일의 미니멀 구성으로 수정했다. 헤더와 장식 문구를 제거하고 로컬 Pretendard를 사용한다. 레퍼런스·팔레트·페이지 배치 원칙은 [design.md](./design.md)를 따른다.

## 기기 대응

- 일반 화면: 가용 너비·높이에 맞춘 좌우 펼침. 회전·리사이즈 때 같은 두 페이지 유지. 좁아서 작아진 펼침과 실제 높이가 부족한 compact 구획은 구별한다.
- 좌우 분할 화면: segment의 경계와 실제 힌지 폭을 기준으로 책장을 배치. 힌지 위에 사진이나 조작 버튼을 놓지 않는다.
- 상하 분할 화면: 위쪽에 사진, 아래쪽에 조작부. 터치/키보드 대체 조작 제공.
- API 미지원: 일반 반응형으로 동작. UA/모델 이름으로 접힘을 추측하지 않는다.
- iPhone Duo: Safari 27.1의 posture/segments는 feature flag 뒤의 preview. 실물 호환성 검증으로 표현하지 않는다.

## 자료

- [Three.js r180 소스](https://github.com/mrdoob/three.js/tree/r180/src): PlaneGeometry, CanvasTexture, WebGLRenderer의 자원 정리 계약 확인.
- [StPageFlip 소스](https://github.com/Nodlik/StPageFlip): Render.start / PageFlip.destroy 검토.
- [Viewport Segments — Chrome](https://developer.chrome.com/blog/viewport-segments-api-shipped): window.viewport.segments 사용.
- [Safari 27.1 — WebKit](https://webkit.org/blog/18486/webkit-features-for-safari-27-1/): 화면 범위, feature detection, API preview 경계.

사진과 캐릭터는 프로토타입용 자산이다. 실제 fursona가 제공되기 전까지 임시 여우 스티커로 표시한다. 샘플 사진에 없는 EXIF는 만들어 내지 않고 미제공으로 표시한다. 스티커 변화는 현재 세션에만 유지한다.

## 최초 구현·검증 기록 (교체 전)

2026-10-27 최초 로컬 프로토타입 검증 기록. 현재 구현의 검증은 [motion.md](./motion.md)를 따른다:

- React/Vite 템플릿을 별도 앱에 복제. 패키지 `stickerbook`, Portless `stickerbook.mumak`, E2E `3008`. 앱 매트릭스·Codecov 등록.
- 샘플 사진 6장과 EXIF 미제공 표시, 확대/포커스 복귀, 책 덮기/펼치기, 페이지별로 고정된 불규칙한 스티커 위치.
- 스티커 slow/fast 입력에 따른 clean/residue, 재부착/전체 초기화. 위치 이동·책상에 재배치·영구 저장은 구현하지 않았다.
- 페이지 곡면은 기하학적 근사다. 종이·접착제의 정밀 물리 시뮬레이션이나 실제 힘·접힘 각도 센서가 아니다.
- 렌더링은 WebGL 곡면 → CSS 양면 대체 → 동작 줄이기/아주 낮은 화면 즉시 전환으로 구성했다. 설정 변경·회전은 진행 중 넘김을 취소한다.
- `check-types`, `lint`, `format:check`, `test:ci`, `build`, 앱 범위 Knip 통과. 단위 46개. coverage statements 98.14%, branches 94.17%, functions 94.18%, lines 99.74%.
- 빌드 결과 기반 Playwright: 18 passed / 6 skipped. 공통 5개 시나리오를 Chromium·Firefox·WebKit에서 실행했다. Chromium 전용 3개(실제 CDP segments, 실제 touch events, WebGL 곡면 확인)는 나머지 두 브라우저에서 skip했다.
- 320px 작은 화면, 390×844 휴대폰, 1024×768 태블릿, WebKit이 공개한 Duo viewport 크기 범위를 확인했다. 이는 크기 에뮬레이션이며 해당 기기 테스트를 의미하지 않는다.
- 실제 Chromium `viewport.segments`와 CSS media를 활성화한 CDP 에뮬레이션으로 좌우/상하/작은 상하 힌지를 검사했다. 사진·확대창·표지가 힌지를 넘지 않는 회귀 테스트를 남겼다.
- verifier가 찾은 모바일 reset 이름, 안내창 포커스 복귀, CSS 뒤쪽 거울상, 작은 tabletop 힌지 침범, touch 첫 탭 재부착, 좌우 split 표지 최소 너비 문제를 수정했다.
- 실제 폴더블/iPhone Duo/태블릿 하드웨어, Safari의 실험 API, OS 화면 확대·VoiceOver 음성 출력·GPU 전력/프레임 프로파일은 미검증이다. 화면 감각과 사용자 선호는 사용자가 실제 기기에서 판단한다.

최초 구현의 첫 로딩 JS는 약 101KB gzip, Three.js 동적 청크는 약 119KB gzip이었다. 현재 DOM 방식은 Three.js 청크가 없고 JS 약 100KB gzip이다. 폰트와 사진은 앱에 로컬로 포함했다. 서버 배포와 외부 공개는 수행하지 않았다.
