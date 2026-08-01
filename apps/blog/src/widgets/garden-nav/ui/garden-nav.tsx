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

  // 노트가 없는 성장 단계는 세그먼트에서 감춘다. "상록수 0"처럼 빈 목록으로만 이어지는
  // 항목이 nav 자리를 차지하면, 없는 편집 관행을 광고하는 셈이 된다. 라우트 자체는 살아
  // 있으므로 직접 링크는 계속 열리고, 현재 보고 있는 단계는 0건이어도 계속 보여준다.
  const isSegmentVisible = (status: NoteStatus) =>
    counts?.[status] === undefined || counts[status] > 0 || pathname === `/garden/status/${status}`;

  const items: ContentSegmentNavItem[] = [
    { key: 'all', href: '/garden', label: allLabel, active: pathname === '/garden', count: counts?.all },
    ...STATUSES.filter(isSegmentVisible).map(status => ({
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
