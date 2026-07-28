# karaoke

Vaundy 콘서트 예습용 모바일 노래방 웹앱. 공식 YouTube 음원을 재생하면서 타임스탬프 가사를
한 줄씩 하이라이트하고, 줄마다 일본어 · 한글 발음 · 한국어 번역을 토글해서 볼 수 있다.

## 사용법

- 헤더 좌우 화살표: 이전/다음 곡 (마지막 다음은 첫 곡으로 순환)
- 헤더 가운데 제목 탭: 곡 목록 시트
- 영상 영역 탭: 재생 / 일시정지
- 반복 버튼: 반복 없음 → 전체 반복(곡이 끝나면 다음 곡 자동재생, 마지막 다음은 첫 곡)
  → 한 곡 반복. 선택은 localStorage에 남는다
- 표시 토글: 日本語 / 발음 / 번역 on·off (localStorage 저장, 최소 하나는 유지)
- 테마 버튼: 다크 ↔ 라이트. 최초 접속에만 기기 설정을 씨앗으로 쓰고, 한 번 고르면 그 선택을 지킨다
  (그래서 "시스템" 상태가 따로 없다 — 아이콘은 항상 현재 테마를 가리킨다)
- 가사 줄 탭: 그 구간으로 시크 + 재생 + 화면 중앙 정렬
- 타이머 버튼(싱크 편집): 가사를 붙여 넣고 줄 시작마다 "지금!"을 눌러 타임스탬프 JSON 생성

가사를 손으로 스크롤하면 자동 스크롤이 3초간 양보한다. 그 사이에도 줄을 직접 탭하면
명시적 의사표시로 보고 즉시 중앙 정렬을 되살린다.

## 가사 추가

가사 원문은 저작권 문제로 git에 포함하지 않는다 (`public/lyrics/`는 gitignore).
곡별 가사는 `public/lyrics/<slug>.json`에 두면 런타임에 로드된다. 형식:

```json
[{ "time": 12.3, "jp": "君を握った", "pron": "키미오 니깃타", "ko": "너를 붙잡았어" }]
```

`time`은 초 단위, 곡 내에서 순증가해야 한다. 싱크 편집 모드로 만든 JSON을 그대로 저장하면
된다. slug는 `src/songs/<곡>.ts` 참조. 가사가 없는 곡은 안내 화면이 뜬다.

E2E는 가사 파일에 의존하지 않는다 — `e2e/mobile.spec.ts`가 fixture를 주입한다.

## PWA

`public/manifest.webmanifest` + `public/sw.js`. 서비스워커는 프로덕션 빌드에서만 등록된다
(`src/register-sw.ts`) — dev에서 등록하면 캐시가 HMR을 가로챈다.

빌드 산출물 이름에 해시가 붙어 정적 프리캐시 목록을 쓸 수 없으므로 런타임 캐싱을 쓴다.
문서는 network-first, `/assets`·`/icons`는 cache-first, `/lyrics`는 stale-while-revalidate.
외부 오리진(YouTube)은 캐시하지 않는다. 한 번 방문하면 오프라인에서도 앱과 가사가 열린다.

캐시 스키마를 바꾸면 `sw.js`의 `VERSION`을 올린다. 예전 캐시는 activate에서 지워진다.

아이콘은 `scripts/`가 아니라 일회성으로 Chromium 렌더링해 `public/icons/`에 넣어 두었다.

## 폰트

Pretendard Variable 원본은 2MB인데 대부분이 실사용되지 않는 확장 한글 음절이다.
KS X 1001 완성형 2350자 + 라틴만 남겨 449KB로 줄였다 (`PretendardVariable.subset.woff2`).
범위 밖 희귀 음절은 시스템 폰트로 글자 단위 폴백되므로 깨지지 않는다.

```bash
pip install fonttools brotli
python3 scripts/subset-font.py <원본.woff2> src/assets/fonts/PretendardVariable.subset.woff2
```

## 개발

```bash
pnpm --filter karaoke dev        # http://<branch>.karaoke.mumak.localhost:1355
pnpm --filter karaoke test
pnpm --filter karaoke test:e2e   # chromium + mobile-chrome(Pixel 7) 프로젝트
```
