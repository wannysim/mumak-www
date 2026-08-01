import { Button } from '@mumak/ui/components/button';

import type { ShareScopeKind } from '@/lib/share/bundle';
import type { ShareImportPlan } from '@/lib/share/import-plan';

function importButtonLabel(kind: ShareScopeKind): string {
  if (kind === 'song') return '이 곡 가져오기';
  if (kind === 'playlist') return '이 재생목록 가져오기';
  return '이 기기의 보관함 교체';
}

export function ImportSummary({
  plan,
  applying,
  onApply,
}: {
  plan: ShareImportPlan;
  applying: boolean;
  onApply: () => void;
}) {
  const { summary } = plan;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 p-4">
        <div className="border-border grid grid-cols-3 divide-x border-y py-4 text-center">
          <div>
            <strong className="font-utility block text-lg tabular-nums">{summary.playlistCount}</strong>
            <span className="text-muted-foreground text-xs">재생목록</span>
          </div>
          <div>
            <strong className="font-utility block text-lg tabular-nums">{summary.songCount}</strong>
            <span className="text-muted-foreground text-xs">곡</span>
          </div>
          <div>
            <strong className="font-utility block text-lg tabular-nums">{summary.lyricCount}</strong>
            <span className="text-muted-foreground text-xs">가사</span>
          </div>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">새로 추가</dt>
            <dd>
              곡 {summary.newSongCount} · 재생목록 {summary.newPlaylistCount}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">기존 항목 변경</dt>
            <dd>
              곡 {summary.changedSongCount} · 재생목록 {summary.changedPlaylistCount}
            </dd>
          </div>
          {summary.kind === 'library' && (summary.removedSongCount > 0 || summary.removedPlaylistCount > 0) && (
            <div className="text-destructive flex justify-between gap-4">
              <dt>보관함에서 제외</dt>
              <dd>
                곡 {summary.removedSongCount} · 재생목록 {summary.removedPlaylistCount}
              </dd>
            </div>
          )}
        </dl>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {summary.includesLyrics
            ? 'QR에 포함된 곡의 가사는 덮어씁니다. 다른 곡의 기존 가사는 지우지 않습니다.'
            : '가사는 포함되지 않았으며 이 기기에 저장된 가사는 그대로 둡니다.'}
        </p>
      </div>
      <div className="border-border border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant={summary.kind === 'library' ? 'destructive' : 'default'}
          className="min-h-11 w-full rounded-none"
          disabled={applying}
          onClick={onApply}
        >
          {applying ? '저장하는 중…' : importButtonLabel(summary.kind)}
        </Button>
      </div>
    </div>
  );
}
