'use client';

import { FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

import { useSearchIndex, useSearchPaletteShortcut } from '@/src/shared/hooks';
import type { SearchIndexPost } from '@/src/shared/lib/search';
import { SearchPalette, SearchTrigger, type SearchPaletteGroup } from '@/src/shared/ui';
import { ClientErrorBoundary } from '@/src/shared/ui/client-error-boundary';

interface BlogSearchProps {
  categoryLabels: Record<string, string>;
  triggerClassName?: string;
}

export function BlogSearch({ categoryLabels, triggerClassName }: BlogSearchProps) {
  return (
    <ClientErrorBoundary name="BlogSearch">
      <BlogSearchContent categoryLabels={categoryLabels} triggerClassName={triggerClassName} />
    </ClientErrorBoundary>
  );
}

function BlogSearchContent({ categoryLabels, triggerClassName }: BlogSearchProps) {
  const t = useTranslations('blog.search');
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  useSearchPaletteShortcut(setOpen);

  // 검색 데이터셋은 페이지 RSC payload가 아니라, 검색창을 처음 열 때 정적 search-index.json에서
  // 1회 lazy fetch한다 (C-3).
  const index = useSearchIndex(locale, open);
  const posts = React.useMemo<SearchIndexPost[]>(() => index?.posts ?? [], [index]);

  const groups = React.useMemo<SearchPaletteGroup[]>(() => {
    const grouped = new Map<string, SearchIndexPost[]>();
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
