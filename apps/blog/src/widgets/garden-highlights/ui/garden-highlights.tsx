import { getTranslations } from 'next-intl/server';

import { cn } from '@mumak/ui/lib/utils';

import { type NoteMeta } from '@/src/entities/note';
import { Link } from '@/src/shared/config/i18n';
import { formatDateForLocale } from '@/src/shared/lib/date';
import { ArrowLink, cardSurfaceClass } from '@/src/shared/ui';

interface GardenHighlightsProps {
  notes: NoteMeta[];
  locale: string;
  totalCount: number;
}

// 홈에서 가든을 대표하는 블록. 최신 글 블록과 같은 h2 위계를 갖되, 카드 형태는 다르다.
// 노트는 글보다 짧고 수가 많아서 전문 카드 대신 제목 중심 타일로 훑게 한다.
//
// 성장 상태(씨앗/새싹) 배지는 의도적으로 넣지 않는다. 실제로 관리되지 않는 축이라
// 홈에서 광고하면 없는 편집 관행을 약속하는 셈이 된다. 갱신일이 그 자리를 대신한다.
export async function GardenHighlights({ notes, locale, totalCount }: GardenHighlightsProps) {
  if (notes.length === 0) {
    return null;
  }

  const t = await getTranslations('home');

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-6">{t('gardenTitle')}</h2>

      <div data-slot="garden-highlights" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {notes.map(note => {
          const date = note.updated || note.created;
          return (
            <Link
              key={note.slug}
              href={`/garden/${note.slug}`}
              className={cn(cardSurfaceClass, 'group flex flex-col gap-1.5 p-4')}
            >
              <span className="font-medium tracking-tight transition-colors group-hover:text-primary line-clamp-2">
                {note.title}
              </span>
              {note.excerpt && (
                <span className="text-sm leading-relaxed text-muted-foreground line-clamp-2">{note.excerpt}</span>
              )}
              <time dateTime={date} className="mt-auto pt-1 text-xs text-muted-foreground">
                {formatDateForLocale(date, locale).text}
              </time>
            </Link>
          );
        })}
      </div>

      <div className="mt-4">
        <ArrowLink href="/garden">{t('gardenCta', { count: totalCount })}</ArrowLink>
      </div>
    </section>
  );
}
