import { act, render } from '@testing-library/react';
import { driver, type Driver } from 'driver.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KaraokeGuide } from '../components/karaoke-guide';
import { LOCAL_STORAGE_KEYS } from '../lib/client-storage';

vi.mock('driver.js', () => ({ driver: vi.fn() }));

const driverMock = vi.mocked(driver);

/** driver.js가 동적 import라 rAF 콜백을 직접 잡아 두고 원하는 시점에 재개시킨다. */
let frames: FrameRequestCallback[] = [];

function runPendingFrame() {
  const frame = frames.shift();
  if (!frame) throw new Error('예약된 애니메이션 프레임이 없습니다.');
  return frame(0) as unknown as Promise<void>;
}

/** 이 컴포넌트가 실제로 부르는 세 메서드만 흉내 낸 driver 인스턴스를 물려 준다. */
function mockGuide({ active = false } = {}) {
  const guide = { drive: vi.fn(), isActive: vi.fn(() => active), destroy: vi.fn() };
  driverMock.mockReturnValue(guide as unknown as Driver);
  return guide;
}

function driverOptions() {
  const [options] = driverMock.mock.calls.at(-1) ?? [];
  if (!options) throw new Error('driver가 호출되지 않았습니다.');
  return options;
}

describe('KaraokeGuide', () => {
  beforeEach(() => {
    localStorage.clear();
    frames = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback));
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    driverMock.mockReset();
  });

  it('does not start the tour before the lyrics are ready', () => {
    render(<KaraokeGuide replay={0} ready={false} />);

    expect(frames).toHaveLength(0);
    expect(driverMock).not.toHaveBeenCalled();
  });

  it('drives the tour on the first visit and remembers it was shown', async () => {
    const guide = mockGuide();
    render(<KaraokeGuide replay={0} ready />);

    await act(async () => {
      await runPendingFrame();
    });

    expect(guide.drive).toHaveBeenCalledOnce();
    const options = driverOptions();
    expect(options.steps).toHaveLength(1);
    expect(options.steps?.[0]?.element).toBe('[data-tour="lyrics-editor-trigger"]');

    const closeButton = document.createElement('button');
    options.onPopoverRender?.({ closeButton } as never, {} as never);
    expect(localStorage.getItem(LOCAL_STORAGE_KEYS.firstGuide)).toBe('true');
    expect(closeButton).toHaveAttribute('aria-label', '가이드 닫기');
  });

  it('keeps an active tour open when another tab marks the guide as seen', async () => {
    const guide = mockGuide({ active: true });
    render(<KaraokeGuide replay={0} ready />);

    await act(async () => {
      await runPendingFrame();
    });
    expect(guide.drive).toHaveBeenCalledOnce();

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: LOCAL_STORAGE_KEYS.firstGuide,
          newValue: 'true',
          storageArea: localStorage,
        })
      );
    });

    expect(guide.destroy).not.toHaveBeenCalled();
  });

  it('adds the file-import step only when that control is on screen', async () => {
    mockGuide();
    render(
      <>
        <button type="button" data-tour="lyrics-file-import" />
        <KaraokeGuide replay={0} ready />
      </>
    );

    await act(async () => {
      await runPendingFrame();
    });

    expect(driverOptions().steps).toHaveLength(2);
  });

  it('stays quiet for a returning visitor until the tour is replayed', async () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.firstGuide, 'true');
    mockGuide();
    const { rerender } = render(<KaraokeGuide replay={0} ready />);

    expect(frames).toHaveLength(0);
    expect(driverMock).not.toHaveBeenCalled();

    rerender(<KaraokeGuide replay={1} ready />);
    await act(async () => {
      await runPendingFrame();
    });

    expect(driverMock).toHaveBeenCalledOnce();
  });

  it('skips the tour when the component unmounts while driver.js is still loading', async () => {
    mockGuide();
    const { unmount } = render(<KaraokeGuide replay={0} ready />);

    const running = runPendingFrame();
    unmount();
    await act(async () => {
      await running;
    });

    expect(driverMock).not.toHaveBeenCalled();
  });

  it('does not open a second tour while one is still on screen', async () => {
    mockGuide({ active: true });
    const { rerender } = render(<KaraokeGuide replay={0} ready />);

    await act(async () => {
      await runPendingFrame();
    });
    rerender(<KaraokeGuide replay={1} ready />);
    await act(async () => {
      await runPendingFrame();
    });

    expect(driverMock).toHaveBeenCalledOnce();
  });

  it('reopens the tour once the previous one reported itself destroyed', async () => {
    mockGuide({ active: true });
    const { rerender } = render(<KaraokeGuide replay={0} ready />);

    await act(async () => {
      await runPendingFrame();
    });
    driverOptions().onDestroyed?.(undefined, {} as never, {} as never);
    rerender(<KaraokeGuide replay={1} ready />);
    await act(async () => {
      await runPendingFrame();
    });

    expect(driverMock).toHaveBeenCalledTimes(2);
  });

  it('destroys a tour that is still open when the component unmounts', async () => {
    const guide = mockGuide({ active: true });
    const { unmount } = render(<KaraokeGuide replay={0} ready />);

    await act(async () => {
      await runPendingFrame();
    });
    unmount();

    expect(guide.destroy).toHaveBeenCalledOnce();
  });
});
