import { type CSSProperties, useRef } from 'react';

import { usePointerParallax } from '@/hooks/use-pointer-parallax';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import type { Palette } from '@/lib/color/palette';
import type { AmbientConfig } from '@/lib/settings/config';

const LIQUID_FILTER_ID = 'stage-liquid';

/** 스와치 인덱스별 블롭 배치/궤도 프리셋. */
const BLOB_PRESETS = [
  { className: '-left-[12%] -top-[15%] size-[62vw]', animation: 'stage-float-a 19s ease-in-out infinite' },
  { className: '-right-[8%] -bottom-[18%] size-[58vw]', animation: 'stage-float-b 23s ease-in-out infinite' },
  { className: '-right-[14%] top-[8%] size-[46vw]', animation: 'stage-float-c 27s ease-in-out infinite' },
  { className: '-left-[10%] bottom-[4%] size-[50vw]', animation: 'stage-float-d 21s ease-in-out infinite' },
  { className: 'left-[28%] top-[30%] size-[40vw]', animation: 'stage-float-a 25s ease-in-out infinite reverse' },
] as const;

/** feTurbulence + feDisplacementMap 액체 왜곡 필터. 블롭마다 filter 로 참조한다. */
function LiquidFilterDefs({ scale, animated }: { scale: number; animated: boolean }) {
  return (
    <svg className="absolute size-0" aria-hidden="true">
      <defs>
        <filter id={LIQUID_FILTER_ID} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.009 0.013" numOctaves="1" seed="7" result="noise">
            {animated ? (
              <animate
                attributeName="baseFrequency"
                dur="26s"
                values="0.009 0.013;0.015 0.008;0.009 0.013"
                repeatCount="indefinite"
              />
            ) : null}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

/**
 * 팔레트 + 앨범 아트 기반 ambient 배경.
 * (뒤→앞) 베이스 단색 → 블러된 앨범 아트(Ken Burns) → 스와치 mesh 블롭 → 가독 오버레이.
 * 블롭은 border-radius 모핑 + 액체 왜곡으로 흐르고, 마우스/자이로 패럴랙스로 시차 이동한다.
 */
export function AmbientBackground({
  palette,
  albumImageUrl,
  config,
}: {
  palette: Palette;
  albumImageUrl: string;
  config: AmbientConfig;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  usePointerParallax(rootRef, {
    enabled: config.parallax && !reducedMotion,
    strength: config.parallaxStrength,
  });

  const colorTransition = `background-color ${config.morphMs}ms ease`;
  const swatches = palette.swatches.slice(0, config.blobCount);
  const blobFilter = (blur: number) => `blur(${blur}px)${config.liquid ? ` url(#${LIQUID_FILTER_ID})` : ''}`;

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: palette.base, transition: colorTransition }}
      aria-hidden="true"
    >
      {config.liquid ? <LiquidFilterDefs scale={config.liquidScale} animated={!reducedMotion} /> : null}

      {albumImageUrl && config.albumLayerOpacity > 0 ? (
        <div
          key={albumImageUrl}
          className="stage-anim absolute inset-0 scale-125 bg-cover bg-center blur-3xl"
          style={
            {
              backgroundImage: `url(${albumImageUrl})`,
              opacity: config.albumLayerOpacity,
              '--album-opacity': config.albumLayerOpacity,
              translate: 'calc(var(--parallax-x, 0px) * 0.4) calc(var(--parallax-y, 0px) * 0.4)',
              animation: config.kenBurns
                ? 'stage-kenburns 40s ease-in-out infinite alternate, stage-fade-in 1200ms ease'
                : 'stage-fade-in 1200ms ease',
            } as CSSProperties
          }
        />
      ) : null}

      {swatches.map((color, index) => {
        const preset = BLOB_PRESETS[index % BLOB_PRESETS.length] ?? BLOB_PRESETS[0];
        return (
          <div
            key={`${color}-${index}`}
            className={`stage-anim absolute mix-blend-screen ${preset.className}`}
            style={{
              backgroundColor: color,
              opacity: config.blobOpacity,
              filter: blobFilter(config.blobBlur),
              borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%',
              translate: 'var(--parallax-x, 0px) var(--parallax-y, 0px)',
              animation: `${preset.animation}, stage-blob-morph ${16 + index * 2}s ease-in-out infinite`,
              transition: colorTransition,
            }}
          />
        );
      })}

      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${config.overlayDarkness})` }} />
    </div>
  );
}
