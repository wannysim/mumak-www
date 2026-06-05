'use client';

import { Badge } from '@mumak/ui/components/badge';
import { cn } from '@mumak/ui/lib/utils';

import type { TagInfo } from '@/src/entities/tag';
import { Link } from '@/src/shared/config/i18n';

interface TagCloudProps {
  tags: TagInfo[];
  activeTag?: string;
  showCount?: boolean;
  basePath?: string;
}

export function TagCloud({ tags, activeTag, showCount = true, basePath = '/blog/tags' }: TagCloudProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map(tag => {
        const isActive = activeTag === tag.name;

        return (
          <Link key={tag.name} href={`${basePath}/${tag.slug}`}>
            <Badge
              variant={isActive ? 'default' : 'secondary'}
              className={cn(
                'cursor-pointer transition-colors hover:bg-primary hover:text-primary-foreground',
                isActive && 'ring-2 ring-primary ring-offset-2'
              )}
            >
              {tag.name}
              {showCount ? <span className="ml-1 text-xs opacity-70">{tag.count}</span> : null}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}
