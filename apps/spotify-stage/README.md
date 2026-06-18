# spotify-stage

지금 재생 중인 곡을, **재생 중인 기기에 맞는 무대(테마)** 로 보여주는 ambient now-playing SPA.
앨범 아트에서 색을 추출해 화면 전체 배경으로 번지게 하고, 곡이 바뀌면 색이 부드럽게 morph 된다.

- Vite + React 19 + Tailwind v4 + `@mumak/ui`
- **백엔드 없음**: Spotify Authorization Code + PKCE 로 브라우저에서 직접 인증/폴링
- 각 방문자가 자기 Spotify 계정으로 로그인해 **자기 재생**을 본다

## 디바이스별 테마

`/me/player` 의 `device.type` 에 따라 레이아웃이 바뀐다.

| device.type  | 테마          | 컨셉                             |
| ------------ | ------------- | -------------------------------- |
| `Computer`   | 데스크톱 카드 | 유리질 가로 플레이어             |
| `Smartphone` | 잠금화면      | 세로 카드, 큰 앨범 아트          |
| `Automobile` | 대시보드      | 와이드, 대형 타이포, 두꺼운 막대 |
| `TV`         | 시네마        | 레터박스 + 포스터 + bias light   |
| 그 외        | fallback      | 중립 중앙 정렬                   |

## 셋업

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) 에서 앱 생성 → **Client ID** 복사.
2. 같은 화면의 **Redirect URIs** 에 사용할 주소를 정확히 등록 (끝의 `/` 포함):
   - 로컬: `http://stage.mumak.localhost:1355/`
   - 프리뷰: `http://127.0.0.1:3004/`
   - 프로덕션: 배포 도메인 + `/`
3. `.env.example` 를 `.env.local` 로 복사하고 `VITE_SPOTIFY_CLIENT_ID` 채우기.

> PKCE 는 공개 클라이언트 플로우라 `client_secret` 이 필요 없다. 토큰은 브라우저 `localStorage` 에만 저장된다.

## 실행

```bash
pnpm --filter spotify-stage dev       # http://stage.mumak.localhost:1355
pnpm --filter spotify-stage build
pnpm --filter spotify-stage preview    # http://127.0.0.1:3004
pnpm --filter spotify-stage check-types
```

## 구조

```
src/
├── lib/spotify/      # PKCE 인증(auth/pkce/constants), API 클라이언트(client/types)
├── lib/color/        # 앨범 아트 색 추출(palette)
├── hooks/            # use-auth, use-now-playing(폴링), use-album-palette, use-interpolated-progress
├── themes/           # 디바이스별 테마 5종 + device.type→theme 레지스트리
└── components/        # ambient-background, now-playing-stage, login/idle/loading, 공유 UI
```

데이터 흐름: `useAuth`(PKCE) → `useNowPlaying`(적응형 폴링) → `useAlbumPalette`(canvas 색추출)
→ `NowPlayingStage` 가 `device.type` 으로 테마를 고르고 팔레트를 CSS 변수로 주입.

## 향후: blog micro-frontend

이 앱은 인증·데이터·테마가 모두 클라이언트 내부에 닫혀 있어 독립적으로 떼었다 붙이기 쉽다.
추후 `apps/blog` 에 위젯/iframe 또는 Module Federation 형태로 합치는 것을 고려한다.
