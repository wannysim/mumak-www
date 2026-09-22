import { createDateFormatters } from '@/lib/format';
import { clientTimeZone, DEFAULT_TIME_ZONE, timeZoneOffset } from '@/lib/time-zone';

describe('display time zones', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the browser time zone, including regions outside the shortcut list', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Pacific/Chatham',
    } as Intl.ResolvedDateTimeFormatOptions);
    expect(clientTimeZone()).toBe('Pacific/Chatham');
  });

  it.each(['', 'Invalid/Zone'])('falls back to Seoul for unavailable or invalid zone %s', timeZone => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone,
    } as Intl.ResolvedDateTimeFormatOptions);
    expect(clientTimeZone()).toBe(DEFAULT_TIME_ZONE);
  });

  it('falls back to Seoul when detection throws', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(() => {
      throw new Error('unavailable');
    });
    expect(clientTimeZone()).toBe(DEFAULT_TIME_ZONE);
  });

  it('converts both dates and times across midnight without repeating GMT', () => {
    const seoul = createDateFormatters('Asia/Seoul');
    const newYork = createDateFormatters('America/New_York');
    const at = '2026-09-21T15:30:00Z';
    expect(seoul.formatDate(at)).toBe('9월 22일');
    expect(seoul.formatDateTime(at)).toBe('9월 22일 00:30');
    expect(newYork.formatDate(at)).toBe('9월 21일');
    expect(newYork.formatDateTime(at)).toBe('9월 21일 11:30');
  });

  it('honors daylight saving at the record date rather than applying today’s offset', () => {
    const { formatDateTime } = createDateFormatters('America/New_York');
    expect(formatDateTime('2026-01-15T15:30:00Z')).toBe('1월 15일 10:30');
    expect(formatDateTime('2026-07-15T15:30:00Z')).toBe('7월 15일 11:30');
    expect(timeZoneOffset('America/New_York', new Date('2026-01-15'))).toBe('GMT-5');
    expect(timeZoneOffset('America/New_York', new Date('2026-07-15'))).toBe('GMT-4');
  });

  it('preserves fractional-hour offsets', () => {
    expect(timeZoneOffset('Asia/Kolkata', new Date('2026-09-21'))).toBe('GMT+5:30');
    expect(createDateFormatters('Asia/Kolkata').formatDateTime('2026-09-21T00:00:00Z')).toBe('9월 21일 05:30');
  });
});
