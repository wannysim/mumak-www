import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TOAST_DURATION, ToastProvider, useToast } from '@/components/toaster';

function Trigger({ tone, title, description }: { tone: 'success' | 'error'; title: string; description?: string }) {
  const showToast = useToast();
  return (
    <button type="button" onClick={() => showToast({ tone, title, description })}>
      알림 띄우기
    </button>
  );
}

function renderToast(props: React.ComponentProps<typeof Trigger>) {
  return render(
    <ToastProvider>
      <Trigger {...props} />
    </ToastProvider>
  );
}

// 라이브 영역이 토스트와 함께 나타나면 스크린리더가 읽지 않는다. 늘 떠 있어야 한다.
it('keeps the live region mounted before anything is announced', () => {
  renderToast({ tone: 'success', title: '무시' });
  expect(screen.getByRole('status', { name: '알림' })).toBeEmptyDOMElement();
});

it('announces a success through the polite region', async () => {
  const user = userEvent.setup();
  renderToast({ tone: 'success', title: '운용 내역을 새로 불러왔습니다.', description: '데이터 기준 시각 9월 21일' });
  await user.click(screen.getByRole('button', { name: '알림 띄우기' }));

  const status = screen.getByRole('status', { name: '알림' });
  expect(status).toHaveTextContent('운용 내역을 새로 불러왔습니다.');
  expect(status).toHaveTextContent('데이터 기준 시각 9월 21일');
});

it('announces a failure with its own icon tone', async () => {
  const user = userEvent.setup();
  const { container } = renderToast({ tone: 'error', title: '운용 내역을 불러오지 못했습니다.' });
  await user.click(screen.getByRole('button', { name: '알림 띄우기' }));

  const status = screen.getByRole('status', { name: '알림' });
  expect(status).toHaveTextContent('운용 내역을 불러오지 못했습니다.');
  expect(container.querySelector('.text-destructive')).toBeInTheDocument();
});

it('dismisses on request', async () => {
  const user = userEvent.setup();
  renderToast({ tone: 'success', title: '불러왔습니다.' });
  await user.click(screen.getByRole('button', { name: '알림 띄우기' }));
  await user.click(screen.getByRole('button', { name: '알림 닫기' }));

  expect(screen.getByRole('status', { name: '알림' })).toBeEmptyDOMElement();
});

it('disappears on its own so it never covers the dashboard for good', () => {
  vi.useFakeTimers();
  try {
    // userEvent는 fake timer와 함께 쓰면 자체 대기에 걸려 멈춘다. 여기서 검증할 건
    // 클릭 방식이 아니라 자동 소멸이라 fireEvent로 충분하다.
    renderToast({ tone: 'success', title: '불러왔습니다.' });
    fireEvent.click(screen.getByRole('button', { name: '알림 띄우기' }));
    expect(screen.getByRole('status', { name: '알림' })).toHaveTextContent('불러왔습니다.');

    act(() => vi.advanceTimersByTime(TOAST_DURATION));
    expect(screen.getByRole('status', { name: '알림' })).toBeEmptyDOMElement();
  } finally {
    vi.useRealTimers();
  }
});
