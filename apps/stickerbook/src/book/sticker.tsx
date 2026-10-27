import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

import { peelResult } from '@/lib/interaction';

export type StickerState = 'attached' | 'clean' | 'residue';

export function Sticker({
  state,
  onChange,
  reduced,
  style,
}: {
  state: StickerState;
  onChange: (state: StickerState) => void;
  reduced: boolean;
  style?: CSSProperties;
}) {
  const [distance, setDistance] = useState(0);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    lastDistance: number;
    currentDistance: number;
    time: number;
    velocity: number;
  } | null>(null);
  const ignoreClick = useRef(false);
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    ignoreClick.current = start.currentDistance > 5 || cancel;
    if (!cancel) onChange(peelResult(start.currentDistance, start.velocity));
    gesture.current = null;
    setDistance(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const progress = Math.min(1, distance / 100);
  return (
    <div style={style} className="sticker-place" data-sticker-state={state}>
      {state === 'residue' && <span className="sticker-residue" aria-hidden="true" />}
      <button
        type="button"
        className={`sticker ${state !== 'attached' ? 'sticker-removed' : ''}`}
        aria-label={state === 'attached' ? '여우 스티커 떼기' : '여우 스티커 다시 붙이기'}
        aria-describedby="sticker-instructions"
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0 || gesture.current) return;
          ignoreClick.current = false;
          if (state !== 'attached') return;
          event.stopPropagation();
          gesture.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            lastDistance: 0,
            currentDistance: 0,
            time: event.timeStamp,
            velocity: 0,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          const start = gesture.current;
          if (!start || start.id !== event.pointerId) return;
          const nextDistance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
          const elapsed = event.timeStamp - start.time;
          start.currentDistance = nextDistance;
          if (elapsed >= 4) {
            start.velocity = Math.max(start.velocity, Math.max(0, nextDistance - start.lastDistance) / elapsed);
            start.time = event.timeStamp;
            start.lastDistance = nextDistance;
          }
          setDistance(nextDistance);
        }}
        onPointerUp={event => finish(event)}
        onPointerCancel={event => finish(event, true)}
        onLostPointerCapture={event => finish(event, true)}
        onClick={event => {
          if (ignoreClick.current && event.detail !== 0) {
            ignoreClick.current = false;
            return;
          }
          onChange(state === 'attached' ? (event.shiftKey ? 'residue' : 'clean') : 'attached');
        }}
      >
        <span
          className="sticker-face"
          style={{
            transform: reduced
              ? undefined
              : `perspective(400px) translateY(${-progress * 18}px) rotateX(${progress * 65}deg) rotateZ(${-progress * 10}deg)`,
            opacity: state === 'attached' ? 1 : 0.32,
          }}
        >
          <img src="/fox.svg" alt="" draggable="false" />
          <span className="sticker-sheen" style={{ opacity: progress, transform: `translateY(${progress * -40}%)` }} />
          <span className="sticker-back" style={{ height: `${progress * 48}%` }} />
        </span>
      </button>
    </div>
  );
}
