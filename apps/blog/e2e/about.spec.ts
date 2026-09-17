import { expect, test } from '@playwright/test';

test.describe('About page (stable elements)', () => {
  test('renders heading and body in Korean', async ({ page }) => {
    await page.goto('/ko/about');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).not.toHaveText('');

    const body = page.locator('article p').first();
    await expect(body).toBeVisible();
    await expect(body).not.toHaveText('');

    const photo = page.getByRole('img', { name: '정원에서 카메라를 들고 앉아 있는 나' });
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });

  test('renders heading and body in English', async ({ page }) => {
    await page.goto('/en/about');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).not.toHaveText('');

    const body = page.locator('article p').first();
    await expect(body).toBeVisible();
    await expect(body).not.toHaveText('');

    const photo = page.getByRole('img', { name: 'Me sitting in a garden, holding a camera' });
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });

  test('renders tech stack and a contact email link', async ({ page }) => {
    await page.goto('/ko/about');

    await expect(page.getByText('TypeScript')).toBeVisible();
    await expect(page.getByText('React Native')).toBeVisible();

    // SocialLinks now renders the email in the footer site-wide too, so scope
    // to the about article to keep this a single, unambiguous match.
    const mailto = page.locator('article a[href="mailto:wannysim@gmail.com"]');
    await expect(mailto).toBeVisible();
  });

  test('links to the now page', async ({ page }) => {
    await page.goto('/ko/about');

    const nowLink = page.locator('a[href="/ko/now"]').first();
    await expect(nowLink).toBeVisible();

    await nowLink.click();
    await page.waitForURL(/\/ko\/now$/);
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`opens and dismisses the photo at ${viewport.width}px without overflowing`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/ko/about');

      const trigger = page.getByRole('button', { name: '이미지 크게 보기 정원에서 카메라를 들고 앉아 있는 나' });
      const thumbnail = trigger.getByRole('img');
      await expect.poll(() => thumbnail.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      const thumbnailBounds = await thumbnail.boundingBox();
      const fullSrc = await thumbnail.getAttribute('data-zoom-src');
      await expect(thumbnail).toHaveAttribute('srcset', /\/_next\/image\?/);
      expect(await thumbnail.evaluate(image => (image as HTMLImageElement).currentSrc)).toContain('/_next/image?');
      const introBounds = await page.getByText(/^긍정과 효율을 지향하며/).boundingBox();
      expect(thumbnailBounds).not.toBeNull();
      expect(introBounds).not.toBeNull();
      if (!thumbnailBounds || !introBounds) throw new Error('About content was not visible');

      if (viewport.width >= 640) {
        expect(Math.abs(introBounds.y - thumbnailBounds.y)).toBeLessThan(2);
        expect(introBounds.x + introBounds.width).toBeLessThan(thumbnailBounds.x);
      } else {
        const contactBounds = await page.locator('article a[href="mailto:wannysim@gmail.com"]').boundingBox();
        if (!contactBounds) throw new Error('Contact link was not visible');
        expect(introBounds.y).toBeGreaterThanOrEqual(thumbnailBounds.y + thumbnailBounds.height);
        expect(introBounds.y - thumbnailBounds.y - thumbnailBounds.height).toBeLessThan(48);
        expect(contactBounds.y + contactBounds.height).toBeLessThan(thumbnailBounds.y);
      }

      await trigger.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: '이미지', exact: true });
      await expect(dialog).toBeVisible();
      const enlarged = dialog.getByRole('img');
      await expect(enlarged).toHaveJSProperty('currentSrc', fullSrc);
      await expect.poll(() => enlarged.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(dialog.locator('figcaption')).toHaveText('정원에서 카메라를 들고 앉아 있는 나');
      const bounds = await enlarged.boundingBox();
      expect(bounds).not.toBeNull();
      if (!bounds) throw new Error('Enlarged image was not visible');
      expect(bounds.width).toBeGreaterThan(thumbnailBounds.width);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      expect(bounds.width / bounds.height).toBeCloseTo(1067 / 1600, 2);

      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();

      await trigger.click();
      await expect(dialog).toBeVisible();
      await page.mouse.click(4, 4);
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    });
  }
});
