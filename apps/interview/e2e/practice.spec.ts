import { expect, test, type Page } from '@playwright/test';

import { codeProblems } from '../lib/curriculum';
import { cloudFixture } from './cloud-fixture';

const key = 'e2e-only-key-never-for-production-12345678';
async function login(page: Page) {
  await cloudFixture().attach(page);
  await page.goto('/');
  await page.getByLabel('접속 키', { exact: true }).fill(key);
  await page.getByRole('button', { name: '연습실 들어가기' }).click();
  await expect(page.getByRole('heading', { name: '이동 중에도, 한 문제만 더.' })).toBeVisible();
  await expect(page.getByRole('button', { name: '5분 연습 출발' })).toBeEnabled();
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
}
async function tab(page: Page, title: string) {
  await page
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('button', { name: title, exact: true })
    .click();
}

test('gate rejects wrong keys and disallows cross-origin session creation', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '다시, 나의 페이스로' })).toBeVisible();
  await expect(
    page.getByText('같은 접속 키로 로그인하면 서버에 저장된 기록을 이어갈 수 있어요.', { exact: false })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '5분 연습 출발' })).toHaveCount(0);
  await page.getByLabel('접속 키', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: '연습실 들어가기' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '접속 키를 다시 확인' })).toBeVisible();
  const response = await request.post('/api/session', {
    headers: { Origin: 'https://other.example.com', Authorization: `Bearer ${key}` },
  });
  expect(response.status()).toBe(403);
  const html = await request.get('/');
  expect(html.headers()['x-robots-tag']).toContain('noindex');
});

test('quiz, review, timer and notes survive reload; layout fits the viewport', async ({ page }) => {
  await login(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '5분 연습 출발' }).click();
  await page.getByRole('radio', { name: 'A → B → C → D', exact: true }).check();
  await page.getByRole('button', { name: '답 확인하기' }).click();
  await expect(page.getByRole('status')).toContainText('다시 만나봐요');
  await page.getByRole('button', { name: '타이머 일시정지' }).click();
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
  await page.reload();
  await page.getByRole('button', { name: '하던 연습 이어가기' }).click();
  await expect(page.getByRole('button', { name: '타이머 계속' })).toBeVisible();
  await tab(page, '문제');
  await page.getByRole('button', { name: '다시 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: /콘솔에는 어떤 순서로/ })).toBeVisible();
  await tab(page, '내 이야기');
  await page.getByRole('button', { name: /내가 끝까지 책임진 문제/ }).click();
  await page.getByLabel('01문제와 맥락').fill('사용자가 입력한 값이 저장 과정에서 사라졌다.');
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
  await page.reload();
  await tab(page, '내 이야기');
  await page.getByRole('button', { name: /내가 끝까지 책임진 문제/ }).click();
  await expect(page.getByLabel('01문제와 맥락')).toHaveValue('사용자가 입력한 값이 저장 과정에서 사라졌다.');
});

test('real code execution, timeout, network isolation and subsequent recovery', async ({ page }) => {
  await login(page);
  await tab(page, '문제');
  await page.getByRole('button', { name: /장바구니 합계 계산/ }).click();
  const editor = page.getByRole('textbox', { name: 'JavaScript 코드' });
  await page.getByRole('button', { name: '코드 실행하기' }).click();
  await expect(page.getByText('실패 · 여러 품목과 쿠폰')).toBeVisible();
  await editor.fill(codeProblems[0]!.solution);
  await page.getByRole('button', { name: '코드 실행하기' }).click();
  await expect(page.getByText('통과 · 여러 품목과 쿠폰')).toBeVisible();
  await editor.fill('function solve() { while (true) {} }');
  await page.getByRole('button', { name: '코드 실행하기' }).click();
  await expect(page.getByText(/2초 실행 제한에 도달/)).toBeVisible();
  const requests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/session')) requests.push(request.url());
  });
  await editor.fill('async function solve() { await fetch("http://localhost:3008/api/session"); }');
  await page.getByRole('button', { name: '코드 실행하기' }).click();
  await expect(page.getByText(/Failed to fetch|Load failed|NetworkError|Invalid URL|URL is invalid/i)).toBeVisible();
  expect(requests).toEqual([]);
  await editor.fill(codeProblems[0]!.solution);
  await page.getByRole('button', { name: '코드 실행하기' }).click();
  await expect(page.getByText('통과 · 합계보다 큰 쿠폰')).toBeVisible();
  expect(await page.locator('iframe').count()).toBe(0);
});

