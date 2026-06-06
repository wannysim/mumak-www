// 한국어와 영어 혼합 텍스트를 위한 읽기 시간 계산(분).
// 평균 읽기 속도: 분당 500자(한국어) 또는 200단어(영어). blog/garden 공용.
export function calculateReadingTime(content: string): number {
  const text = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const words = text
    .replace(/[가-힣]/g, '')
    .split(/\s+/)
    .filter(Boolean).length;

  const koreanMinutes = koreanChars / 500;
  const englishMinutes = words / 200;

  return Math.max(1, Math.ceil(koreanMinutes + englishMinutes));
}
