'use client';

import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { useSearchPaletteShortcut } from '@/src/shared/hooks';
import { SearchPalette, SearchTrigger, type SearchPaletteGroup } from '@/src/shared/ui';

export interface BlogSearchPost {
  title: string;
  description: string;
  category: string;
  slug: string;
  tags: string[];
}

interface BlogSearchProps {
  posts: BlogSearchPost[];
  categoryLabels: Record<string, string>;
  triggerClassName?: string;
}

export function BlogSearch({ posts, categoryLabels, triggerClassName }: BlogSearchProps) {
  const t = useTranslations('blog.search');
  const [open, setOpen] = React.useState(false);
  useSearchPaletteShortcut(setOpen);

  const groups = React.useMemo<SearchPaletteGroup[]>(() => {
    const grouped = new Map<string, BlogSearchPost[]>();
    for (const post of posts) {
      const list = grouped.get(post.category) ?? [];
      list.push(post);
      grouped.set(post.category, list);
    }
    return Array.from(grouped.entries()).map(([category, categoryPosts]) => ({
      key: category,
      label: categoryLabels[category] ?? category,
      items: categoryPosts.map(post => ({
        id: post.slug,
        label: post.title,
        href: `/blog/${post.category}/${post.slug}`,
        searchKeywords: `${post.description} ${post.tags.join(' ')}`,
        icon: FileText,
        hint: categoryLabels[post.category] ?? post.category,
      })),
    }));
  }, [posts, categoryLabels]);

  return (
    <>
      <SearchTrigger
        onClick={() => setOpen(true)}
        placeholder={t('placeholder')}
        ariaLabel={t('aria')}
        className={triggerClassName}
      />
      <SearchPalette
        open={open}
        onOpenChange={setOpen}
        groups={groups}
        placeholder={t('placeholder')}
        emptyText={t('empty')}
        title={t('title')}
        description={t('description')}
      />
    </>
  );
}
