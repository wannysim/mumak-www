'use client';

import { TagIcon } from 'lucide-react';

import { type Category } from '@/src/entities/post';
import { usePathname } from '@/src/shared/config/i18n';
import { ContentSegmentNav, type ContentSegmentNavItem } from '@/src/shared/ui/content-segment-nav';

interface BlogNavProps {
  allLabel: string;
  categoryLabels: Record<Category, string>;
  tagsLabel?: string;
}

export function BlogNav({ allLabel, categoryLabels, tagsLabel }: BlogNavProps) {
  const pathname = usePathname();
  const categories = Object.keys(categoryLabels) as Category[];

  const items: ContentSegmentNavItem[] = [
    { key: 'all', href: '/blog', label: allLabel, active: pathname === '/blog' },
    ...categories.map(category => ({
      key: category,
      href: `/blog/${category}`,
      label: categoryLabels[category],
      active: pathname === `/blog/${category}`,
    })),
    {
      key: 'tags',
      href: '/blog/tags',
      label: tagsLabel,
      active: pathname.startsWith('/blog/tags'),
      icon: <TagIcon className="size-3.5" />,
      dividerBefore: true,
    },
  ];

  return <ContentSegmentNav items={items} />;
}
