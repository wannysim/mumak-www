import { Bookmark } from 'lucide-react';

import type { Progress } from '@/lib/progress';
import { saveProgress } from '@/lib/progress-store';

export function ReviewToggle({ id, progress }: { id: string; progress: Progress }) {
  const saved = progress.review.includes(id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() =>
        // Decide from the latest progress, not this render's `saved`, in case a sync changed it since render.
        saveProgress(p => ({
          ...p,
          review: p.review.includes(id) ? p.review.filter(item => item !== id) : [...p.review, id],
        }))
      }
      className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs text-primary"
    >
      <Bookmark className={`size-4 ${saved ? 'fill-primary' : ''}`} aria-hidden />
      {saved ? '저장됨' : '다시 보기'}
    </button>
  );
}
