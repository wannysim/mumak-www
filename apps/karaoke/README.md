# karaoke

좋아하는 노래를 재생목록에 모아 연습하는 모바일 노래방 웹앱. YouTube 영상을 재생하면서
타임스탬프 가사를 한 줄씩 하이라이트하고, 줄마다 원문 · 한글 발음 · 한국어 번역을 토글해서 볼 수 있다.

기본 재생목록에는 Vaundy 9곡과 Fujii Kaze 대표곡 10곡의 공식 YouTube 영상 정보가 들어 있다.

## 사용법

- 헤더 좌우 화살표: 이전/다음 곡 (마지막 다음은 첫 곡으로 순환)
- 헤더 가운데 제목 탭: 현재 재생목록의 곡 목록. 뒤로 가면 재생목록을 만들거나 바꿀 수 있고,
  각 목록의 + 버튼에서 YouTube 주소와 원어·한국어 제목을 직접 등록한다
- 플레이어 줄: 재생/일시정지 · 경과 시간 · 탐색 슬라이더 · 전체 길이 · 반복 버튼
- 반복 버튼: 반복 없음 → 전체 반복(곡이 끝나면 다음 곡 자동재생, 마지막 다음은 첫 곡)
  → 한 곡 반복. 선택은 localStorage에 남는다
- 표시 토글: JP / PRON / KO on·off (localStorage 저장, 최소 하나는 유지)
- READ: 일본어를 한 단계 절제하고 발음·해석을 키우는 리딩 모드 (최초 기본값 ON, localStorage 저장)
- 테마 버튼: 다크 ↔ 라이트. 최초 접속에만 기기 설정을 씨앗으로 쓰고, 한 번 고르면 그 선택을 지킨다
  (그래서 "시스템" 상태가 따로 없다 — 아이콘은 항상 현재 테마를 가리킨다)
- 가사 줄 탭: 그 구간으로 시크 + 재생 + 화면 중앙 정렬
- 가사 불러오기: 빈 화면에서는 현재 곡의 JSON 한 개를 파일명과 무관하게 저장하고, 보관함에서는 전체 백업을 복원한다
- 백업 내보내기: 이 기기의 전체 가사 라이브러리를 재가져오기 가능한 JSON 한 개로 저장
- 종이·연필 버튼(가사 편집): AI용 정리 요청을 복사하거나 일본어·발음·번역을 줄별로 고친 뒤,
  노래를 왕복 재생하며 시작 시점을 찍어 이 기기에 바로 저장

가사를 손으로 스크롤하면 자동 스크롤이 3초간 양보한다. 그 사이에도 줄을 직접 탭하면
명시적 의사표시로 보고 즉시 중앙 정렬을 되살린다.

## YouTube 플레이어 제약

플레이어 위에는 아무것도 덮지 않는다. [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)가
"플레이어 앞에 오버레이·프레임 등 시각 요소를 두지 말 것"과 최소 200x200 뷰포트를 요구한다.

그래서 영상을 숨기고 자체 플레이어 UI만 남기는 건 하지 않는다. 기술적으로는 iframe을
1px로 줄이거나 화면 밖으로 밀면(display:none은 재생이 끊긴다) 되지만 위 조항에 걸린다.
16:9를 유지하면서 높이 200px을 지키려면 폰 화면에서는 사실상 전체 폭이라, 줄여서 얻는
공간도 거의 없다.

대신 약관 안에서 할 수 있는 건 다 한다 — 컨트롤 바는 공식 파라미터(`controls=0`)로 끄고,
재생·탐색·반복은 플레이어 아래 자체 컨트롤 줄이 담당한다. 정지 상태에서 YouTube 제목·공유·
로고가 보이는 것은 이 제약의 결과이지 버그가 아니다.

`e2e/home.spec.ts`의 "unobstructed" 테스트가 `elementFromPoint`로 플레이어 위에 다른
요소가 올라오지 않았는지 확인한다. 오버레이를 다시 얹으면 그 테스트가 잡는다.

## 로컬 가사

앱과 배포물에는 가사 원문·발음·번역이 들어 있지 않다. 앱은 `/lyrics`나 외부 가사 API를
호출하지 않으며, 사용자가 직접 고른 파일만 브라우저 IndexedDB에 저장한다. 형식:

```json
[{ "time": 12.3, "jp": "歌の練習", "pron": "우타노 렌슈", "ko": "노래 연습" }]
```

