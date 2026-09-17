import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ImageUploadForm } from '../image-upload-form';

const result = {
  assetId: 'a'.repeat(64),
  width: 1600,
  height: 1067,
  urls: {
    jpeg: `https://img.wannysim.com/blog/${'a'.repeat(64)}/content-v1/image.jpg`,
    webp: `https://img.wannysim.com/blog/${'a'.repeat(64)}/content-v1/image.webp`,
  },
};

describe('ImageUploadForm', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(global, 'fetch');
  });

  it('keeps publishing disabled until file and alt are present', async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn();
    Object.defineProperty(global, 'fetch', { configurable: true, value: fetchMock });
    render(<ImageUploadForm onSessionExpired={jest.fn()} />);

    const publish = screen.getByRole('button', { name: '이미지 발행' });
    expect(publish).toBeDisabled();
    fireEvent.submit(publish.closest('form')!);
    expect(fetchMock).not.toHaveBeenCalled();

    await user.upload(screen.getByLabelText('업로드 이미지'), new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' }));
    expect(publish).toBeDisabled();

    await user.type(screen.getByLabelText('대체 텍스트'), '산 위로 떠오르는 해');
    expect(publish).toBeEnabled();
  });

  it('allows an explicitly decorative image without meaningful alt', async () => {
    const user = userEvent.setup();
    render(<ImageUploadForm onSessionExpired={jest.fn()} />);

    await user.upload(
      screen.getByLabelText('업로드 이미지'),
      new File(['jpeg'], 'decoration.jpg', { type: 'image/jpeg' })
    );
    await user.click(screen.getByLabelText('의미 없는 장식 이미지'));

    expect(screen.getByLabelText('대체 텍스트')).toBeDisabled();
    expect(screen.getByRole('button', { name: '이미지 발행' })).toBeEnabled();
  });

  it('uploads to the signed R2 URL without exposing the operator token, then publishes the ticket', async () => {
    const user = userEvent.setup();
    const file = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
    const ticket = {
      ticketId: 'ticket-1',
      uploadUrl: 'https://r2.example/upload',
      headers: { 'Content-Type': 'application/octet-stream', 'If-None-Match': '*' },
    };
    const fetchSpy = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ticket })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => result });
    Object.defineProperty(global, 'fetch', { configurable: true, value: fetchSpy });
    render(<ImageUploadForm onSessionExpired={jest.fn()} />);
    await user.upload(screen.getByLabelText('업로드 이미지'), file);
    await user.type(screen.getByLabelText('대체 텍스트'), '설명');
    fireEvent.submit(screen.getByRole('button', { name: '이미지 발행' }).closest('form')!);
    const snippet = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'React / MDX snippet' });
    expect(snippet.value).toContain(result.urls.jpeg);
    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/images/uploads', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bytes: file.size }),
    });
    await user.click(screen.getByRole('button', { name: 'snippet 복사' }));
    expect(screen.getByText('React / MDX snippet을 복사했습니다.')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenNthCalledWith(2, ticket.uploadUrl, {
      method: 'PUT',
      credentials: 'omit',
      headers: ticket.headers,
      body: file,
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(3, '/api/images', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: 'ticket-1' }),
    });

    await user.click(screen.getByRole('radio', { name: 'Next.js' }));
    expect(screen.getByRole('radio', { name: 'Next.js' })).toBeChecked();
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Next.js snippet' }).value).toContain('<Image');
    await user.click(screen.getByRole('button', { name: 'snippet 복사' }));
    expect(await navigator.clipboard.readText()).toContain("import Image from 'next/image';");
    await user.click(screen.getByRole('button', { name: '도메인 설정 복사' }));
    expect(await navigator.clipboard.readText()).toContain("hostname: 'img.wannysim.com'");

    await user.click(screen.getByRole('radio', { name: 'HTML' }));
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'HTML snippet' }).value).toContain('srcset=');
    await user.click(screen.getByRole('radio', { name: 'Markdown' }));
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Markdown snippet' }).value).toBe(
      `![설명](${result.urls.jpeg})`
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    await user.clear(screen.getByLabelText('대체 텍스트'));
    expect(screen.getByRole('button', { name: 'snippet 복사' })).toBeDisabled();
    await user.type(screen.getByLabelText('대체 텍스트'), '수정한 설명');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Markdown snippet' }).value).toContain(
      '수정한 설명'
    );

    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    await user.click(screen.getByRole('button', { name: 'snippet 복사' }));
    expect(screen.getByText('복사하지 못했습니다. 코드를 직접 선택해 복사하세요.')).toBeInTheDocument();

    await user.upload(screen.getByLabelText('업로드 이미지'), new File(['other'], 'other.jpg', { type: 'image/jpeg' }));
    expect(screen.queryByRole('textbox', { name: 'Markdown snippet' })).not.toBeInTheDocument();
  });

  it.each(['admission', 'transfer'])('stops before publication on R2 %s failure', async failure => {
    const user = userEvent.setup();
    const fetchSpy = jest
      .fn()
      .mockResolvedValueOnce(
        failure === 'admission'
          ? { ok: false, json: async () => ({ error: '오늘의 제한입니다.' }) }
          : {
              ok: true,
              json: async () => ({ ticketId: 'ticket', uploadUrl: 'https://r2.example/upload', headers: {} }),
            }
      )
      .mockResolvedValueOnce({ ok: false });
    Object.defineProperty(global, 'fetch', { configurable: true, value: fetchSpy });
    render(<ImageUploadForm onSessionExpired={jest.fn()} />);
    await user.upload(screen.getByLabelText('업로드 이미지'), new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' }));
    await user.type(screen.getByLabelText('대체 텍스트'), '설명');
    fireEvent.submit(screen.getByRole('button', { name: '이미지 발행' }).closest('form')!);
    expect(
      await screen.findByText(
        failure === 'admission' ? '오늘의 제한입니다.' : '이미지 전송에 실패했습니다. 다시 업로드하세요.'
      )
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(failure === 'admission' ? 1 : 2);
  });

  it('shows the safe API error without rendering a snippet', async () => {
    const user = userEvent.setup();
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: '저장 공간이 부족합니다.' }),
      }),
    });
    render(<ImageUploadForm onSessionExpired={jest.fn()} />);

    await user.upload(screen.getByLabelText('업로드 이미지'), new File(['jpeg'], 'photo.jpg'));
    await user.type(screen.getByLabelText('대체 텍스트'), '설명');
    fireEvent.submit(screen.getByRole('button', { name: '이미지 발행' }).closest('form')!);

    expect(await screen.findByText('저장 공간이 부족합니다.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'React / MDX snippet' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이미지 발행' })).toBeEnabled();
  });

  it('uses a generic message for an unstructured client failure', async () => {
    const user = userEvent.setup();
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: jest.fn().mockRejectedValue('network failure'),
    });
    render(<ImageUploadForm onSessionExpired={jest.fn()} />);

    await user.upload(screen.getByLabelText('업로드 이미지'), new File(['jpeg'], 'photo.jpg'));
    await user.type(screen.getByLabelText('대체 텍스트'), '설명');
    fireEvent.submit(screen.getByRole('button', { name: '이미지 발행' }).closest('form')!);

    expect(await screen.findByText('이미지를 발행하지 못했습니다.')).toBeInTheDocument();
  });
});

