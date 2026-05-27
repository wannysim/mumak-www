import { Skeleton } from '@mumak/ui/components/skeleton';

export function SpotifyVinylSkeleton() {
  return (
    <div className="w-full max-w-md p-4">
      <div className="relative flex items-center">
        {/* LP Disc Skeleton */}
        <div className="absolute left-0 size-24 sm:size-32 rounded-full bg-neutral-900/50 border-4 border-neutral-800/50" />

        {/* Album Sleeve Skeleton */}
        <div className="relative z-10 shrink-0">
          <Skeleton className="size-24 sm:size-32 rounded-lg" />
        </div>

        {/* Track Info Skeleton */}
        <div className="flex-1 min-w-0 ml-6 sm:ml-8 pl-2 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-32 sm:w-40" />
          <Skeleton className="h-4 w-24 sm:w-32" />
          {/* Progress bar skeleton */}
          <Skeleton className="h-1 w-full mt-2" />
          {/* Device info skeleton */}
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}
