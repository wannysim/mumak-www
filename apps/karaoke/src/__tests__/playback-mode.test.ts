import { describe, expect, it } from 'vitest';

import { DEFAULT_PLAYBACK_MODE, nextPlaybackMode, PLAYBACK_MODE_LABEL } from '../lib/playback-mode';

describe('nextPlaybackMode', () => {
  it('cycles off -> all -> one -> off', () => {
    expect(nextPlaybackMode('off')).toBe('all');
    expect(nextPlaybackMode('all')).toBe('one');
    expect(nextPlaybackMode('one')).toBe('off');
  });

  it('returns to the default from an unknown value', () => {
    // localStorage에 낡은 값이 남아 있어도 버튼이 죽지 않아야 한다.
    expect(nextPlaybackMode('bogus' as never)).toBe(DEFAULT_PLAYBACK_MODE);
  });

  it('labels every mode', () => {
    expect(Object.keys(PLAYBACK_MODE_LABEL).toSorted()).toEqual(['all', 'off', 'one']);
  });
});
