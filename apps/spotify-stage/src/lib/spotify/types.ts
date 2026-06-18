/** Spotify currently-playing 응답을 앱에서 쓰기 쉬운 형태로 정규화한 타입들. */

export type SpotifyDeviceType =
  | 'Computer'
  | 'Smartphone'
  | 'Speaker'
  | 'TV'
  | 'Tablet'
  | 'AVR'
  | 'STB'
  | 'AudioDongle'
  | 'GameConsole'
  | 'CastVideo'
  | 'CastAudio'
  | 'Automobile'
  | 'Unknown';

export interface SpotifyDeviceInfo {
  name: string;
  type: SpotifyDeviceType;
  volumePercent: number | null;
}

export type RepeatState = 'off' | 'track' | 'context';

export interface NowPlaying {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string;
  songUrl: string;
  isExplicit: boolean;
  progressMs: number | null;
  durationMs: number | null;
  device: SpotifyDeviceInfo | null;
  shuffleState: boolean;
  repeatState: RepeatState;
  /** 대표(첫) 아티스트 ID. 장르 조회용. */
  artistId: string | null;
}

/** 큐/최근 재생 등 목록 표시용 경량 트랙 정보. */
export interface TrackBrief {
  title: string;
  artist: string;
  albumImageUrl: string;
  songUrl: string;
}

export const KNOWN_DEVICE_TYPES: ReadonlySet<SpotifyDeviceType> = new Set([
  'Computer',
  'Smartphone',
  'Speaker',
  'TV',
  'Tablet',
  'AVR',
  'STB',
  'AudioDongle',
  'GameConsole',
  'CastVideo',
  'CastAudio',
  'Automobile',
  'Unknown',
]);
