import { getTranslations } from 'next-intl/server';

import type { SeriesContext } from '@/src/entities/post';
import { Link } from '@/src/shared/config/i18n';

interface SeriesNavProps {
  series: SeriesContext;
}

const LABEL_ID = 'series-nav-label';

/**
 * 시리즈 글 상단의 목차.
 *
 * 이 블록이 생기기 전에는 각 편 본문에 "1부/2부/3부" 링크 목록을 손으로 적어뒀는데,
 * 편이 늘 때마다 모든 편을 고쳐야 했고 locale마다 따로 관리해야 했다. frontmatter의
 * series/part에서 같은 목록을 만들어 그 유지보수를 없앤다.
 *
 * 라벨을 heading이 아니라 p로 두는 건 의도다. h2로 두면 본문 섹션들과 같은 층에
 * 끼어들어 글의 목차가 "시리즈 이름 → 1장 → 2장…"처럼 읽힌다.
 */
export async function SeriesNav({ series }: SeriesNavProps) {
  const t = await getTranslations('post');
  const { parts, current } = series;

  return (
    <nav
      data-slot="series-nav"
      aria-labelledby={LABEL_ID}
      className="mb-8 rounded-lg border border-border bg-muted/40 p-4"
    >
      <p id={LABEL_ID} className="text-sm font-semibold">
        {current.series}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {t('seriesProgress', { current: current.part ?? 1, total: parts.length })}
      </p>

      <ol className="mt-3 space-y-1.5 text-sm">
        {parts.map(part => {
          const isCurrent = part.category === current.category && part.slug === current.slug;

          return (
            <li key={`${part.category}-${part.slug}`} className="flex gap-2">
              <span className="w-4 shrink-0 text-right text-muted-foreground tabular-nums">{part.part}</span>
              {isCurrent ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {part.title}
                </span>
              ) : (
                <Link
                  href={`/blog/${part.category}/${part.slug}`}
                  className="text-accent-foreground underline-offset-4 hover:underline"
                >
                  {part.title}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
