/* oxlint-disable next/no-img-element -- Native image fixtures exercise picture selection and loading. */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import en from '@/messages/en.json';
import ko from '@/messages/ko.json';

import { ImageZoom } from '../image-zoom';

let mockLocale: 'ko' | 'en' = 'ko';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: keyof typeof ko.imageViewer) => (mockLocale === 'ko' ? ko : en).imageViewer[key],
}));

function renderImage(locale: 'ko' | 'en' = 'ko') {
  mockLocale = locale;
  return render(
    <ImageZoom>
      <picture>
        <source type="image/webp" srcSet="https://example.com/photo.webp" />
        <img src="https://example.com/photo.jpg" alt="A garden" width="1067" height="1600" />
      </picture>
    </ImageZoom>
  );
}

describe('ImageZoom', () => {
  it('opens the browser-selected picture source and restores focus after Escape', async () => {
    const user = userEvent.setup();
    renderImage();
    const thumbnail = screen.getByRole('img', { name: 'A garden' });
    Object.defineProperty(thumbnail, 'currentSrc', { value: 'https://example.com/photo.webp' });

    const trigger = screen.getByRole('button', { name: '이미지 크게 보기 A garden' });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: '이미지' });
    expect(within(dialog).getByRole('img', { name: 'A garden' })).toHaveAttribute(
      'src',
      'https://example.com/photo.webp'
    );
    expect(dialog.querySelector('figcaption')).toHaveTextContent('A garden');
    expect(dialog).toHaveAccessibleDescription('A garden');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('opens the full rendition rather than the optimized Next.js thumbnail', async () => {
    const user = userEvent.setup();
    renderImage();
    const thumbnail = screen.getByRole('img');
    thumbnail.setAttribute('data-zoom-src', 'https://example.com/full.webp');
    Object.defineProperty(thumbnail, 'currentSrc', { value: 'http://localhost/_next/image?url=photo.jpg&w=384&q=75' });

    await user.click(screen.getByRole('button', { name: '이미지 크게 보기 A garden' }));

    const enlarged = within(screen.getByRole('dialog')).getByRole('img');
    expect(enlarged).toHaveAttribute('src', 'https://example.com/full.webp');
    expect(enlarged).toHaveAttribute('width', '1067');
    expect(enlarged).toHaveAttribute('height', '1600');
  });

  it.each(['{Enter}', ' '])('opens with the keyboard (%s) and closes with the translated button', async key => {
    const user = userEvent.setup();
    renderImage('en');

    screen.getByRole('button', { name: 'Enlarge image A garden' }).focus();
    await user.keyboard(key);

    const dialog = screen.getByRole('dialog', { name: 'Image' });
    expect(within(dialog).getByRole('img', { name: 'A garden' })).toHaveAttribute(
      'src',
      'https://example.com/photo.jpg'
    );
    await user.click(within(dialog).getByRole('button', { name: 'Close image' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not give an image zero dimensions when opened before it finishes loading', async () => {
    const user = userEvent.setup();
    mockLocale = 'en';
    render(
      <ImageZoom>
        <img src="https://example.com/loading.jpg" alt="Loading garden" />
      </ImageZoom>
    );

    await user.click(screen.getByRole('button', { name: 'Enlarge image Loading garden' }));

    const image = within(screen.getByRole('dialog')).getByRole('img');
    expect(image).not.toHaveAttribute('width');
    expect(image).not.toHaveAttribute('height');
  });
});
