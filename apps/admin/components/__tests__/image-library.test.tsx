import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ImageLibrary } from '../image-library';

const asset = 'a'.repeat(64);
const file = (extension: string, bytes = 1024) => ({
  key: `blog/${asset}/content-v1/image.${extension}`,
  bytes,
  modifiedAt: '2026-09-18T00:00:00.000Z',
  url: `https://img.wannysim.com/blog/${asset}/content-v1/image.${extension}`,
});
const response = (files: ReturnType<typeof file>[], cursor: string | null = null) => ({
  ok: true,
  json: async () => ({ files, cursor }),
});
let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn();
  Object.defineProperty(global, 'fetch', { configurable: true, value: fetchMock });
});
afterEach(() => {
  jest.restoreAllMocks();
  Reflect.deleteProperty(global, 'fetch');
});

it('merges pages without counting renditions as images and browses the actual folder path', async () => {
  const user = userEvent.setup();
  fetchMock
    .mockResolvedValueOnce(response([file('jpg')], 'next+/='))
    .mockResolvedValueOnce(response([file('jpg'), file('webp')]));
  render(<ImageLibrary onSessionExpired={jest.fn()} />);
  expect(await screen.findByText('1장 · 1개 파일 · 1.0 KiB (불러온 기준)')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '더 불러오기' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '더 불러오기' })).not.toBeInTheDocument());
  expect(fetchMock.mock.calls[1][0]).toBe('/api/images/library?cursor=next%2B%2F%3D');
  await user.click(screen.getByRole('button', { name: `${asset} 폴더 열기` }));
  await user.click(screen.getByRole('button', { name: 'content-v1 폴더 열기' }));
  expect(screen.getByText('1장 · 2개 파일 · 2.0 KiB')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'image.jpg 새 창에서 보기' })).toHaveAttribute('href', file('jpg').url);
  expect(screen.getByRole('textbox', { name: 'image.webp 공개 주소' })).toHaveValue(file('webp').url);
  await user.click(screen.getByRole('button', { name: 'image.webp 주소 복사' }));
  expect(await navigator.clipboard.readText()).toBe(file('webp').url);
  jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
  await user.click(screen.getByRole('button', { name: 'image.jpg 주소 복사' }));
  expect(screen.getByText('복사하지 못했습니다. 아래 주소를 직접 복사하세요.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^blog$/ }));
  expect(screen.getByRole('button', { name: `${asset} 폴더 열기` })).toBeVisible();
  fetchMock.mockResolvedValueOnce(response([]));
  await user.click(screen.getByRole('button', { name: '새로고침' }));
  expect(await screen.findByText('이 폴더에 저장된 이미지가 없습니다.')).toBeInTheDocument();
});

it('retries failed pagination without losing already loaded files', async () => {
  const user = userEvent.setup();
  fetchMock
    .mockResolvedValueOnce(response([file('jpg')], 'next'))
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce(response([file('webp')]));
  render(<ImageLibrary onSessionExpired={jest.fn()} />);
  await user.click(await screen.findByRole('button', { name: '더 불러오기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('이미지 목록을 불러오지 못했습니다.');
  await user.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getAllByText('1장 · 2개 파일 · 2.0 KiB')).toHaveLength(2);
});

it('returns to login for an expired session without consuming the response body', async () => {
  const expired = jest.fn();
  const json = jest.fn();
  fetchMock.mockResolvedValueOnce({ status: 401, json });
  render(<ImageLibrary onSessionExpired={expired} />);
  await waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
  expect(json).not.toHaveBeenCalled();
});

it('aborts an outstanding request when navigating away', async () => {
  fetchMock.mockImplementation(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
  );
  const { unmount } = render(<ImageLibrary onSessionExpired={jest.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
  unmount();
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
});

it('handles an empty filtered page that has more results', async () => {
  fetchMock.mockResolvedValue(response([], 'next'));
  render(<ImageLibrary onSessionExpired={jest.fn()} />);
  expect(await screen.findByText('아직 표시할 이미지가 없습니다. 더 불러와 주세요.')).toBeInTheDocument();
});
