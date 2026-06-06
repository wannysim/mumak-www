import { Archive, FolderKanban, Library, Target, type LucideIcon } from 'lucide-react';

import { Badge } from '@mumak/ui/components/badge';
import { cn } from '@mumak/ui/lib/utils';

import { type ParaCategoryKey } from '@/src/entities/note';
import { Link } from '@/src/shared/config/i18n';
import { cardSurfaceClass } from '@/src/shared/ui';

const CATEGORY_ICONS: Record<ParaCategoryKey, LucideIcon> = {
  projects: FolderKanban,
  areas: Target,
  resources: Library,
  archives: Archive,
};

interface GardenOverviewItem {
  key: ParaCategoryKey;
  label: string;
  description: string;
  count: number;
}

interface GardenOverviewProps {
  items: GardenOverviewItem[];
}

export function GardenOverview({ items }: GardenOverviewProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div data-slot="garden-overview" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map(item => {
        const Icon = CATEGORY_ICONS[item.key];
        return (
          <Link
            key={item.key}
            href={`/garden/category/${item.key}`}
            className={cn(cardSurfaceClass, 'group flex items-start gap-3 p-4')}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight transition-colors group-hover:text-primary">
                  {item.label}
                </span>
                <Badge variant="secondary" className="h-5 rounded-sm px-1.5 py-0 font-normal">
                  {item.count}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">{item.description}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
