import { describe, expect, it } from 'vitest';

import type { KeyInput } from '../keyboard';
import {
  arrowDirection,
  closedBookKeyAction,
  documentKeyAction,
  hasCommandModifier,
  isArrowKey,
  openBookKeyAction,
} from '../keyboard';

function key(name: string, modifiers: Partial<KeyInput> = {}): KeyInput {
  return { key: name, altKey: false, ctrlKey: false, metaKey: false, ...modifiers };
}

describe('keyboard', () => {
  it.each([
    ['Enter', 'open'],
    [' ', 'open'],
    // 화살표 회전은 버튼이 아니라 문서 전체에서 받는다(use-held-arrows.ts).
    ['ArrowRight', null],
    ['Tab', null],
    ['constructor', null],
  ])('should map %j on the closed book button to %s', (name, action) => {
    expect(closedBookKeyAction(key(name))).toBe(action);
  });

  it.each([
    ['ArrowLeft', 'previous'],
    ['ArrowRight', 'next'],
    ['ArrowUp', null],
    ['Enter', null],
  ])('should map %j in the open book to %s', (name, action) => {
    expect(openBookKeyAction(key(name))).toBe(action);
  });

  it.each([{ altKey: true }, { ctrlKey: true }, { metaKey: true }])(
    'should leave browser shortcuts alone (%o)',
    modifiers => {
      expect(closedBookKeyAction(key('Enter', modifiers))).toBeNull();
      expect(openBookKeyAction(key('ArrowRight', modifiers))).toBeNull();
      expect(documentKeyAction(key('Escape', modifiers))).toBeNull();
    }
  );

  it('should add up held arrows the way a drag points and cancel opposite ones', () => {
    // →는 오른쪽으로, ↓는 아래로 끈 것과 같은 방향이다.
    expect(arrowDirection(['ArrowRight'])).toEqual({ x: 1, y: 0 });
    expect(arrowDirection(['ArrowUp', 'ArrowLeft'])).toEqual({ x: -1, y: -1 });
    expect(arrowDirection(['ArrowDown'])).toEqual({ x: 0, y: 1 });
    expect(arrowDirection(['ArrowLeft', 'ArrowRight'])).toEqual({ x: 0, y: 0 });
    expect(arrowDirection([])).toEqual({ x: 0, y: 0 });
    expect(isArrowKey('ArrowUp')).toBe(true);
    expect(isArrowKey('constructor')).toBe(false);
    expect(hasCommandModifier(key('Meta', { metaKey: true }))).toBe(true);
    expect(hasCommandModifier(key('Shift'))).toBe(false);
  });

  it('should close with Escape anywhere, but not while composing text', () => {
    expect(documentKeyAction(key('Escape'))).toBe('close');
    expect(documentKeyAction({ ...key('Escape'), isComposing: true })).toBeNull();
    expect(documentKeyAction(key('Enter'))).toBeNull();
  });
});
