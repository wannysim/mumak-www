import * as React from 'react';

import type { LyricLine } from '@/lib/lyrics';
import { readStoredLyrics, subscribeLyricsChanges } from '@/lib/lyrics-storage';

type LyricsState = {
  lyrics: LyricLine[];
  status: 'loading' | 'ready' | 'error';
  errorMessage?: string;
};

/**
 * 사용자가 직접 불러온 가사를 이 브라우저의 IndexedDB에서 읽는다.
 * 가사 데이터는 네트워크에 요청하거나 앱 배포물에 포함하지 않는다.
 */
export function useLyrics(slug: string): LyricsState {
  const [state, setState] = React.useState<{
    loadedSlug: string;
    lyrics: LyricsState['lyrics'];
    status: LyricsState['status'];
    errorMessage?: LyricsState['errorMessage'];
  }>({ loadedSlug: slug, lyrics: [], status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    let requestId = 0;

    const load = async (showLoading: boolean) => {
      const currentRequest = ++requestId;
      if (showLoading) setState({ loadedSlug: slug, lyrics: [], status: 'loading' });
      try {
        const lyrics = await readStoredLyrics(slug);
        if (!cancelled && currentRequest === requestId) setState({ loadedSlug: slug, lyrics, status: 'ready' });
      } catch (error) {
        if (!cancelled && currentRequest === requestId) {
          setState({
            loadedSlug: slug,
            lyrics: [],
            status: 'error',
            errorMessage: error instanceof Error ? error.message : '저장된 가사를 읽지 못했습니다.',
          });
        }
      }
    };

    void load(true);
    const unsubscribe = subscribeLyricsChanges(changedSlug => {
      if (changedSlug === null || changedSlug === slug) void load(false);
    });
    const reloadWhenFocused = () => void load(false);
    window.addEventListener('focus', reloadWhenFocused);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('focus', reloadWhenFocused);
    };
  }, [slug]);

  if (state.loadedSlug !== slug) return { lyrics: [], status: 'loading' };

  return {
    lyrics: state.lyrics,
    status: state.status,
    ...(state.errorMessage === undefined ? {} : { errorMessage: state.errorMessage }),
  };
}
