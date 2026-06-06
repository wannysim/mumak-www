'use client';

import { TagIcon } from 'lucide-react';

import type { NoteStatus } from '@/src/entities/note';
import { usePathname } from '@/src/shared/config/i18n';
import { ContentSegmentNav, type ContentSegmentNavItem } from '@/src/shared/ui/content-segment-nav';

const STATUSES: NoteStatus[] = ['seedling', 'budding', 'evergreen'];

interface GardenNavProps {
  allLabel: string;
  statusLabels: Record<NoteStatus, string>;
  tagsLabel: string;
  counts?: Record<string, number>;
}

export function GardenNav({ allLabel, statusLabels, tagsLabel, counts }: GardenNavProps) {
  const pathname = usePathname();

  const items: ContentSegmentNavItem[] = [
    { key: 'all', href: '/garden', label: allLabel, active: pathname === '/garden', count: counts?.all },
    ...STATUSES.map(status => ({
      key: status,
      href: `/garden/status/${status}`,
      label: statusLabels[status],
      active: pathname === `/garden/status/${status}`,
      count: counts?.[status],
    })),
    {
      key: 'tags',
      href: '/garden/tags',
      label: tagsLabel,
      active: pathname.startsWith('/garden/tags'),
      icon: <TagIcon className="size-3.5" />,
      count: counts?.tags,
      dividerBefore: true,
    },
  ];

  return <ContentSegmentNav items={items} />;
}
