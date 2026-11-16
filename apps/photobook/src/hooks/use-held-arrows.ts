import { useEffect, useEffectEvent } from 'react';

import { isTextEntry } from '@/lib/keyboard-focus';
import type { ArrowKey } from '@/model/book/keyboard';
import { arrowDirection, hasCommandModifier, isArrowKey } from '@/model/book/keyboard';
import type { Vec2 } from '@/model/fold';

/**
 * 누르고 있는 화살표. enabled인 동안 문서 전체의 keydown·keyup으로 들고, 조합이 바뀔 때마다 방향 합(keyboard.ts
 * arrowDirection)을 알린다. 닫힌 책은 포커스가 책에 없어도(body 포함) 화살표로 돈다(2026-11-16 사용자 결정. 닫힌 화면에는
 * 스크롤도 화살표를 쓰는 다른 컨트롤도 없다. tech-research.md 7장 공통 규칙 "키 범위"의 예외).
 * - 입력칸·편집 영역에서 누른 화살표와, 앞선 처리기가 이미 막은(defaultPrevented) 키는 받지 않는다.
 * - 받은 화살표는 페이지 스크롤을 막는다. 자동 반복 keydown은 이미 든 키라 무시한다.
 * - 창이 포커스를 잃거나 Alt·Ctrl·Meta를 누르면 다 뗀 것으로 본다(macOS는 Meta를 누른 동안 keyup을 보내지 않는다).
 * - 꺼지면(펼치기 시작 등) 들고 있던 화살표를 알리지 않고 버린다. 모델은 닫힌 상태에서만 화살표 회전을 받는다.
 */
export function useHeldArrows(enabled: boolean, onChange: (direction: Vec2) => void): void {
  const notify = useEffectEvent(onChange);
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let held: ReadonlySet<ArrowKey> = new Set();
    const hold = (next: ReadonlySet<ArrowKey>) => {
      held = next;
      notify(arrowDirection(next));
    };
    const releaseAll = () => {
      if (held.size > 0) {
        hold(new Set());
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (hasCommandModifier(event)) {
        releaseAll();
        return;
      }
      const { key } = event;
      if (!isArrowKey(key) || event.defaultPrevented || isTextEntry(event.target)) {
        return;
      }
      event.preventDefault();
      if (!held.has(key)) {
        hold(new Set([...held, key]));
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const { key } = event;
      if (isArrowKey(key) && held.has(key)) {
        hold(new Set([...held].filter(other => other !== key)));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseAll);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseAll);
    };
  }, [enabled]);
}