test('exports and restores an actual note backup', async ({ page }) => {
  await login(page);
  await tab(page, '내 이야기');
  await page.getByRole('button', { name: /내가 끝까지 책임진 문제/ }).click();
  await page.getByLabel('01문제와 맥락').fill('백업으로 다시 만날 내 이야기');
  await tab(page, '기록');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 내려받기' }).click();
  const backup = await downloaded;
  const path = await backup.path();
  expect(path).toBeTruthy();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '전체 기록 초기화' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('기록 백업 파일').setInputFiles(path!);
  await expect(page.getByRole('status')).toContainText('백업을 불러왔어요');
  await tab(page, '내 이야기');
  await page.getByRole('button', { name: /내가 끝까지 책임진 문제/ }).click();
  await expect(page.getByLabel('01문제와 맥락')).toHaveValue('백업으로 다시 만날 내 이야기');
});

test('storage quota failure is visible and unsaved edits remain exportable', async ({ page }) => {
  await login(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
  });
  await tab(page, '내 이야기');
  await page.getByRole('button', { name: /내가 끝까지 책임진 문제/ }).click();
  await page.getByLabel('01문제와 맥락').fill('저장 실패에도 유지할 초안');
  await expect(page.getByRole('alert').filter({ hasText: '기기에 저장하지 못했어요' })).toBeVisible();
  await expect(page.getByLabel('01문제와 맥락')).toHaveValue('저장 실패에도 유지할 초안');
  await tab(page, '기록');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 내려받기' }).click();
  const backup = await downloaded;
  const stream = await backup.createReadStream();
  let content = '';
  for await (const chunk of stream) content += chunk.toString();
  expect(JSON.parse(content).notes['ownership:0']).toBe('저장 실패에도 유지할 초안');
});

test('queue runner enforces concurrency, and every reference solution passes', async ({ page }) => {
  await login(page);
  for (const problem of codeProblems.filter(p => ['events', 'queue'].includes(p.id))) {
    await tab(page, '문제');
    await page.getByRole('button', { name: new RegExp(problem.title) }).click();
    if (problem.id === 'queue') {
      await page
        .getByRole('textbox', { name: 'JavaScript 코드' })
        .fill('async function solve(tasks) { return tasks.map((_, i) => i); }');
      await page.getByRole('button', { name: '코드 실행하기' }).click();
      await expect(page.getByText('실패 · 최대 2개 실행 · 입력 순서 유지')).toBeVisible();
      await page.getByRole('textbox', { name: 'JavaScript 코드' }).fill(problem.starter);
      await page.getByRole('button', { name: '코드 실행하기' }).click();
      await expect(page.getByText('실패 · 최대 2개 실행 · 입력 순서 유지')).toBeVisible();
      await page
        .getByRole('textbox', { name: 'JavaScript 코드' })
        .fill(problem.solution.replace('new Array(tasks.length)', 'new Array(tasks.length + 1)'));
      await page.getByRole('button', { name: '코드 실행하기' }).click();
      await expect(page.getByText('실패 · 빈 작업 목록')).toBeVisible();
    }
    await page.getByRole('textbox', { name: 'JavaScript 코드' }).fill(problem.solution);
    await page.getByRole('button', { name: '코드 실행하기' }).click();
    for (const item of problem.tests)
      await expect(page.getByText(`통과 · ${item.label}`, { exact: true })).toBeVisible();
  }
});

test('corrupt data stays protected; malformed imports do not overwrite records', async ({ page }) => {
  await login(page);
  await page.evaluate(() => localStorage.setItem('next-stop:cloud:v1', 'broken'));
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
  await page.reload();
  await expect(page.getByRole('heading', { name: '어떤 기록으로 이어갈까요?' })).toBeVisible();
  await page.getByRole('button', { name: '기록 복원·초기화 열기' }).click();
  await page
    .getByLabel('기록 백업 파일')
    .setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('{}') });
  await expect(page.getByRole('status')).toContainText('기존 기록은 유지');
  expect(await page.evaluate(() => localStorage.getItem('next-stop:cloud:v1'))).toBe('broken');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '서버 기록 사용' }).click();
  await expect(page.getByRole('heading', { name: '어떤 기록으로 이어갈까요?' })).toHaveCount(0);
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
  await page.getByRole('button', { name: '로그아웃', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: '다시, 나의 페이스로' })).toBeVisible();
});
