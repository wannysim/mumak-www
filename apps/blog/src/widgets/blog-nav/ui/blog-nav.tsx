'use client';

import { TagIcon } from 'lucide-react';

import { type Category } from '@/src/entities/post';
import { usePathname } from '@/src/shared/config/i18n';
import { ContentSegmentNav, type ContentSegmentNavItem } from '@/src/shared/ui/content-segment-nav';

interface BlogNavProps {
  allLabel: string;
  categoryLabels: Record<Category, string>;
  tagsLabel?: string;
  counts?: Record<string, number>;
}

export function BlogNav({ allLabel, categoryLabels, tagsLabel, counts }: BlogNavProps) {
  const pathname = usePathname();
  const categories = Object.keys(categoryLabels) as Category[];

  const items: ContentSegmentNavItem[] = [
    { key: 'all', href: '/blog', label: allLabel, active: pathname === '/blog', count: counts?.all },
    ...categories.map(category => ({
      key: category,
      href: `/blog/${category}`,
      label: categoryLabels[category],
      active: pathname === `/blog/${category}`,
      count: counts?.[category],
    })),
    {
      key: 'tags',
      href: '/blog/tags',
      label: tagsLabel,
      active: pathname.startsWith('/blog/tags'),
      icon: <TagIcon className="size-3.5" />,
      count: counts?.tags,
      dividerBefore: true,
    },
  ];

  return <ContentSegmentNav items={items} />;
}
