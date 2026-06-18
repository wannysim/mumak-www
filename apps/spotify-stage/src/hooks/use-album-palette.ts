import { useEffect, useState } from 'react';

import { extractPalette, NEUTRAL_PALETTE, type Palette } from '@/lib/color/palette';

/**
 * 앨범 아트 URL 이 바뀔 때마다 색을 추출한다.
 * Spotify 이미지 CDN(i.scdn.co)은 CORS 를 허용하므로 crossOrigin='anonymous' 로 로드해
 * canvas tainted 없이 픽셀을 읽는다. 실패 시 직전 팔레트를 유지한다.
 */
export function useAlbumPalette(albumImageUrl: string | undefined): Palette {
  const [palette, setPalette] = useState<Palette>(NEUTRAL_PALETTE);

  useEffect(() => {
    if (!albumImageUrl) {
      setPalette(NEUTRAL_PALETTE);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';

    const handleLoad = () => {
      if (cancelled) {
        return;
      }
      try {
        setPalette(extractPalette(image));
      } catch {
        // CORS/tainted canvas 등 추출 실패 시 직전 팔레트 유지.
      }
    };

    image.addEventListener('load', handleLoad, { once: true });
    image.src = albumImageUrl;

    return () => {
      cancelled = true;
      image.removeEventListener('load', handleLoad);
    };
  }, [albumImageUrl]);

  return palette;
}
