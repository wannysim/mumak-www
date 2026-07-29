/** 초를 m:ss로. 길이를 아직 모르면(0 또는 NaN) --:--. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';

  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** 가사 cue를 타임코드처럼 mm:ss.s로 표시한다. */
export function formatCueTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--.-';

  const totalTenths = Math.round(seconds * 10);
  const minutes = Math.floor(totalTenths / 600);
  const secondsTenths = totalTenths % 600;
  const wholeSeconds = Math.floor(secondsTenths / 10);
  const tenths = secondsTenths % 10;

  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${tenths}`;
}
