import { memo } from 'react';

import { AlbumPage } from '@/book/album-page';
import { photographs } from '@/book/catalog';
import { pageFold } from '@/book/page-fold';
import type { StickerState } from '@/book/sticker';
import type { BookLayout, PaperGrip } from '@/lib/interaction';

export type Turn = { from: number; to: number; direction: -1 | 1; progress: number; grip: PaperGrip };
const noop = () => {};
const DecorativePage = memo(function DecorativePage({
  index,
  stickers,
}: {
  index: number;
  stickers: Record<number, StickerState>;
}) {
  return (
    <AlbumPage
      photo={photographs[index]!}
      index={index}
      stickers={stickers}
      onSticker={noop}
      onPhoto={noop}
      reduced
      decorative
    />
  );
});

export function TurningPage({
  turn,
  layout,
  stickers,
}: {
  turn: Turn;
  layout: BookLayout;
  stickers: Record<number, StickerState>;
}) {
  const forward = turn.direction === 1;
  const front = forward ? turn.from + 1 : turn.from;
  const back = forward ? turn.to : turn.to + 1;
  const pageWidth = (layout.width - layout.gap) / 2;
  const pieces = pageFold(pageWidth, layout.height, turn.progress, turn.direction, turn.grip);
  const origin = pageWidth + (forward ? layout.gap * (1 - turn.progress) : layout.gap * turn.progress);
  return (
    <div
      className="turn-layer"
      aria-hidden="true"
      inert
      data-renderer="dom"
      data-progress={turn.progress}
      style={{ visibility: turn.progress === 0 ? 'hidden' : 'visible' }}
    >
      <div className="book-pages" style={{ gap: layout.gap }}>
        <DecorativePage index={forward ? turn.from : turn.to} stickers={stickers} />
        <DecorativePage index={forward ? turn.to + 1 : turn.from + 1} stickers={stickers} />
      </div>
      {pieces.map((piece, index) => (
        <div
          key={index}
          className="fold-piece"
          data-face={piece.face}
          style={{
            width: pageWidth,
            left: origin,
            clipPath: piece.clip,
            transform: `matrix(${piece.matrix.join(',')})`,
          }}
        >
          <DecorativePage index={piece.face === 'front' ? front : back} stickers={stickers} />
          {piece.shade > 0 && <span className="fold-shade" style={{ background: piece.shading }} />}
        </div>
      ))}
    </div>
  );
}
