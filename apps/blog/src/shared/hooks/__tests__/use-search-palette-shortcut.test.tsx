import { renderHook } from '@testing-library/react';

import { useSearchPaletteShortcut } from '../use-search-palette-shortcut';

import '@testing-library/jest-dom';

function dispatchKeydown(init: KeyboardEventInit) {
  document.dispatchEvent(new KeyboardEvent('keydown', { ...init, bubbles: true }));
}

describe('useSearchPaletteShortcut', () => {
  it('toggles state on Cmd+K', () => {
    const setOpen = jest.fn();
    renderHook(() => useSearchPaletteShortcut(setOpen));

    dispatchKeydown({ key: 'k', metaKey: true });

    expect(setOpen).toHaveBeenCalledTimes(1);
    const [updater] = setOpen.mock.calls[0]!;
    expect(typeof updater).toBe('function');
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });

  it('toggles state on Ctrl+K', () => {
    const setOpen = jest.fn();
    renderHook(() => useSearchPaletteShortcut(setOpen));

    dispatchKeydown({ key: 'k', ctrlKey: true });

    expect(setOpen).toHaveBeenCalledTimes(1);
  });

  it('ignores k without modifier', () => {
    const setOpen = jest.fn();
    renderHook(() => useSearchPaletteShortcut(setOpen));

    dispatchKeydown({ key: 'k' });

    expect(setOpen).not.toHaveBeenCalled();
  });

  it('ignores other keys with modifier', () => {
    const setOpen = jest.fn();
    renderHook(() => useSearchPaletteShortcut(setOpen));

    dispatchKeydown({ key: 'j', metaKey: true });
    dispatchKeydown({ key: 'p', ctrlKey: true });

    expect(setOpen).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const setOpen = jest.fn();
    const { unmount } = renderHook(() => useSearchPaletteShortcut(setOpen));

    unmount();
    dispatchKeydown({ key: 'k', metaKey: true });

    expect(setOpen).not.toHaveBeenCalled();
  });
});
