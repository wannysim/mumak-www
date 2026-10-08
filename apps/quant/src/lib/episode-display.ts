import type { DashboardSnapshot } from '@/lib/dashboard-schema';

function episodeDisplayLabel(snapshot: DashboardSnapshot): string {
  const [year, month] = snapshot.month.split('-');
  const koreanPrefix = `${year}년 ${Number(month)}월 · `;
  const numericPrefix = `${snapshot.month} · `;
  const label = snapshot.label.startsWith(koreanPrefix)
    ? snapshot.label.slice(koreanPrefix.length)
    : snapshot.label.startsWith(numericPrefix)
      ? snapshot.label.slice(numericPrefix.length)
      : snapshot.label;
  return `${numericPrefix}${label}`;
}

function episodeKey(snapshot: DashboardSnapshot): string {
  return JSON.stringify([snapshot.episodeId, snapshot.month]);
}

export { episodeDisplayLabel, episodeKey };
