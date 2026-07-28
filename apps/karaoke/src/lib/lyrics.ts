/** 한 줄의 가사. time은 초 단위이며 곡 내에서 순증가해야 한다. */
export type LyricLine = {
  time: number;
  /** 일본어 원문 */
  jp: string;
  /** 한글 발음 */
  pron: string;
  /** 한국어 번역 */
  ko: string;
};

/** 현재 재생 시간에 해당하는 가사 줄 인덱스. 첫 줄 이전이면 -1. */
export function currentLineIndex(lyrics: LyricLine[], time: number): number {
  return lyrics.findLastIndex(line => line.time <= time);
}
