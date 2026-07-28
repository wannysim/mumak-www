/**
 * 곡이 끝났을 때 무엇을 할지.
 * - off: 그대로 멈춘다
 * - all: 목록 순서대로 다음 곡 (마지막 다음은 첫 곡)
 * - one: 같은 곡을 처음부터 다시
 */
export type PlaybackMode = 'off' | 'all' | 'one';

export const DEFAULT_PLAYBACK_MODE: PlaybackMode = 'off';

const CYCLE: PlaybackMode[] = ['off', 'all', 'one'];

export function nextPlaybackMode(mode: PlaybackMode): PlaybackMode {
  return CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length] ?? DEFAULT_PLAYBACK_MODE;
}

export const PLAYBACK_MODE_LABEL: Record<PlaybackMode, string> = {
  off: '반복 없음',
  all: '전체 반복 (다음 곡 자동재생)',
  one: '한 곡 반복',
};