describe('upload authorization and publication failures', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(global, 'fetch');
  });

  it.each(['admission', 'publication'])('returns to login on %s 401 without reading its body', async stage => {
    const user = userEvent.setup();
    const expired = jest.fn();
    const unauthorized = { ok: false, status: 401, json: jest.fn() };
    const fetchMock = jest.fn();
    if (stage === 'publication') {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ticketId: 'ticket', uploadUrl: 'https://r2.example/upload', headers: {} }),
      });
      fetchMock.mockResolvedValueOnce({ ok: true });
    }
    fetchMock.mockResolvedValueOnce(unauthorized);
    Object.defineProperty(global, 'fetch', { configurable: true, value: fetchMock });
    render(<ImageUploadForm onSessionExpired={expired} />);
    await user.upload(screen.getByLabelText('업로드 이미지'), new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' }));
    await user.type(screen.getByLabelText('대체 텍스트'), '설명');
    fireEvent.submit(screen.getByRole('button', { name: '이미지 발행' }).closest('form')!);
    await waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
    expect(unauthorized.json).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(stage === 'admission' ? 1 : 3);
    expect(screen.queryByRole('textbox', { name: 'React / MDX snippet' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이미지 발행' })).toBeEnabled();
  });

  it('shows a publication failure and allows retry without a snippet', async () => {
    const user = userEvent.setup();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ticketId: 'ticket', uploadUrl: 'https://r2.example/upload', headers: {} }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: '공개 URL 검증 실패' }) });
    Object.defineProperty(global, 'fetch', { configurable: true, value: fetchMock });
    render(<ImageUploadForm onSessionExpired={jest.fn()} />);
    await user.upload(screen.getByLabelText('업로드 이미지'), new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' }));
    await user.type(screen.getByLabelText('대체 텍스트'), '설명');
    fireEvent.submit(screen.getByRole('button', { name: '이미지 발행' }).closest('form')!);
    expect(await screen.findByText('공개 URL 검증 실패')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'React / MDX snippet' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이미지 발행' })).toBeEnabled();
  });

  it('rejects oversized files before admission', async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn();
    Object.defineProperty(global, 'fetch', { configurable: true, value: fetchMock });
    const file = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 32 * 1024 * 1024 + 1 });
    render(<ImageUploadForm onSessionExpired={jest.fn()} />);
    await user.upload(screen.getByLabelText('업로드 이미지'), file);
    await user.type(screen.getByLabelText('대체 텍스트'), '설명');
    fireEvent.submit(screen.getByRole('button', { name: '이미지 발행' }).closest('form')!);
    expect(await screen.findByText('파일이 32 MiB 제한을 넘었습니다.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
