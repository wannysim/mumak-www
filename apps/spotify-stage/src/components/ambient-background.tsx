import type { Palette } from '@/lib/color/palette';

/** 스와치 인덱스별 블롭 배치/궤도 프리셋. */
const BLOB_PRESETS = [
  { className: '-left-[12%] -top-[15%] size-[62vw]', animation: 'stage-float-a 19s ease-in-out infinite' },
  { className: '-right-[8%] -bottom-[18%] size-[58vw]', animation: 'stage-float-b 23s ease-in-out infinite' },
  { className: '-right-[14%] top-[8%] size-[46vw]', animation: 'stage-float-c 27s ease-in-out infinite' },
  { className: '-left-[10%] bottom-[4%] size-[50vw]', animation: 'stage-float-d 21s ease-in-out infinite' },
  { className: 'left-[28%] top-[30%] size-[40vw]', animation: 'stage-float-a 25s ease-in-out infinite reverse' },
] as const;

/**
 * 팔레트 + 앨범 아트 기반 ambient 배경.
 * (뒤→앞) 베이스 단색 → 블러된 앨범 아트(Ken Burns) → 스와치 mesh 블롭 → 가독 오버레이.
 * 모든 색에 transition 을 걸어 곡 전환 시 부드럽게 morph 된다.
 * 애니메이션은 inline style 로 주고, prefers-reduced-motion 은 index.css 가 무효화한다.
 */
export function AmbientBackground({ palette, albumImageUrl }: { palette: Palette; albumImageUrl: string }) {
  const colorTransition = 'background-color 1200ms ease';

  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: palette.base, transition: colorTransition }}
      aria-hidden="true"
    >
      {albumImageUrl ? (
        <div
          key={albumImageUrl}
          className="stage-anim absolute inset-0 scale-125 bg-cover bg-center opacity-30 blur-3xl"
          style={{
            backgroundImage: `url(${albumImageUrl})`,
            animation: 'stage-kenburns 40s ease-in-out infinite alternate, stage-fade-in 1200ms ease',
          }}
        />
      ) : null}

      {palette.swatches.map((color, index) => {
        const preset = BLOB_PRESETS[index % BLOB_PRESETS.length] ?? BLOB_PRESETS[0];
        return (
          <div
            key={`${color}-${index}`}
            className={`stage-anim absolute rounded-full opacity-50 blur-[90px] mix-blend-screen ${preset.className}`}
            style={{ backgroundColor: color, animation: preset.animation, transition: colorTransition }}
          />
        );
      })}

      <div className="absolute inset-0 bg-black/30" />
    </div>
  );
}
