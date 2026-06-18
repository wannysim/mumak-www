import { type CSSProperties, useRef } from 'react';

import { usePointerParallax } from '@/hooks/use-pointer-parallax';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import type { Palette } from '@/lib/color/palette';
import type { AmbientConfig } from '@/lib/settings/config';

const LIQUID_FILTER_ID = 'stage-liquid';

/** 스와치 인덱스별 블롭 배치/궤도 프리셋(기본 지속시간 초). */
const BLOB_PRESETS = [
  { className: '-left-[12%] -top-[15%] size-[62vw]', name: 'stage-float-a', dur: 19, reverse: false },
  { className: '-right-[8%] -bottom-[18%] size-[58vw]', name: 'stage-float-b', dur: 23, reverse: false },
  { className: '-right-[14%] top-[8%] size-[46vw]', name: 'stage-float-c', dur: 27, reverse: false },
  { className: '-left-[10%] bottom-[4%] size-[50vw]', name: 'stage-float-d', dur: 21, reverse: false },
  { className: 'left-[28%] top-[30%] size-[40vw]', name: 'stage-float-a', dur: 25, reverse: true },
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
 * intensity(0~1, 곡 energy)가 클수록 더 빠르고·강하게 — 속도/왜곡/패럴랙스/투명도를 키우고
 * 가독 오버레이는 줄여 화면이 펄떡이게 한다.
 */
export function AmbientBackground({
  palette,
  albumImageUrl,
  config,
  intensity = 0,
}: {
  palette: Palette;
  albumImageUrl: string;
  config: AmbientConfig;
  intensity?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  // energy 로 강도 스케일. 값들은 모두 base config 에서 파생.
  const speedFactor = 1 + intensity * 1.5;
  const liquidScale = config.liquidScale * (1 + intensity * 1.5);
  const blobOpacity = Math.min(1, config.blobOpacity * (1 + intensity * 0.6));
  const overlayDarkness = Math.max(0, config.overlayDarkness * (1 - intensity * 0.5));
  const parallaxStrength = config.parallaxStrength * (1 + intensity);

  usePointerParallax(rootRef, {
    enabled: config.parallax && !reducedMotion,
    strength: parallaxStrength,
  });

  const colorTransition = `background-color ${config.morphMs}ms ease`;
  const swatches = palette.swatches.slice(0, config.blobCount);
  const blobFilter = `blur(${config.blobBlur}px)${config.liquid ? ` url(#${LIQUID_FILTER_ID})` : ''}`;

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: palette.base, transition: colorTransition }}
      aria-hidden="true"
    >
      {config.liquid ? <LiquidFilterDefs scale={liquidScale} animated={!reducedMotion} /> : null}

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
        const duration = (preset.dur / speedFactor).toFixed(1);
        const morphDuration = ((16 + index * 2) / speedFactor).toFixed(1);
        return (
          <div
            key={`${color}-${index}`}
            className={`stage-anim absolute mix-blend-screen ${preset.className}`}
            style={{
              backgroundColor: color,
              opacity: blobOpacity,
              filter: blobFilter,
              borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%',
              translate: 'var(--parallax-x, 0px) var(--parallax-y, 0px)',
              animation: `${preset.name} ${duration}s ease-in-out infinite${preset.reverse ? ' reverse' : ''}, stage-blob-morph ${morphDuration}s ease-in-out infinite`,
              transition: colorTransition,
            }}
          />
        );
      })}

      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlayDarkness})` }} />
    </div>
  );
}
