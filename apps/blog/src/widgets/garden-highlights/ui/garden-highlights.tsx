import { getTranslations } from 'next-intl/server';

import { type NoteMeta } from '@/src/entities/note';
import { ArrowLink } from '@/src/shared/ui';
import { NoteCard } from '@/src/widgets/note-card';

interface GardenHighlightsProps {
  notes: NoteMeta[];
  locale: string;
  totalCount: number;
}

// 홈에서 가든을 대표하는 블록. "최신 글" 섹션과 의도적으로 같은 모양이다 — 같은 h2 위계,
// 같은 ContentCard shell(NoteCard), 같은 개수, 같은 "전체 보기" 마무리. 두 섹션이 다르게
// 생기면 어느 쪽이 더 중요한지에 대한 신호를 주게 되는데, 홈에서 둘은 대등하다.
//
// 성장 단계 배지만 끈다. 실제로 관리되는 축이 아니라서 가든 안에서만 쓴다.
export async function GardenHighlights({ notes, locale, totalCount }: GardenHighlightsProps) {
  if (notes.length === 0) {
    return null;
  }

  const t = await getTranslations('home');

  return (
    <section data-slot="garden-highlights">
      {/* h2 클래스는 홈 page.tsx의 "최신 글" h2와 문자 그대로 같아야 한다(두 블록 대칭 계약). */}
      <h2 className="text-2xl font-semibold mb-4 md:mb-6">{t('gardenTitle')}</h2>

      {/* 카드 간격은 홈 page.tsx의 "최신 글" 리스트와 문자 그대로 같아야 한다(두 블록 대칭 계약). */}
      <div className="space-y-4 md:space-y-6">
        {notes.map(note => (
          <NoteCard key={note.slug} note={note} locale={locale} showStatus={false} />
        ))}
      </div>

      <div className="mt-6">
        <ArrowLink href="/garden">{t('gardenCta', { count: totalCount })}</ArrowLink>
      </div>
    </section>
  );
}
