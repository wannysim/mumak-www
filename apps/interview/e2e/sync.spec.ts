import { expect, test, type Page } from '@playwright/test';

import { cloudFixture } from './cloud-fixture';

async function openNotes(page: Page) {
  await page.goto('/');
  await page.getByLabel('접속 키', { exact: true }).fill('e2e-only-key-never-for-production-12345678');
  await page.getByRole('button', { name: '연습실 들어가기' }).click();
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
  await page
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('button', { name: '내 이야기', exact: true })
    .click();
  await page.getByRole('button', { name: /내가 끝까지 책임진 문제/ }).click();
}
test('two devices share notes; stale edits never replace the newer remote record', async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const first = await a.newPage();
    const second = await b.newPage();
    const cloud = cloudFixture();
    await cloud.attach(first);
    await cloud.attach(second);
    await openNotes(first);
    await openNotes(second);
    await first.getByLabel('01문제와 맥락').fill('컴퓨터에서 작성한 메모');
    await expect(first.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
    await second.getByRole('button', { name: '지금 동기화' }).click();
    await expect(second.getByLabel('01문제와 맥락')).toHaveValue('컴퓨터에서 작성한 메모');
    await first.getByLabel('01문제와 맥락').fill('컴퓨터에서 바꾼 최신 메모');
    await expect(first.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
    await second.getByLabel('01문제와 맥락').fill('휴대폰에서 동시에 쓴 초안');
    await expect(second.getByRole('heading', { name: '어떤 기록으로 이어갈까요?' })).toBeVisible();
    expect(cloud.document.progress.notes['ownership:0']).toBe('컴퓨터에서 바꾼 최신 메모');
    // Reload must keep both the unsent local draft and the conflict.
    second.on('dialog', dialog => dialog.accept());
    await second.reload();
    await expect(second.getByRole('heading', { name: '어떤 기록으로 이어갈까요?' })).toBeVisible();
    await second.getByRole('button', { name: '이 기기 기록으로 교체' }).click();
    await expect(second.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
    expect(cloud.document.progress.notes['ownership:0']).toBe('휴대폰에서 동시에 쓴 초안');
  } finally {
    await a.close();
    await b.close();
  }
});
test('offline draft survives reload and retries an acknowledged-lost write without duplication', async ({ page }) => {
  const cloud = cloudFixture();
  await cloud.attach(page);
  await openNotes(page);
  cloud.offline = true;
  await page.getByLabel('01문제와 맥락').fill('지하철에서 쓴 초안');
  await expect(page.getByLabel('동기화 상태')).toHaveText('연결 대기 · 기기 초안 보관');
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.getByLabel('동기화 상태')).toHaveText('연결 대기 · 기기 초안 보관');
  await page
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('button', { name: '내 이야기', exact: true })
    .click();
  await page.getByRole('button', { name: /내가 끝까지 책임진 문제/ }).click();
  await expect(page.getByLabel('01문제와 맥락')).toHaveValue('지하철에서 쓴 초안');
  await page.getByLabel('01문제와 맥락').fill('지하철에서 이어 쓴 초안');
  await expect(page.getByLabel('동기화 상태')).toHaveText('연결 대기 · 기기 초안 보관');
  cloud.offline = false;
  cloud.loseNextAcknowledgement();
  await page.getByRole('button', { name: '지금 동기화' }).click();
  await expect.poll(() => cloud.document.progress.notes['ownership:0']).toBe('지하철에서 쓴 초안');
  await expect(page.getByLabel('동기화 상태')).toHaveText('연결 대기 · 기기 초안 보관');
  await page.getByRole('button', { name: '지금 동기화' }).click();
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
  expect(cloud.document.progress.notes['ownership:0']).toBe('지하철에서 이어 쓴 초안');
});

