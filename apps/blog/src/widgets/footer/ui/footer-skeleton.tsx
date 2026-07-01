import { Skeleton } from '@mumak/ui/components/skeleton';

function FooterSkeleton() {
  return (
    <footer className="border-t border-border py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex flex-row items-center gap-6">
            <Skeleton className="h-4 w-12 rounded" />
            <Skeleton className="h-4 w-8 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
            <Skeleton className="size-4 rounded" />
            <Skeleton className="size-4 rounded" />
            <Skeleton className="size-4 rounded" />
          </div>
          <Skeleton className="h-4 w-40 rounded" />
        </div>
      </div>
    </footer>
  );
}

export { FooterSkeleton };
