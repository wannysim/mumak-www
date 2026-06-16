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
  });

  test('renders heading and body in English', async ({ page }) => {
    await page.goto('/en/about');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).not.toHaveText('');

    const body = page.locator('article p').first();
    await expect(body).toBeVisible();
    await expect(body).not.toHaveText('');
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
});
