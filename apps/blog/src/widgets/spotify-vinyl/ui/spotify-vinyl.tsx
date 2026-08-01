'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { memo, useState } from 'react';

import { cn } from '@mumak/ui/lib/utils';

import type { NowPlaying } from '@/src/entities/spotify';
import { ExternalLink } from '@/src/shared/ui/external-link';

import { SpotifyDeviceInfoBadge } from './spotify-device-info';
import { SpotifyProgressBar } from './spotify-progress-bar';

interface SpotifyVinylProps {
  data: NowPlaying;
  statusLabel: string;
  /** 곡 전환 애니메이션 활성화 여부 */
  isTransitioning?: boolean;
  /** 보간된 진행률 (ms). 없으면 진행률 바 미표시. */
  interpolatedProgressMs?: number | null;
}

export const SpotifyVinyl = memo(function SpotifyVinyl({
  data,
  statusLabel,
  isTransitioning = false,
  interpolatedProgressMs = null,
}: SpotifyVinylProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('home');

  const toggleOpen = () => setIsOpen(prev => !prev);

  const canShowProgress = data.durationMs != null && interpolatedProgressMs != null;
  const canShowDevice = data.isPlaying && data.device != null;

  return (
    // 루트 패딩은 spotify-vinyl-skeleton.tsx와 항상 같아야 한다(로딩→로드 전환 CLS 방지).
    <div className="w-full max-w-md md:p-4 select-none overflow-visible">
      <div className="group relative flex items-center">
        {/* Vinyl Toggle Button - LP Disc와 Album Sleeve를 포함 */}
        <button
          type="button"
          className="relative z-10 shrink-0 cursor-pointer transition-transform duration-300 active:scale-95"
          onClick={toggleOpen}
          aria-label={t('vinylToggle')}
          aria-pressed={isOpen}
        >
          {/* LP Disc */}
          <div
            className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 z-0 size-24 sm:size-32 rounded-full',
              'flex items-center justify-center',
              'bg-linear-to-br from-neutral-800 via-neutral-900 to-black',
              'shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]',
              // LP는 슬리브에서 미끄러져 나와 마찰로 멈추는 강체다. 오버슛 없이 감속만 한다(ease-out-quart).
              'transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none',
              isOpen ? 'translate-x-8 sm:translate-x-14 rotate-180' : 'translate-x-0 rotate-0',
              data.isPlaying && isOpen && 'animate-[spin_4s_linear_infinite] motion-reduce:animate-none'
            )}
            aria-hidden="true"
          >
            {/* Outer rim */}
            <div className="absolute inset-0 rounded-full border border-neutral-700/50" />

            {/* Groove pattern - concentric circles */}
            <div className="absolute inset-[8%] rounded-full border border-neutral-700/30" />
            <div className="absolute inset-[16%] rounded-full border border-neutral-700/20" />
            <div className="absolute inset-[24%] rounded-full border border-neutral-700/30" />
            <div className="absolute inset-[32%] rounded-full border border-neutral-700/20" />

            {/* Light reflection - asymmetric for rotation visibility */}
            <div className="absolute inset-0 rounded-full opacity-20 bg-[conic-gradient(from_45deg,transparent_0deg,rgba(255,255,255,0.6)_30deg,transparent_90deg,transparent_180deg,rgba(255,255,255,0.3)_210deg,transparent_270deg)]" />

            {/* Center label area */}
            <div className="relative size-8 sm:size-10 rounded-full bg-linear-to-br from-neutral-700 via-neutral-800 to-neutral-900 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
              {/* Label highlight */}
              <div className="absolute inset-0 rounded-full bg-linear-to-b from-white/10 to-transparent" />
              {/* Label mark - asymmetric dot for rotation visibility */}
              <div className="absolute top-1 sm:top-1.5 size-0.5 sm:size-1 rounded-full bg-neutral-500/60" />
              {/* Spindle hole */}
              <div className="size-1.5 sm:size-2 rounded-full bg-neutral-950 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
            </div>
          </div>

          {/* Album Sleeve */}
          <div
            className={cn(
              'size-24 sm:size-32 rounded lg:rounded-lg shadow-2xl overflow-hidden bg-neutral-800 border border-neutral-200 dark:border-white/10 relative',
              'transition-opacity duration-300',
              isTransitioning && 'animate-[fadeInScale_0.4s_ease-out] motion-reduce:animate-none'
            )}
          >
            <Image
              src={data.albumImageUrl}
              alt={`${data.album} cover art`}
              fill
              className="object-cover"
              sizes="(min-width: 640px) 128px, 96px"
              priority
            />
          </div>
        </button>

        {/* Track Info */}
        <div
          className={cn(
            'flex-1 min-w-0 ml-8 sm:ml-14 flex flex-col justify-center z-20 pl-2',
            isTransitioning && 'animate-[fadeInSlide_0.4s_ease-out] motion-reduce:animate-none'
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-1 whitespace-nowrap">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Spotify icon - 캡션 라벨과 균형을 맞춘 16px */}
              <svg
                className="size-4 shrink-0 text-[#1DB954]"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              {/* 11px 가독성 플로어. uppercase+tracking은 이 위젯의 타이포그래피 서명이라 유지한다 —
                  375px에서도 텍스트 컬럼이 ~303px라 넉넉하고, 넘치면 truncate가 받아낸다. */}
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                {statusLabel}
              </span>
              {data.isPlaying && (
                <span
                  className="flex h-2.5 shrink-0 items-end gap-px"
                  data-testid="playing-indicator"
                  aria-hidden="true"
                >
                  <span className="h-1 w-0.5 rounded-full bg-[#1DB954] animate-[equalize_1s_ease-in-out_-0.6s_infinite] motion-reduce:animate-none" />
                  <span className="h-2 w-0.5 rounded-full bg-[#1DB954] animate-[equalize_1s_ease-in-out_-0.3s_infinite] motion-reduce:animate-none" />
                  <span className="h-1.5 w-0.5 rounded-full bg-[#1DB954] animate-[equalize_1s_ease-in-out_infinite] motion-reduce:animate-none" />
                </span>
              )}
            </div>
            {canShowDevice && data.device != null && (
              <SpotifyDeviceInfoBadge device={data.device} className="shrink-0" />
            )}
          </div>

          <ExternalLink href={data.songUrl} className="group/link hover:text-[#1DB954] transition-colors duration-300">
            <span className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-semibold leading-tight truncate">{data.title}</span>
              {data.isExplicit && (
                <span
                  className="shrink-0 inline-grid place-items-center size-4 rounded-full border border-red-600 bg-white dark:bg-red-600 text-red-600 dark:text-white text-[9px] font-bold leading-none pt-px"
                  title={t('explicitContent')}
                  aria-label={t('explicitContent')}
                >
                  19
                </span>
              )}
            </span>
            <span className="block text-xs sm:text-sm text-muted-foreground truncate mt-0.5">{data.artist}</span>
          </ExternalLink>

          {canShowProgress && (
            <SpotifyProgressBar
              progressMs={interpolatedProgressMs}
              durationMs={data.durationMs as number}
              isPlaying={data.isPlaying}
              className="mt-2"
            />
          )}
        </div>
      </div>
    </div>
  );
}, arePropsEqual);

function arePropsEqual(prev: SpotifyVinylProps, next: SpotifyVinylProps): boolean {
  return (
    prev.data.songUrl === next.data.songUrl &&
    prev.data.isPlaying === next.data.isPlaying &&
    prev.data.title === next.data.title &&
    prev.data.artist === next.data.artist &&
    prev.data.durationMs === next.data.durationMs &&
    prev.data.device?.name === next.data.device?.name &&
    prev.data.device?.type === next.data.device?.type &&
    prev.statusLabel === next.statusLabel &&
    prev.isTransitioning === next.isTransitioning &&
    prev.interpolatedProgressMs === next.interpolatedProgressMs
  );
}