test('duplicated tabs keep independent offline drafts after reload', async ({ page, context }) => {
  const cloud = cloudFixture();
  await cloud.attach(page);
  await openNotes(page);
  const originalTab = await page.evaluate(() => sessionStorage.getItem('next-stop:tab:v1'));
  const duplicate = await context.newPage();
  await cloud.attach(duplicate);
  // Same-origin child tabs can inherit the opener's sessionStorage.
  await duplicate.goto('/');
  await duplicate.evaluate(id => sessionStorage.setItem('next-stop:tab:v1', id!), originalTab);
  await duplicate.reload();
  await expect(duplicate.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
  await duplicate
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('button', { name: '내 이야기', exact: true })
    .click();
  await duplicate.getByRole('button', { name: /내가 끝까지 책임진 문제/ }).click();
  cloud.offline = true;
  await page.getByLabel('01문제와 맥락').fill('원래 탭에서만 쓴 초안');
  await duplicate.getByLabel('01문제와 맥락').fill('복제 탭의 다른 초안');
  await expect(page.getByLabel('동기화 상태')).toHaveText('연결 대기 · 기기 초안 보관');
  await expect(duplicate.getByLabel('동기화 상태')).toHaveText('연결 대기 · 기기 초안 보관');
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await page
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('button', { name: '내 이야기', exact: true })
    .click();
  await page.getByRole('button', { name: /내가 끝까지 책임진 문제/ }).click();
  await expect(page.getByLabel('01문제와 맥락')).toHaveValue('원래 탭에서만 쓴 초안');
  await duplicate.close({ runBeforeUnload: false });
});

test('unsupported storage locking cannot be bypassed by manual sync or reset', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  let calls = 0;
  await page.route('**/api/progress', route => {
    calls++;
    return route.fulfill({ status: 503 });
  });
  await page.goto('/');
  await page.getByLabel('접속 키', { exact: true }).fill('e2e-only-key-never-for-production-12345678');
  await page.getByRole('button', { name: '연습실 들어가기' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '안전한 기록 저장을 지원하지' })).toBeVisible();
  await page.getByRole('button', { name: '지금 동기화' }).click();
  await page.getByRole('button', { name: '기록 복원·초기화 열기' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '전체 기록 초기화' }).click();
  await expect(page.getByRole('status')).toContainText('먼저 서버 연결');
  expect(await page.evaluate(() => localStorage.getItem(''))).toBeNull();
  expect(calls).toBe(0);
});

test('a damaged orphan outbox does not prevent recovering another tab draft', async ({ page }) => {
  const cloud = cloudFixture();
  await cloud.attach(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('audit-orphans-seeded')) return;
    sessionStorage.setItem('audit-orphans-seeded', 'true');
    localStorage.setItem('next-stop:outbox:v1:damaged', '{');
    localStorage.setItem(
      'next-stop:outbox:v1:recoverable',
      JSON.stringify({
        revision: null,
        progress: {
          version: 1,
          attempts: [],
          review: [],
          drafts: {},
          notes: { 'ownership:0': '닫힌 탭에서 복구할 초안' },
          session: null,
        },
        pending: null,
        updatedAt: Date.now(),
      })
    );
  });
  await openNotes(page);
  await expect(page.getByLabel('01문제와 맥락')).toHaveValue('닫힌 탭에서 복구할 초안');
  expect(cloud.document.progress.notes['ownership:0']).toBe('닫힌 탭에서 복구할 초안');
  expect(await page.evaluate(() => localStorage.getItem('next-stop:outbox:v1:damaged'))).toBe('{');
});

test('storage read failure leaves the protected records screen accessible', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    };
  });
  let calls = 0;
  await page.route('**/api/progress', route => {
    calls++;
    return route.fulfill({ status: 503 });
  });
  await page.goto('/');
  await page.getByLabel('접속 키', { exact: true }).fill('e2e-only-key-never-for-production-12345678');
  await page.getByRole('button', { name: '연습실 들어가기' }).click();
  await expect(page.getByRole('button', { name: '기록 복원·초기화 열기' })).toBeVisible();
  await page.getByRole('button', { name: '기록 복원·초기화 열기' }).click();
  await expect(page.getByRole('button', { name: '백업 가져오기' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '전체 기록 초기화' }).click();
  await expect(page.getByRole('status')).toContainText('먼저 서버 연결');
  expect(calls).toBe(0);
});

