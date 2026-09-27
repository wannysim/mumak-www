type ChartRange = 'day' | 'week' | 'all';

const CHART_RANGES = [
  { value: 'day', label: '일' },
  { value: 'week', label: '주' },
  { value: 'all', label: '전체' },
] as const satisfies readonly { value: ChartRange; label: string }[];

// 세션은 보는 사람의 시간대가 아니라 거래소 날짜로 묶는다. 서울에서 보면 한 세션이
// 22:30–05:15로 자정을 넘기 때문에, 표시 시간대 기준으로 자르면 하루가 둘로 쪼개진다.
const marketDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const marketDateLabel = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
});
const marketDateWithWeekdayLabel = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  weekday: 'short',
});

// 구간 라벨은 "어느 거래일인가"를 말하므로 거래소 날짜로 적는다. 늦게 시작한 세션을
// 서울 시간으로 적으면 금요일 세션이 토요일로 보인다. 시각 판독값은 표시 시간대를 따른다.
function formatMarketDate(at: string) {
  return marketDateLabel.format(new Date(at));
}

function formatMarketDateWithWeekday(at: string) {
  return marketDateWithWeekdayLabel.format(new Date(at));
}

function marketSessionKey(at: string) {
  return marketDate.format(new Date(at));
}

function marketWeekKey(at: string) {
  const session = new Date(`${marketSessionKey(at)}T00:00:00Z`);
  const daysSinceMonday = (session.getUTCDay() + 6) % 7;
  session.setUTCDate(session.getUTCDate() - daysSinceMonday);
  return session.toISOString().slice(0, 10);
}

// 시간순으로 정렬된 지점을 거래일 또는 거래 주 단위 구간으로 나눈다. 'all'은 한 구간이다.
function splitHistoryWindows<T extends { at: string }>(points: T[], range: ChartRange): T[][] {
  if (range === 'all') return points.length > 0 ? [points] : [];
  const keyOf = range === 'day' ? marketSessionKey : marketWeekKey;
  const windows: T[][] = [];
  let currentKey: string | null = null;
  for (const point of points) {
    const key = keyOf(point.at);
    if (key !== currentKey) {
      windows.push([]);
      currentKey = key;
    }
    windows.at(-1)!.push(point);
  }
  return windows;
}

export { CHART_RANGES, formatMarketDate, formatMarketDateWithWeekday, splitHistoryWindows, type ChartRange };
