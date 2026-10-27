import { ArrowLeft, ArrowRight, BookOpen, HelpCircle, RotateCcw, X } from 'lucide-react';
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@mumak/ui/components/dialog';

import { AlbumPage } from '@/book/album-page';
import { exifLabel, photographs, type Photograph } from '@/book/catalog';
import type { StickerState } from '@/book/sticker';
import { TurningPage } from '@/book/turning-page';
import { useBookTurn } from '@/book/use-book-turn';
import { DeskProps } from '@/components/desk-props';
import { useBookLayout, useReducedMotion } from '@/hooks/use-book-layout';
import { nextPage, shouldCompleteTurn, visibleStart } from '@/lib/interaction';

export function App() {
  const stage = useRef<HTMLDivElement>(null);
  const book = useRef<HTMLDivElement>(null);
  const layout = useBookLayout(stage);
  const reduced = useReducedMotion();
  const navigation = useBookTurn(layout, photographs.length, reduced || layout.compact);
  const [stickers, setStickers] = useState<Record<number, StickerState>>({});
  const [photo, setPhoto] = useState<Photograph | null>(null);
  const photoTrigger = useRef<HTMLButtonElement | null>(null);
  const helpTrigger = useRef<HTMLButtonElement>(null);
  const [help, setHelp] = useState(false);
  const [closed, setClosed] = useState(false);
  const [message, setMessage] = useState('');
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    lastX: number;
    time: number;
    direction: -1 | 1;
    velocity: number;
    distance: number;
  } | null>(null);
  const start = visibleStart(navigation.page);
  const end = start + 1;
  const pageWidth = (layout.width - layout.gap) / 2;

  function openPhoto(value: Photograph, trigger: HTMLButtonElement) {
    photoTrigger.current = trigger;
    setPhoto(value);
  }
  function changeSticker(index: number, state: StickerState) {
    setStickers(current => ({ ...current, [index]: state }));
    setMessage(
      state === 'residue'
        ? '확 떼니 자국이 남았어요. 다시 붙이거나 되돌릴 수 있어요.'
        : state === 'clean'
          ? '깨끗하게 떼어냈어요. 흐릿한 스티커를 누르면 다시 붙어요.'
          : '스티커를 다시 붙였어요.'
    );
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      closed ||
      layout.compact ||
      navigation.busy ||
      pointer.current ||
      !event.isPrimary ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest('button')
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const direction = event.clientX - bounds.left < bounds.width * 0.5 ? -1 : 1;
    const gripY = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    if (reduced || !navigation.begin(direction, false, { y: gripY, pullY: 0 })) return;
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      time: event.timeStamp,
      direction,
      velocity: 0,
      distance: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId || !navigation.turn) return;
    current.distance = (current.x - event.clientX) * current.direction;
    const elapsed = event.timeStamp - current.time;
    if (elapsed >= 12) {
      current.velocity = ((current.lastX - event.clientX) * current.direction) / elapsed;
      current.lastX = event.clientX;
      current.time = event.timeStamp;
    }
    const vertical = current.y - event.clientY;
    const lift = Math.min(pageWidth * 0.16, Math.abs(vertical) * 0.25);
    navigation.drag((Math.max(0, current.distance) + lift) / (pageWidth * 2), vertical / pageWidth);
  }
  function pointerEnd(event: PointerEvent<HTMLDivElement>, cancel = false) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    const velocity = event.timeStamp - current.time > 120 ? 0 : current.velocity;
    navigation.settle(!cancel && shouldCompleteTurn(current.distance / (pageWidth * 2), velocity));
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const renderPage = (index: number) => (
    <AlbumPage
      key={index}
      index={index}
      photo={photographs[index]!}
      stickers={stickers}
      onSticker={changeSticker}
      onPhoto={openPhoto}
      reduced={reduced}
    />
  );

  return (
    <main className="desk" data-posture={layout.posture}>
      <h1 className="sr-only">사진 스티커북</h1>
      <div className="desk-stage" ref={stage}>
        <DeskProps onMessage={setMessage} />
        {/* Keyboard-focusable composite reading surface; its buttons retain native roles. */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        <div
          ref={book}
          className={`book ${closed ? 'book-closed' : ''}`}
          data-layout={layout.mode}
          data-compact={layout.compact}
          data-turning={navigation.busy}
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Focusable reading region supports arrow-key navigation.
          tabIndex={0}
          role="region"
          aria-label="사진 스티커북"
          aria-describedby="book-instructions"
          style={
            {
              width: layout.width,
              height: layout.height,
              left: layout.x,
              top: layout.y,
              '--hinge-gap': `${layout.gap}px`,
            } as CSSProperties
          }
          onKeyDown={event => {
            if (event.target !== event.currentTarget || closed) return;
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              event.preventDefault();
              navigation.navigate(event.key === 'ArrowRight' ? 1 : -1, true);
            }
            if (event.key === 'Escape') {
              pointer.current = null;
              navigation.cancel();
            }
          }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={event => pointerEnd(event)}
          onPointerCancel={event => pointerEnd(event, true)}
          onLostPointerCapture={event => pointerEnd(event, true)}
        >
          {closed ? (
            <button type="button" className="book-cover" onClick={() => setClosed(false)}>
              <span className="cover-mark">W / S</span>
              <span className="cover-title">stickerbook</span>
              <span className="cover-subtitle">Photographs by Wan Sim</span>
              <span className="cover-open">눌러서 펼치기</span>
            </button>
          ) : (
            <>
              <div className="book-pages" style={{ gap: layout.gap }} inert={navigation.busy || undefined}>
                {renderPage(start)}
                {renderPage(end)}
              </div>
              {navigation.turn && <TurningPage turn={navigation.turn} layout={layout} stickers={stickers} />}
              <span className="page-corner corner-left" aria-hidden="true" />
              <span className="page-corner corner-right" aria-hidden="true" />
            </>
          )}
        </div>
      </div>
      <footer className="desk-footer">
        <nav className="page-navigation" aria-label="책 페이지 이동">
          <button
            type="button"
            className="nav-arrow"
            aria-label="이전 페이지"
            disabled={closed || navigation.busy || start === 0}
            onClick={event => navigation.navigate(-1, event.detail === 0)}
          >
            <ArrowLeft size={20} />
          </button>
          <p className="page-counter" aria-live="polite" aria-atomic="true">
            <span>
              {String(start + 1).padStart(2, '0')}
              {` — ${String(end + 1).padStart(2, '0')}`}
            </span>
            <span> / {String(photographs.length).padStart(2, '0')}</span>
          </p>
          <button
            type="button"
            className="nav-arrow"
            aria-label="다음 페이지"
            disabled={closed || navigation.busy || nextPage(start, 1, photographs.length) === start}
            onClick={event => navigation.navigate(1, event.detail === 0)}
          >
            <ArrowRight size={20} />
          </button>
        </nav>
        <div className="book-tools">
          <button
            type="button"
            className="desk-button"
            onClick={() => {
              navigation.cancel();
              pointer.current = null;
              setClosed(!closed);
            }}
            aria-label={closed ? '책 펼치기' : '책 덮기'}
          >
            <BookOpen size={18} />
          </button>
          <button
            type="button"
            className="desk-button"
            ref={helpTrigger}
            aria-label="이용 안내"
            onClick={() => setHelp(true)}
          >
            <HelpCircle size={20} />
          </button>
          <button
            type="button"
            className="desk-button"
            aria-label="스티커 되돌리기"
            disabled={navigation.busy}
            onClick={() => {
              setStickers({});
              setMessage('모든 스티커와 자국을 처음 상태로 돌렸어요.');
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </footer>
      <p className="desk-message" role="status">
        {message}
      </p>
      <p id="book-instructions" className="sr-only">
        종이 여백의 위쪽이나 아래쪽을 잡고 대각선으로 드래그하거나 이전·다음 버튼으로 넘깁니다. 책에 포커스를 두고
        방향키로도 이동합니다. Escape는 진행 중인 넘김을 취소합니다.
      </p>
      <p id="sticker-instructions" className="sr-only">
        드래그해 천천히 떼면 깨끗하고 빠르게 떼면 자국이 남습니다. 클릭이나 Enter는 천천히 떼기, Shift와 함께 누르면
        빠르게 떼기입니다. 다시 누르면 붙입니다.
      </p>
      <Dialog
        open={!!photo}
        onOpenChange={open => {
          if (!open) setPhoto(null);
        }}
      >
        <DialogContent
          className="photo-dialog"
          showCloseButton={false}
          onCloseAutoFocus={event => {
            event.preventDefault();
            if (photoTrigger.current?.isConnected) photoTrigger.current.focus();
            else book.current?.focus();
          }}
        >
          <DialogClose asChild>
            <button type="button" className="dialog-close" aria-label="사진 닫기">
              <X />
            </button>
          </DialogClose>
          {photo && (
            <>
              <img src={photo.src} alt={photo.alt} className="enlarged-photo" />
              <DialogTitle>{photo.title}</DialogTitle>
              <DialogDescription>{exifLabel(photo)}</DialogDescription>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent
          className="help-dialog"
          onCloseAutoFocus={event => {
            event.preventDefault();
            helpTrigger.current?.focus();
          }}
        >
          <DialogTitle>천천히, 만져보세요.</DialogTitle>
          <DialogDescription>책상 위 작은 사진 전시</DialogDescription>
          <ul className="help-list">
            <li>종이 여백을 잡아 좌우로 넘겨보세요. 이동 버튼과 방향키로도 볼 수 있어요.</li>
            <li>사진을 누르면 크게 볼 수 있어요.</li>
            <li>
              여우 스티커를 천천히 떼면 깨끗하게, 빠르게 떼면 자국이 남아요. 클릭은 천천히, Shift + 클릭은 빠르게
              떼기예요.
            </li>
            <li>커피잔, 카메라, 연필에도 작은 반응이 숨어 있어요.</li>
            <li>기기를 돌리거나 창 크기를 바꾸면 책이 화면에 맞춰져요.</li>
          </ul>
          <p className="prototype-note">
            프로토타입: Unsplash 샘플 사진과 임시 여우 스티커를 사용해요. 실제 fursona와 원본 EXIF는 아직 연결하지
            않았어요. 스티커 변화는 새로고침하면 초기화돼요.
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
