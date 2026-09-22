const DEFAULT_TIME_ZONE = 'Asia/Seoul';

const TIME_ZONES = [
  { value: 'Asia/Seoul', label: '서울' },
  { value: 'Asia/Tokyo', label: '도쿄' },
  { value: 'Asia/Shanghai', label: '상하이' },
  { value: 'Asia/Singapore', label: '싱가포르' },
  { value: 'Asia/Kolkata', label: '콜카타' },
  { value: 'Asia/Dubai', label: '두바이' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: '런던' },
  { value: 'Europe/Paris', label: '파리' },
  { value: 'America/New_York', label: '뉴욕' },
  { value: 'America/Chicago', label: '시카고' },
  { value: 'America/Los_Angeles', label: 'LA' },
  { value: 'Australia/Sydney', label: '시드니' },
  { value: 'Pacific/Auckland', label: '오클랜드' },
];

function clientTimeZone() {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) {
      new Intl.DateTimeFormat('ko-KR', { timeZone }).format();
      return timeZone;
    }
  } catch {
    // 시간대 조회가 차단되거나 지원되지 않으면 한국 시간을 사용한다.
  }
  return DEFAULT_TIME_ZONE;
}

function timeZoneOffset(timeZone: string, at = new Date()) {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find(part => part.type === 'timeZoneName')?.value ?? 'GMT'
  );
}

function timeZoneLabel(timeZone: string) {
  const offset = timeZoneOffset(timeZone);
  const place = TIME_ZONES.find(zone => zone.value === timeZone)?.label ?? '현지';
  return `${offset} · ${place}`;
}

export { DEFAULT_TIME_ZONE, TIME_ZONES, clientTimeZone, timeZoneLabel, timeZoneOffset };
