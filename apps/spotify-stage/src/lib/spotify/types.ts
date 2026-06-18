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
