'use client';

import { FileText, Leaf, SearchIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';

import { usePathname } from '@/src/shared/config/i18n';
import { useSearchIndex, useSearchPaletteShortcut } from '@/src/shared/hooks';
import type { SearchIndexPost } from '@/src/shared/lib/search';
import { SearchPalette, SearchTrigger, type SearchPaletteGroup } from '@/src/shared/ui';
import { ClientErrorBoundary } from '@/src/shared/ui/client-error-boundary';

type SearchScope = 'all' | 'blog' | 'garden';

interface SiteSearchProps {
  categoryLabels: Record<string, string>;
}

export function SiteSearch(props: SiteSearchProps) {
  return (
    <ClientErrorBoundary name="SiteSearch">
      <SiteSearchContent {...props} />
    </ClientErrorBoundary>
  );
}

// 현재 섹션이 기본 검색 범위가 된다. 섹션 안에서 열면 그 섹션 결과만 먼저 보여주고,
// 푸터의 전환으로 사이트 전체까지 넓힌다.
function scopeFromPathname(pathname: string): SearchScope {
  if (pathname.startsWith('/blog')) {
    return 'blog';
  }
  if (pathname.startsWith('/garden')) {
    return 'garden';
  }
  return 'all';
}

function groupPostsByCategory(posts: SearchIndexPost[]): Map<string, SearchIndexPost[]> {
  return posts.reduce((grouped, post) => {
    const list = grouped.get(post.category) ?? [];
    list.push(post);
    return grouped.set(post.category, list);
  }, new Map<string, SearchIndexPost[]>());
}

function SiteSearchContent({ categoryLabels }: SiteSearchProps) {
  const t = useTranslations('search');
  const locale = useLocale();
  const pathname = usePathname();

  const [open, setOpen] = React.useState(false);
  const [expandedToWholeSite, setExpandedToWholeSite] = React.useState(false);

  useSearchPaletteShortcut(setOpen);

  // 팔레트를 열 때마다 현재 섹션 범위로 되돌린다. 앞선 검색에서 넓혀둔 범위가 다음 검색까지
  // 따라오면 "어디를 검색하고 있는지"가 화면과 어긋난다.
  React.useEffect(() => {
    if (open) {
      setExpandedToWholeSite(false);
    }
  }, [open]);

  const index = useSearchIndex(locale, open);
  const contextScope = scopeFromPathname(pathname);
  const scope: SearchScope = expandedToWholeSite ? 'all' : contextScope;

  const groups = React.useMemo<SearchPaletteGroup[]>(() => {
    if (!index) {
      return [];
    }

    const blogGroups =
      scope === 'garden'
        ? []
        : Array.from(groupPostsByCategory(index.posts), ([category, posts]) => ({
            key: `blog-${category}`,
            label: categoryLabels[category] ?? category,
            items: posts.map(post => ({
              id: post.slug,
              label: post.title,
              href: `/blog/${post.category}/${post.slug}`,
              searchKeywords: `${post.description} ${post.tags.join(' ')}`,
              icon: FileText,
            })),
          }));

    // 가든은 PARA 분류로 쪼개지 않고 한 그룹으로 둔다. 실제 분포가 Resources에 몰려 있어
    // 분류별 그룹은 거대한 그룹 하나와 1~2건짜리 그룹들로 갈리고, 팔레트의 일은 분류를
    // 훑는 게 아니라 노트를 찾는 것이다.
    const gardenGroups =
      scope === 'blog' || index.notes.length === 0
        ? []
        : [
            {
              key: 'garden',
              label: t('gardenGroup'),
              items: index.notes.map(note => ({
                id: note.slug,
                label: note.title,
                href: `/garden/${note.slug}`,
                searchKeywords: `${note.excerpt} ${note.tags.join(' ')}`,
                icon: Leaf,
              })),
            },
          ];

    return [...blogGroups, ...gardenGroups];
  }, [index, scope, categoryLabels, t]);

  const scopeNotice = contextScope === 'blog' ? t('scopedToBlog') : t('scopedToGarden');

  return (
    <>
      <SearchTrigger
        onClick={() => setOpen(true)}
        placeholder={t('placeholder')}
        ariaLabel={t('aria')}
        className="hidden h-9 sm:flex sm:w-44 lg:w-56"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={t('aria')}
        className="sm:hidden"
      >
        <SearchIcon />
      </Button>

      <SearchPalette
        open={open}
        onOpenChange={setOpen}
        groups={groups}
        placeholder={t('placeholder')}
        emptyText={t('empty')}
        loading={open && index === null}
        loadingText={t('loading')}
        title={t('title')}
        description={t('description')}
        footer={
          contextScope === 'all' ? undefined : (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{expandedToWholeSite ? t('scopedToSite') : scopeNotice}</span>
              {!expandedToWholeSite && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setExpandedToWholeSite(true)}
                >
                  {t('searchEverywhere')}
                </Button>
              )}
            </div>
          )
        }
      />
    </>
  );
}
