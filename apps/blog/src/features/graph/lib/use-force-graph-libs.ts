'use client';

import * as React from 'react';

export type ForceGraphLibs = {
  ForceGraph: React.ComponentType<Record<string, unknown>>;
  SpriteText: { new (): unknown };
};

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// WebGL 감지 + 3D 그래프 라이브러리 동적 로드를 한 곳으로 묶는다.
// 이 훅의 소비자는 dynamic(ssr:false)로만 로드되므로 첫 render에서 바로 감지한다.
// mount effect 경유보다 한 render 빠르고, 미지원 기기에서 skeleton 깜빡임이 없다.
// 두 라이브러리는 Promise.all로 함께 도착하므로 하나의 상태로 묶는다.
export function useForceGraphLibs(): { isSupported: boolean; libs: ForceGraphLibs | null } {
  const [isSupported, setIsSupported] = React.useState(detectWebGL);
  const [libs, setLibs] = React.useState<ForceGraphLibs | null>(null);

  React.useEffect(() => {
    if (!isSupported) return;

    let cancelled = false;
    Promise.all([import('react-force-graph-3d'), import('three-spritetext')])
      .then(([fg, st]) => {
        if (cancelled) return;
        setLibs({
          ForceGraph: fg.default as unknown as React.ComponentType<Record<string, unknown>>,
          SpriteText: st.default as unknown as { new (): unknown },
        });
      })
      .catch(() => {
        if (!cancelled) setIsSupported(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  return { isSupported, libs };
}