빈 가사 화면에서는 파일 이름과 무관하게 현재 곡에 저장한다. 보관함에서 곡별 파일을
직접 복원할 때는 `src/songs/`에 등록된 `<slug>.json`으로 맞추거나
`{ "slug": "<slug>", "lyrics": [...] }` 형식으로 slug를 명시한다.
기존 곡을 바꾸기 전에는 확인을 받으며, 여러 파일은 하나의 IndexedDB transaction으로
저장되어 중간 상태를 남기지 않는다. Web Locks를 지원하는 최신 브라우저에서는 여러 탭의
확인과 저장도 직렬화한다. `이 앱에 대해 → 내 가사 → 백업 내보내기`에서 전체 라이브러리를
한 파일로 보관할 수 있고, 그 파일은 같은 가져오기 버튼으로 복원한다.

자세한 형식과 사용법은 **[docs/LYRICS.md](docs/LYRICS.md)** 에 정리했다.
`public/lyrics`나 `dist/lyrics`에 파일이 생기면 확장자와 관계없이 빌드 검사가 실패한다.
다른 경로의 JSON·LRC·자막·텍스트 데이터 파일도 라이선스 고지를 제외하고 차단한다.

```bash
pnpm --filter karaoke check:no-lyrics
```

E2E는 실제 저작물을 쓰지 않는다. `e2e/mobile.spec.ts`가 synthetic JSON을 파일 입력으로
불러와 실제 import → IndexedDB → 새로고침 복원 경로를 검증한다.

## PWA

`public/manifest.webmanifest` + `public/sw.js`. 서비스워커는 프로덕션 빌드에서만 등록된다
(`src/register-sw.ts`) — dev에서 등록하면 캐시가 HMR을 가로챈다.

빌드 때 해시가 붙은 JS/CSS와 manifest·icons 목록을 서비스워커에 주입해 프리캐시한다.
분할된 일본어 폰트 100여 개를 전부 받지는 않고, 첫 화면에서 브라우저가 실제로 사용한
폰트 조각만 서비스워커에 전달해 캐시한다. 문서는 network-first, `/assets`·`/icons`는
cache-first다. 외부 오리진(YouTube)은 캐시하지 않는다. 사용자가 불러온 가사는
서비스워커를 거치지 않고 IndexedDB에만 남는다.

셸과 프리캐시 파일의 콘텐츠 해시로 build ID를 만들기 때문에 배포마다 새 캐시에 완전한 셸을 먼저 만든 뒤
activate에서 이전 karaoke 캐시를 지운다. 설치가 중간에 실패해도 활성 캐시는 건드리지 않는다.
캐시 전략 자체를 바꾸면 `sw.js`의 `RELEASE`를 올린다. `v3-local-first`가 활성화되면 예전
`karaoke-lyrics-*`와 전체 폰트가 들어 있던 구 캐시도 함께 지운다.

아이콘은 `scripts/`가 아니라 일회성으로 Chromium 렌더링해 `public/icons/`에 넣어 두었다.

## 폰트

Pretendard Variable(OFL-1.1) 원본은 2MB인데 대부분이 실사용되지 않는 확장 한글 음절이다.
KS X 1001 완성형 2350자 + 라틴만 남겨 449KB로 줄이고, 수정본의 예약명을
`Mumak Sans Variable`로 바꿨다 (`mumak-sans-variable.woff2`). 범위 밖 희귀 음절은
시스템 폰트로 글자 단위 폴백되므로 깨지지 않는다. 원 저작권 고지와 라이선스 전문은
[`public/licenses/pretendard-ofl.txt`](public/licenses/pretendard-ofl.txt)에 있다.

일본어 제목과 가사는 `@fontsource-variable/noto-serif-jp`의 Noto Serif JP Variable을 쓴다.
Fontsource가 제공하는 `unicode-range` 분할 파일 중 화면의 글자에 필요한 조각만 브라우저가
받으므로, 전체 일본어 글리프 파일을 첫 화면에서 한꺼번에 내려받지 않는다. 패키지에 포함된
Google Inc. 저작권 고지와 OFL 전문은
[`public/licenses/noto-serif-jp-ofl.txt`](public/licenses/noto-serif-jp-ofl.txt)에 있다.

```bash
pip install fonttools brotli
python3 scripts/subset-font.py <원본.woff2> src/assets/fonts/mumak-sans-variable.woff2
```

## 개발

```bash
pnpm --filter karaoke dev        # http://<branch>.karaoke.mumak.localhost:1355
pnpm --filter karaoke test
pnpm turbo run test:e2e --filter=karaoke # build 후 desktop + Pixel 7 + iPhone WebKit smoke
```
