import { splitHistoryWindows } from '@/lib/history-windows';

const at = (value: string) => ({ at: value });

describe('splitHistoryWindows', () => {
  // 2026-09-18(금), 21(월), 22(화) 뉴욕 정규장. 13:30Z는 09:30 ET, 20:00Z는 16:00 ET이다.
  const history = [
    '2026-09-18T13:30:00Z',
    '2026-09-18T20:00:00Z',
    '2026-09-21T13:30:00Z',
    '2026-09-21T15:00:00Z',
    // 16:15 ET 마감 직후 기록은 서울 기준으로는 다음 날 05:15지만 같은 세션이다.
    '2026-09-21T20:15:00Z',
    '2026-09-22T13:30:00Z',
  ].map(at);

  it('groups points by New York trading session even when the session crosses midnight elsewhere', () => {
    const windows = splitHistoryWindows(history, 'day');
    expect(windows.map(window => window.map(point => point.at))).toEqual([
      ['2026-09-18T13:30:00Z', '2026-09-18T20:00:00Z'],
      ['2026-09-21T13:30:00Z', '2026-09-21T15:00:00Z', '2026-09-21T20:15:00Z'],
      ['2026-09-22T13:30:00Z'],
    ]);
  });

  it('groups sessions into Monday-based market weeks', () => {
    const windows = splitHistoryWindows(history, 'week');
    expect(windows.map(window => window.length)).toEqual([2, 4]);
    expect(windows[1]![0]!.at).toBe('2026-09-21T13:30:00Z');
  });

  it('keeps a Sunday record in the week that ended, not the one that follows', () => {
    const windows = splitHistoryWindows([at('2026-09-20T15:00:00Z'), at('2026-09-21T13:30:00Z')], 'week');
    expect(windows.map(window => window.length)).toEqual([1, 1]);
  });

  it('returns the whole history as one window for the all range', () => {
    expect(splitHistoryWindows(history, 'all')).toEqual([history]);
  });

  it('returns no windows for an empty history', () => {
    expect(splitHistoryWindows([], 'all')).toEqual([]);
    expect(splitHistoryWindows([], 'day')).toEqual([]);
  });
});
