import { expect, test } from '@playwright/test';

test.describe('Garden Advanced Wikilinks', () => {
  const cases = [
    {
      locale: 'ko',
      heading: '고급 위키링크 테스트',
      noteHeadingLink: '디지털 가든 소개 섹션',
      internalHeadingLink: '같은 노트의 섹션으로 이동',
      noteBlockLink: 'PKM 습관 블록',
      internalBlockLink: '같은 노트의 블록으로 이동',
    },
    {
      locale: 'en',
      heading: 'Advanced Wikilink Playground',
      noteHeadingLink: 'Digital garden intro section',
      internalHeadingLink: 'Go to same-note section',
      noteBlockLink: 'PKM habit block',
      internalBlockLink: 'Go to same-note block',
    },
  ] as const;

  for (const scenario of cases) {
    test(`should render and navigate advanced wikilinks and embeds (${scenario.locale})`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(`/${scenario.locale}/garden/advanced-wikilink-playground`);
      await expect(page.getByRole('heading', { level: 1, name: scenario.heading })).toBeVisible();

      const noteHeadingLink = page.getByRole('link', { name: scenario.noteHeadingLink });
      await expect(noteHeadingLink).toBeVisible();
      await noteHeadingLink.click();
      await expect(page).toHaveURL(new RegExp(`/${scenario.locale}/garden/what-is-digital-garden#`));

      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/${scenario.locale}/garden/advanced-wikilink-playground`));

      const internalHeadingLink = page.getByRole('link', { name: scenario.internalHeadingLink });
      await internalHeadingLink.click();
      await expect(page).toHaveURL(new RegExp(`/${scenario.locale}/garden/advanced-wikilink-playground#`));

      const noteBlockLink = page.getByRole('link', { name: scenario.noteBlockLink });
      await expect(noteBlockLink).toBeVisible();
      await noteBlockLink.click();
      await expect(page).toHaveURL(new RegExp(`/${scenario.locale}/garden/pkm#\\^pkm-habit-loop`));

      await page.goto(`/${scenario.locale}/garden/advanced-wikilink-playground`);

      const internalBlockLink = page.getByRole('link', { name: scenario.internalBlockLink });
      await expect(internalBlockLink).toBeVisible();
      await internalBlockLink.click();
      await expect(page).toHaveURL(new RegExp(`/${scenario.locale}/garden/advanced-wikilink-playground#\\^self-block`));

      const embeds = page.locator('[data-wiki-embed]');
      await expect(embeds).toHaveCount(3);

      await expect(page.locator('[data-wikilink-broken]')).toHaveCount(0);
      await expect(page.locator('[data-wiki-embed-broken]')).toHaveCount(0);

      expect(consoleErrors).toEqual([]);
    });
  }
});
