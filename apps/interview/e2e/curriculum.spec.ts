import { expect, test, type Page } from '@playwright/test';

import { codeProblems } from '../lib/curriculum';
import { cloudFixture } from './cloud-fixture';

async function library(page: Page) {
  await page
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('button', { name: '문제', exact: true })
    .click();
}
async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('접속 키', { exact: true }).fill('e2e-only-key-never-for-production-12345678');
  await page.getByRole('button', { name: '연습실 들어가기' }).click();
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
  await library(page);
}
for (const problem of codeProblems.filter(p => !['cart', 'events', 'queue'].includes(p.id))) {
  test(`${problem.id}: runs the reference solution inside the real browser sandbox`, async ({ page }) => {
    await cloudFixture().attach(page);
    await login(page);
    await page.getByRole('button', { name: new RegExp(problem.title) }).click();
    await page.getByLabel('JavaScript 코드').fill(problem.solution);
    await page.getByRole('button', { name: '코드 실행하기' }).click();
    for (const item of problem.tests)
      await expect(page.getByText(`통과 · ${item.label}`, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
test('filters, learning paths and whiteboard notes survive another device and backup', async ({ page, browser }) => {
  const cloud = cloudFixture();
  await cloud.attach(page);
  await login(page);
  await page.getByLabel('코드 분야').selectOption('링크드 리스트');
  await page.getByLabel('코드 난이도').selectOption('심화');
  await expect(page.getByRole('status').filter({ hasText: '2개 표시' })).toBeVisible();
  await expect(page.getByRole('button', { name: /LRU 캐시 설계/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /노드 참조를 유지/ })).toHaveCount(0);
  // Switching a broad topic resets the code-only facets.
  await page.getByRole('button', { name: 'React', exact: true }).click();
  await expect(page.getByRole('button', { name: /세 번 눌렀는데/ })).toBeVisible();
  await page.getByText('추천 순서 · 윈도우와 연결 리스트 집중 훈련', { exact: true }).click();
  await page.getByRole('button', { name: '링크드 리스트 4단계 열기' }).click();
  await expect(page.getByRole('heading', { name: '이중 연결 덱 구현', exact: true })).toBeVisible();
  await page.getByLabel('화이트보드 메모').fill('head ⇄ A ⇄ B ⇄ tail\n빈 덱에서 pop하면 null');
  await page.getByLabel('JavaScript 코드').fill('function solve(operations) { /* next와 prev를 함께 갱신 */ }');
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
  const secondContext = await browser.newContext();
  try {
    const second = await secondContext.newPage();
    await cloud.attach(second);
    await login(second);
    await second.getByRole('button', { name: /이중 연결 덱 구현/ }).click();
    await expect(second.getByLabel('화이트보드 메모')).toHaveValue('head ⇄ A ⇄ B ⇄ tail\n빈 덱에서 pop하면 null');
    await expect(second.getByLabel('JavaScript 코드')).toHaveValue(
      'function solve(operations) { /* next와 prev를 함께 갱신 */ }'
    );
  } finally {
    await secondContext.close();
  }
  await page
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('button', { name: '기록', exact: true })
    .click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 내려받기' }).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  let content = '';
  for await (const chunk of stream) content += chunk.toString();
  expect(JSON.parse(content).notes['list-deque:plan']).toContain('head ⇄ A');
});

test('aggregate size guard keeps the last valid record and exports an importable backup', async ({ page }) => {
  const cloud = cloudFixture();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  // Fill allowed records close to the shared 2MB boundary without exceeding per-field limits.
  const data = cloud.document.progress;
  for (const p of codeProblems) data.drafts[p.id] = '가'.repeat(20000);
  const storyIds = ['ownership', 'consistency', 'race-story', 'tradeoff', 'measurement', 'disagreement'];
  for (const id of storyIds)
    for (let i = 0; i < 5; i++) {
      const bytes = Buffer.byteLength(JSON.stringify(data));
      const characters = Math.min(10000, Math.max(0, Math.floor((1999000 - bytes - 100) / 3)));
      if (characters > 0) data.notes[`${id}:${i}`] = '나'.repeat(characters);
    }
  await cloud.attach(page);
  await login(page);
  await page.getByRole('button', { name: /노드 참조를 유지하며/ }).click();
  await page.getByLabel('화이트보드 메모').fill('다'.repeat(6000));
  await expect(
    page.getByRole('alert').filter({ hasText: '이번 변경은 저장하지 않았고 기존 기록은 유지' })
  ).toBeVisible();
  await expect(page.getByLabel('화이트보드 메모')).toHaveValue('');
  expect(data.notes['list-reverse:plan']).toBeUndefined();
  expect(errors).toEqual([]);
  await page
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('button', { name: '기록', exact: true })
    .click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 내려받기' }).click();
  const backup = await downloaded;
  const path = await backup.path();
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('기록 백업 파일').setInputFiles(path!);
  await expect(page.getByRole('status')).toContainText('백업을 불러왔어요');
});

test('code review bookmarks survive devices and code facets stay within the review queue', async ({
  page,
  browser,
}) => {
  const cloud = cloudFixture();
  await cloud.attach(page);
  await login(page);
  const problem = codeProblems.find(item => item.id === 'window-fixed')!;
  await page.getByRole('button', { name: new RegExp(problem.title) }).click();
  await page.getByRole('button', { name: '다시 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장됨', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
  expect(cloud.document.progress.attempts).toEqual([]);

  const secondContext = await browser.newContext();
  try {
    const second = await secondContext.newPage();
    await cloud.attach(second);
    await login(second);
    await second.getByRole('button', { name: '다시 보기', exact: true }).click();
    await second.getByLabel('코드 분야').selectOption(problem.category);
    await expect(second.getByRole('button', { name: '다시 보기', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(second.getByRole('status').filter({ hasText: '1개 표시' })).toBeVisible();
    await expect(second.getByRole('button', { name: new RegExp(problem.title) })).toBeVisible();

    await second.getByRole('button', { name: '다시 보기', exact: true }).click();
    await second.getByLabel('코드 난이도').selectOption(problem.difficulty);
    await expect(second.getByRole('button', { name: '다시 보기', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(second.getByRole('status').filter({ hasText: '1개 표시' })).toBeVisible();
    await second.getByRole('button', { name: new RegExp(problem.title) }).click();
    await second.getByRole('button', { name: '저장됨', exact: true }).click();
    await expect(second.getByRole('button', { name: '다시 보기', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await expect(second.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
    await library(second);
    await second.getByRole('button', { name: '다시 보기', exact: true }).click();
    await expect(second.getByRole('heading', { name: '아직 다시 볼 문제가 없어요' })).toBeVisible();
  } finally {
    await secondContext.close();
  }
  await page.getByRole('button', { name: '지금 동기화', exact: true }).click();
  await expect(page.getByRole('button', { name: '다시 보기', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('foundations and bridge windows form an ordered learning path', async ({ page }) => {
  await cloudFixture().attach(page);
  await login(page);
  await page.getByText('추천 순서 · 윈도우와 연결 리스트 집중 훈련', { exact: true }).click();
  await expect(page.getByText(/기초가 낯설다면 장바구니의 합계 누적/)).toBeVisible();
  await expect(page.getByRole('button', { name: '기초 준비 1단계 열기' })).toHaveText(/장바구니 합계 계산/);
  await expect(page.getByRole('button', { name: '기초 준비 2단계 열기' })).toHaveText(/중복 이벤트 정리/);
  const titles = [
    '연속 k일 최대 매출',
    '목표 합을 채우는 가장 짧은 구간',
    '중복 없는 가장 긴 구간',
    '최대 K종 문자를 담는 구간',
    '필요한 문자를 덮는 최소 구간',
  ];
  for (const [index, title] of titles.entries())
    await expect(page.getByRole('button', { name: `슬라이딩 윈도우 ${index + 1}단계 열기` })).toHaveText(
      `${index + 1}. ${title}`
    );
  await page.getByRole('button', { name: '슬라이딩 윈도우 2단계 열기' }).click();
  await expect(page.getByRole('heading', { name: titles[1], exact: true })).toBeVisible();
  await page.getByText('막혔다면 예시 그림 보기', { exact: true }).click();
  await expect(page.getByText(/values=\[1,2,3,4\], target=6/)).toBeVisible();
});
