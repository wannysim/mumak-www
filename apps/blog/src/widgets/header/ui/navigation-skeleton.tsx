import { Skeleton } from '@mumak/ui/components/skeleton';

function NavigationSkeleton() {
  return (
    <nav className="border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3 sm:gap-4">
            <Skeleton className="md:hidden size-11 rounded-md" />
            <div className="hidden md:flex items-center gap-4">
              <Skeleton className="h-11 w-14 rounded-md" />
              <Skeleton className="h-11 w-14 rounded-md" />
              <Skeleton className="h-11 w-14 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="size-11 rounded-md sm:hidden" />
            <Skeleton className="hidden h-9 rounded-md sm:block sm:w-44 lg:w-56" />
            <Skeleton className="size-11 rounded-md" />
            <Skeleton className="size-11 rounded-md" />
          </div>
        </div>
      </div>
    </nav>
  );
}

export { NavigationSkeleton };
