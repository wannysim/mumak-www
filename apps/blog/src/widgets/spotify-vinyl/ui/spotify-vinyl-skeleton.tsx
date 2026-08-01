import { Skeleton } from '@mumak/ui/components/skeleton';

export function SpotifyVinylSkeleton() {
  return (
    // 루트 패딩은 spotify-vinyl.tsx와 항상 같아야 한다(로딩→로드 전환 CLS 방지).
    <div className="w-full max-w-md md:p-4">
      <div className="relative flex items-center">
        {/* LP Disc Skeleton */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 size-24 sm:size-32 rounded-full bg-neutral-900/50 border-4 border-neutral-800/50" />

        {/* Album Sleeve Skeleton */}
        <div className="relative z-10 shrink-0">
          <Skeleton className="size-24 sm:size-32 rounded lg:rounded-lg" />
        </div>

        {/* Track Info Skeleton */}
        <div className="flex-1 min-w-0 ml-8 sm:ml-14 pl-2 z-20">
          {/* Status row: Spotify icon + label */}
          <div className="flex items-center gap-1.5 mb-1">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          {/* Title */}
          <Skeleton className="h-4 w-32 sm:w-40" />
          {/* Artist */}
          <Skeleton className="h-3 w-24 sm:w-28 mt-1.5" />
          {/* Progress bar */}
          <Skeleton className="h-1 w-full mt-2" />
          {/* Time row */}
          <div className="mt-1 flex items-center justify-between">
            <Skeleton className="h-2 w-6" />
            <Skeleton className="h-2 w-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
