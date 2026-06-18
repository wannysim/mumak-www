/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Spotify 앱의 Client ID (공개 값, PKCE 라 secret 불필요). */
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  /** redirect_uri 오버라이드. 미지정 시 현재 origin 사용. */
  readonly VITE_SPOTIFY_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
