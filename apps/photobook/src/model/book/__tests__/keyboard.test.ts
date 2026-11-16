import { describe, expect, it } from 'vitest';

import type { KeyInput } from '../keyboard';
import { closedBookKeyAction, documentKeyAction, openBookKeyAction } from '../keyboard';

function key(name: string, modifiers: Partial<KeyInput> = {}): KeyInput {
  return { key: name, altKey: false, ctrlKey: false, metaKey: false, ...modifiers };
}

describe('keyboard', () => {
  it.each([
    ['Enter', { type: 'open' }],
    [' ', { type: 'open' }],
    // →는 오른쪽으로, ↓는 아래로 끈 것과 같은 방향이다.
    ['ArrowLeft', { type: 'rotate', rotation: { axis: 'horizontal', step: -1 } }],
    ['ArrowRight', { type: 'rotate', rotation: { axis: 'horizontal', step: 1 } }],
    ['ArrowUp', { type: 'rotate', rotation: { axis: 'vertical', step: -1 } }],
    ['ArrowDown', { type: 'rotate', rotation: { axis: 'vertical', step: 1 } }],
    ['Tab', null],
    ['constructor', null],
  ])('should map %j on the closed book to %o', (name, action) => {
    expect(closedBookKeyAction(key(name))).toEqual(action);
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
      expect(closedBookKeyAction(key('ArrowRight', modifiers))).toBeNull();
      expect(openBookKeyAction(key('ArrowRight', modifiers))).toBeNull();
      expect(documentKeyAction(key('Escape', modifiers))).toBeNull();
    }
  );

  it('should close with Escape anywhere, but not while composing text', () => {
    expect(documentKeyAction(key('Escape'))).toBe('close');
    expect(documentKeyAction({ ...key('Escape'), isComposing: true })).toBeNull();
    expect(documentKeyAction(key('Enter'))).toBeNull();
  });
});
