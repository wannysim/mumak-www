import { getAllNoteTags, getNotes, type NoteStatus } from '@/src/entities/note';
import { type Locale } from '@/src/shared/config/i18n';

const STATUSES: NoteStatus[] = ['seedling', 'budding', 'evergreen'];

// ContentSegmentNav item key별 카운트. key는 GardenNav가 만드는 item key와 맞춘다
// ('all' | status | 'tags'). 서버에서 계산해 client GardenNav에 prop으로 내려준다.
export function getGardenNavCounts(locale: Locale): Record<string, number> {
  const notes = getNotes(locale);

  const counts: Record<string, number> = { all: notes.length };
  for (const status of STATUSES) {
    counts[status] = notes.filter(note => note.status === status).length;
  }
  counts.tags = getAllNoteTags(locale).length;

  return counts;
}
