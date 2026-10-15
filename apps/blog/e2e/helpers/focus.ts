import { expect, type Locator } from '@playwright/test';

/** Measure the rendered outline against the surface around its offset. */
export async function expectFocusIndicator(target: Locator) {
  await expect(target).toBeFocused();
  await expect(target).toBeVisible();
  expect(await target.evaluate(element => element.matches(':focus-visible'))).toBe(true);

  const indicator = await target.evaluate(async element => {
    const surface = element.getAttribute('data-slot') === 'content-card-link' ? element.closest('article') : element;
    if (!surface) throw new Error('Missing focus surface');
    getComputedStyle(surface).getPropertyValue('outline-color');
    await Promise.all(surface.getAnimations().map(animation => animation.finished));
    const style = getComputedStyle(surface);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');

    function pixels(color: string) {
      if (!context) throw new Error('Canvas unavailable');
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    }

    function luminance(channels: number[]) {
      const [r = 0, g = 0, b = 0] = channels.slice(0, 3).map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    let background = surface.parentElement;
    while (background && pixels(getComputedStyle(background).backgroundColor)[3] === 0)
      background = background.parentElement;
    if (!background) throw new Error('Missing opaque background');
    const foregroundPixels = pixels(style.outlineColor);
    const a = luminance(foregroundPixels);
    const b = luminance(pixels(getComputedStyle(background).backgroundColor));
    return {
      color: style.outlineColor,
      width: style.outlineWidth,
      offset: style.outlineOffset,
      style: style.outlineStyle,
      alpha: foregroundPixels[3],
      contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    };
  });

  expect(indicator).toMatchObject({ width: '2px', offset: '2px', style: 'solid', alpha: 255 });
  expect(indicator.contrast).toBeGreaterThanOrEqual(3);
  return indicator;
}
