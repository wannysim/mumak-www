export interface FormattedDate {
  text: string;
  dateTime: string;
}

export const DEFAULT_FORMATTED_DATE: FormattedDate = {
  text: '—',
  dateTime: '',
};

// Intl.DateTimeFormat 생성은 로케일 데이터를 로드하는 비싼 작업이므로
// 로케일별로 한 번만 만들어 재사용한다 (목록 렌더에서 호출당 재생성 방지).
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(locale);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  formatterCache.set(locale, formatter);
  return formatter;
}

/**
 * Format a date string with locale-aware output and a stable UTC timezone to avoid
 * environment-dependent day shifts.
 */
export function formatDateForLocale(value: string | undefined, locale: string): FormattedDate {
  if (!value) {
    return DEFAULT_FORMATTED_DATE;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return DEFAULT_FORMATTED_DATE;
  }

  return {
    text: getFormatter(locale).format(date),
    dateTime: value,
  };
}
