import { describe, expect, it } from 'vitest';

import type { KeyInput } from '../keyboard';
import { closedBookKeyAction, openBookKeyAction } from '../keyboard';

function key(name: string, modifiers: Partial<KeyInput> = {}): KeyInput {
  return { key: name, altKey: false, ctrlKey: false, metaKey: false, ...modifiers };
}

describe('keyboard', () => {
  it.each([
    ['Enter', 'open'],
    [' ', 'open'],
    ['ArrowLeft', 'rotate-left'],
    ['ArrowRight', 'rotate-right'],
    ['Tab', null],
  ])('should map %j on the closed book to %s', (name, action) => {
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
      expect(closedBookKeyAction(key('ArrowRight', modifiers))).toBeNull();
      expect(openBookKeyAction(key('ArrowRight', modifiers))).toBeNull();
    }
  );
});