test('a damaged selected outbox remains recoverable while the server is offline', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('next-stop:tab:v1', 'damaged-offline');
    localStorage.setItem('next-stop:outbox:v1:damaged-offline', '{');
  });
  let writes = 0;
  await page.route('**/api/progress', route => {
    if (route.request().method() === 'PUT') writes++;
    return route.fulfill({ status: 503 });
  });
  await page.goto('/');
  await page.getByLabel('접속 키', { exact: true }).fill('e2e-only-key-never-for-production-12345678');
  await page.getByRole('button', { name: '연습실 들어가기' }).click();
  await expect(page.getByLabel('동기화 상태')).toHaveText('연결 대기 · 기기 초안 보관');
  await page.getByRole('button', { name: '기록 복원·초기화 열기' }).click();
  await expect(page.getByRole('button', { name: '백업 가져오기' })).toBeVisible();
  await page.getByRole('button', { name: '지금 동기화' }).click();
  await expect(page.getByRole('button', { name: '백업 가져오기' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '전체 기록 초기화' }).click();
  await expect(page.getByRole('status')).toContainText('먼저 서버 연결');
  expect(await page.evaluate(() => localStorage.getItem('next-stop:outbox:v1:damaged-offline'))).toBe('{');
  expect(writes).toBe(0);
});

test('a new tab skips an unreadable orphan outbox and leaves its raw value untouched', async ({ page }) => {
  const cloud = cloudFixture();
  cloud.document.progress.notes['ownership:0'] = '서버에 저장된 메모';
  await cloud.attach(page);
  await page.addInitScript(() => localStorage.setItem('next-stop:outbox:v1:unreadable-orphan', '{'));
  await openNotes(page);
  await expect(page.getByLabel('01문제와 맥락')).toHaveValue('서버에 저장된 메모');
  expect(await page.evaluate(() => localStorage.getItem('next-stop:outbox:v1:unreadable-orphan'))).toBe('{');
  expect(cloud.document.progress.notes['ownership:0']).toBe('서버에 저장된 메모');
});

test('an unreadable outbox can never replace the server record with an empty placeholder', async ({ page }) => {
  const cloud = cloudFixture();
  cloud.document.progress.notes['ownership:0'] = '서버에 저장된 메모';
  await cloud.attach(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('unreadable-online-seeded')) return;
    sessionStorage.setItem('unreadable-online-seeded', 'true');
    sessionStorage.setItem('next-stop:tab:v1', 'unreadable-online');
    localStorage.setItem('next-stop:outbox:v1:unreadable-online', '{');
  });
  await page.goto('/');
  await page.getByLabel('접속 키', { exact: true }).fill('e2e-only-key-never-for-production-12345678');
  await page.getByRole('button', { name: '연습실 들어가기' }).click();
  await expect(page.getByLabel('동기화 상태')).toHaveText('기록 선택 필요');
  await expect(page.getByRole('heading', { name: '어떤 기록으로 이어갈까요?' })).toBeVisible();
  await expect(page.getByRole('button', { name: '이 기기 기록으로 교체' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이 기기 초안 백업' })).toHaveCount(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '서버 기록 사용' }).click();
  await expect(page.getByLabel('동기화 상태')).toHaveText('서버 저장 완료');
  await page
    .getByRole('navigation')
    .filter({ visible: true })
    .getByRole('button', { name: '내 이야기', exact: true })
    .click();
  await page.getByRole('button', { name: /내가 끝까지 책임진 문제/ }).click();
  await expect(page.getByLabel('01문제와 맥락')).toHaveValue('서버에 저장된 메모');
  expect(cloud.document.progress.notes['ownership:0']).toBe('서버에 저장된 메모');
});
