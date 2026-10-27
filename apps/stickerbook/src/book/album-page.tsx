import { exifLabel, stickerPlacements, tapePlacements, type Photograph } from '@/book/catalog';
import { Sticker, type StickerState } from '@/book/sticker';

export function AlbumPage({
  photo,
  index,
  stickers,
  onSticker,
  onPhoto,
  reduced,
  decorative = false,
}: {
  photo: Photograph;
  index: number;
  stickers: Record<number, StickerState>;
  onSticker: (id: number, state: StickerState) => void;
  onPhoto: (photo: Photograph, trigger: HTMLButtonElement) => void;
  reduced: boolean;
  decorative?: boolean;
}) {
  return (
    <article
      className={`album-page ${index % 2 ? 'page-right' : 'page-left'}`}
      aria-label={`${index + 1}쪽: ${photo.title}`}
      aria-hidden={decorative || undefined}
      inert={decorative || undefined}
    >
      <h2 className="sr-only">{photo.title}</h2>
      <button
        type="button"
        className="polaroid"
        aria-label={`${photo.title} 사진 크게 보기`}
        onClick={event => onPhoto(photo, event.currentTarget)}
      >
        {tapePlacements(index).map((tape, slot) => (
          <span
            key={slot}
            className="tape"
            aria-hidden="true"
            style={{
              left: `${(tape.x / 388) * 100}%`,
              top: `${(tape.y / 356) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${tape.rotation}deg)`,
            }}
          />
        ))}
        <img src={photo.src} alt={photo.alt} draggable="false" fetchPriority={index < 2 ? 'high' : 'auto'} />
        <span className="photo-exif">{exifLabel(photo)}</span>
      </button>
      {stickerPlacements(index).map(placement => (
        <Sticker
          key={placement.id}
          style={{
            left: `${(placement.x / 480) * 100}%`,
            top: `${(placement.y / 620) * 100}%`,
            width: `${(placement.size / 480) * 100}%`,
            transform: `rotate(${placement.rotation}deg)`,
          }}
          state={stickers[placement.id] ?? 'attached'}
          onChange={state => onSticker(placement.id, state)}
          reduced={reduced}
        />
      ))}
      <span className="page-number" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
    </article>
  );
}
