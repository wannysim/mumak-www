/** For this lab's solid surface and text-only buttons, including group opacity. */
export function measureButtonContrast(button: HTMLButtonElement, surface: HTMLElement) {
  const style = getComputedStyle(button);
  const canvas = document.createElement('canvas');
  const group = document.createElement('canvas');
  canvas.width = canvas.height = group.width = group.height = 1;
  const context = canvas.getContext('2d');
  const groupContext = group.getContext('2d');
  if (!context || !groupContext) throw new Error('Canvas unavailable');
  const surfaceColor = getComputedStyle(surface).backgroundColor;

  function sample(withText: boolean) {
    if (!context || !groupContext) throw new Error('Canvas unavailable');
    groupContext.clearRect(0, 0, 1, 1);
    groupContext.fillStyle = style.backgroundColor;
    groupContext.fillRect(0, 0, 1, 1);
    if (withText) {
      groupContext.fillStyle = style.color;
      groupContext.fillRect(0, 0, 1, 1);
    }
    context.globalAlpha = 1;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = surfaceColor;
    context.fillRect(0, 0, 1, 1);
    context.globalAlpha = Number(style.opacity);
    context.drawImage(group, 0, 0);
    return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
  }

  function luminance(channels: number[]) {
    const [r = 0, g = 0, b = 0] = channels.map(channel => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const foreground = sample(true);
  const background = sample(false);
  const a = luminance(foreground);
  const b = luminance(background);
  return {
    ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    foreground: `rgb(${foreground.join(', ')})`,
    background: `rgb(${background.join(', ')})`,
    state: button.matches(':active')
      ? 'pressed'
      : button.matches(':focus-visible')
        ? 'focus'
        : matchMedia('(hover: hover)').matches && button.matches(':hover')
          ? 'hover'
          : 'rest',
  };
}
