import * as React from 'react';

import type { LyricLine } from '@/lib/lyrics';

/**
 * 곡의 타임스탬프 가사를 public/lyrics/<slug>.json에서 불러온다.
 * 가사 파일은 저작권 문제로 git에 포함되지 않으므로(gitignore), 없으면 빈 배열.
 */
export function useLyrics(slug: string) {
  const [lyrics, setLyrics] = React.useState<LyricLine[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    setLyrics([]);
    fetch(`/lyrics/${slug}.json`)
      .then(response => (response.ok ? (response.json() as Promise<LyricLine[]>) : []))
      .then(data => {
        if (!cancelled) setLyrics(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return lyrics;
}
