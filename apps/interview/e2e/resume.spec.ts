import { expect, test, type Page } from '@playwright/test';

import { codeProblems } from '../lib/curriculum';
import { cloudFixture } from './cloud-fixture';

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('접속 키', { exact: true }).fill('e2e-only-key-never-for-production-12345678');
  await page.getByRole('button', { name: '연습실 들어가기' }).click();
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
}

test('a phone draft opens directly from desktop today with its whiteboard notes', async ({ browser }) => {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const cloud = cloudFixture();
    const phone = await mobile.newPage();
    await cloud.attach(phone);
    await login(phone);
    await expect(phone.getByRole('region', { name: '코드·메모 이어가기' })).toHaveCount(0);
    await phone
      .getByRole('navigation', { name: '모바일 주요 메뉴' })
      .getByRole('button', { name: '문제', exact: true })
      .click();
    await phone.getByRole('button', { name: /장바구니 합계 계산/ }).click();
    const draft = 'function solve(items, coupon) {\n  // 집에서 합계 계산을 이어서 구현\n}';
    const note = '빈 배열, 쿠폰 초과, 수량 0을 먼저 확인한다.';
    await phone.getByLabel('JavaScript 코드').fill(draft);
    await phone.getByLabel('화이트보드 메모').fill(note);
    await expect(phone.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
    expect(cloud.document.progress.drafts.cart).toBe(draft);
    expect(cloud.document.progress.notes['cart:plan']).toBe(note);

    const computer = await desktop.newPage();
    await cloud.attach(computer);
    await login(computer);
    await computer
      .getByRole('region', { name: '코드·메모 이어가기' })
      .getByRole('button', { name: '장바구니 합계 계산', exact: true })
      .click();
    await expect(computer.getByLabel('JavaScript 코드')).toHaveValue(draft);
    await expect(computer.getByLabel('화이트보드 메모')).toHaveValue(note);
    // A reset code still has work to resume until its whiteboard note is cleared.
    computer.once('dialog', dialog => dialog.accept());
    await computer.getByRole('button', { name: '코드 초기화' }).click();
    await computer.getByLabel('화이트보드 메모').fill('');
    await expect(computer.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
    await computer
      .getByRole('navigation', { name: '주요 메뉴', exact: true })
      .getByRole('button', { name: '오늘', exact: true })
      .click();
    await expect(computer.getByRole('region', { name: '코드·메모 이어가기' })).toHaveCount(0);
  } finally {
    await mobile.close();
    await desktop.close();
  }
});

test('resume lists at most three changed drafts, excluding starter and blank code', async ({ page }) => {
  const cloud = cloudFixture();
  const [starter, blank, ...changed] = codeProblems;
  cloud.document.progress.drafts[starter!.id] = starter!.starter;
  cloud.document.progress.drafts[blank!.id] = '  \n';
  for (const problem of changed.slice(0, 4)) cloud.document.progress.drafts[problem.id] = '// 이어 쓸 코드';
  await cloud.attach(page);
  await login(page);
  const resume = page.getByRole('region', { name: '코드·메모 이어가기' });
  await expect(resume.getByRole('listitem')).toHaveCount(3);
  for (const problem of changed.slice(0, 3))
    await expect(resume.getByRole('button', { name: problem.title, exact: true })).toBeVisible();
  for (const problem of [starter!, blank!, changed[3]!])
    await expect(resume.getByRole('button', { name: problem.title, exact: true })).toHaveCount(0);
  await resume.getByRole('button', { name: '전체 코드 문제 보기' }).click();
  await expect(page.getByRole('button', { name: new RegExp(changed[3]!.title) })).toBeVisible();
});

test('a phone whiteboard-only plan can be resumed on desktop without editing starter code', async ({ browser }) => {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const cloud = cloudFixture();
    const phone = await mobile.newPage();
    await cloud.attach(phone);
    await login(phone);
    await phone
      .getByRole('navigation', { name: '모바일 주요 메뉴' })
      .getByRole('button', { name: '문제', exact: true })
      .click();
    await phone.getByRole('button', { name: /장바구니 합계 계산/ }).click();
    const note = '지하철에서는 빈 배열과 쿠폰 초과 조건만 먼저 정리';
    await phone.getByLabel('화이트보드 메모').fill(note);
    await expect(phone.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
    expect(cloud.document.progress.drafts.cart).toBeUndefined();
    expect(cloud.document.progress.notes['cart:plan']).toBe(note);
    const computer = await desktop.newPage();
    await cloud.attach(computer);
    await login(computer);
    await computer
      .getByRole('region', { name: '코드·메모 이어가기' })
      .getByRole('button', { name: '장바구니 합계 계산', exact: true })
      .click();
    await expect(computer.getByLabel('화이트보드 메모')).toHaveValue(note);
    await expect(computer.getByLabel('JavaScript 코드')).toHaveValue(
      codeProblems.find(problem => problem.id === 'cart')!.starter
    );
  } finally {
    await mobile.close();
    await desktop.close();
  }
});
