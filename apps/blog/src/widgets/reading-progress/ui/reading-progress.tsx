'use client';

import { cn } from '@mumak/ui/lib/utils';

import { useScrollProgress } from '@/src/shared/hooks';

interface ReadingProgressProps {
  className?: string;
}

/**
 * 읽기 진행률을 시각적으로 보여주는 프로그레스 바
 *
 * 페이지 최상단에 고정되어 스크롤에 따라 진행률을 표시
 */
export function ReadingProgress({ className }: ReadingProgressProps) {
  const progress = useScrollProgress();

  return (
    <progress
      className={cn(
        'fixed top-0 left-0 right-0 z-60 h-1 w-full appearance-none border-0 bg-transparent',
        '[&::-webkit-progress-bar]:bg-transparent',
        '[&::-webkit-progress-value]:bg-primary',
        '[&::-moz-progress-bar]:bg-primary',
        className
      )}
      value={Math.round(progress)}
      max={100}
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    />
  );
}
