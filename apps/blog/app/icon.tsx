import { ImageResponse } from 'next/og';

import { loadOgFonts } from '@/src/shared/lib/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default async function Icon() {
  // OG 이미지와 동일하게 Pretendard woff를 직접 넘긴다. Satori는 시스템 폰트를
  // 쓸 수 없어 fonts를 주지 않으면 fontWeight가 무시된 기본 폰트로 렌더된다.
  const fonts = await loadOgFonts();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 구글 검색결과는 favicon을 밝은 배경의 둥근 칩 안에 렌더한다. 투명 배경 위
        // 흰 'WS'는 흰 칩에 묻혀 사라지므로, 브랜드 다크(manifest theme_color·OG
        // 배경과 동일)를 채워 어떤 배경에서도 글자가 보이게 한다.
        backgroundColor: '#0a0a0a',
        color: '#ffffff',
        fontSize: 300,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        fontFamily: 'Pretendard',
      }}
    >
      WS
    </div>,
    { ...size, fonts }
  );
}
