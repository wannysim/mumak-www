import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ImageUploadForm, createSnippet } from '../image-upload-form';

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

  it('keeps publishing disabled until file, token, and alt are present', async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn();
    Object.defineProperty(global, 'fetch', { configurable: true, value: fetchMock });
    render(<ImageUploadForm />);

    const publish = screen.getByRole('button', { name: '이미지 발행' });
    expect(publish).toBeDisabled();
    fireEvent.submit(publish.closest('form')!);
    expect(fetchMock).not.toHaveBeenCalled();

    await user.upload(screen.getByLabelText('JPEG 이미지'), new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' }));
    await user.type(screen.getByLabelText('업로드 토큰'), 'secret');
    expect(publish).toBeDisabled();

    await user.type(screen.getByLabelText('대체 텍스트'), '산 위로 떠오르는 해');
    expect(publish).toBeEnabled();
  });

  it('allows an explicitly decorative image without meaningful alt', async () => {
    const user = userEvent.setup();
    render(<ImageUploadForm />);

    await user.upload(
      screen.getByLabelText('JPEG 이미지'),
      new File(['jpeg'], 'decoration.jpg', { type: 'image/jpeg' })
    );
    await user.type(screen.getByLabelText('업로드 토큰'), 'secret');
    await user.click(screen.getByLabelText('의미 없는 장식 이미지'));

    expect(screen.getByLabelText('대체 텍스트')).toBeDisabled();
    expect(screen.getByRole('button', { name: '이미지 발행' })).toBeEnabled();
  });

  it('uploads raw bytes, renders the snippet, and copies it', async () => {
    const user = userEvent.setup();
    const file = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
    const fetchSpy = jest.fn().mockResolvedValue({ ok: true, json: async () => result });
    Object.defineProperty(global, 'fetch', { configurable: true, value: fetchSpy });
    render(<ImageUploadForm />);

    await user.upload(screen.getByLabelText('JPEG 이미지'), file);
    await user.type(screen.getByLabelText('업로드 토큰'), 'secret');
    await user.type(screen.getByLabelText('대체 텍스트'), '산 위로 떠오르는 해');
    fireEvent.submit(screen.getByRole('button', { name: '이미지 발행' }).closest('form')!);

    const snippet = await screen.findByRole('textbox', { name: 'MDX snippet' });
    expect((snippet as HTMLTextAreaElement).value).toContain(result.urls.jpeg);
    expect(fetchSpy).toHaveBeenCalledWith('/api/images', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret',
        'Content-Type': 'application/octet-stream',
      },
      body: file,
    });
    expect(screen.getByText('공개 URL 검증까지 완료했습니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'snippet 복사' }));
    expect(screen.getByText('MDX snippet을 복사했습니다.')).toBeInTheDocument();
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
    render(<ImageUploadForm />);

    await user.upload(screen.getByLabelText('JPEG 이미지'), new File(['jpeg'], 'photo.jpg'));
    await user.type(screen.getByLabelText('업로드 토큰'), 'secret');
    await user.type(screen.getByLabelText('대체 텍스트'), '설명');
    fireEvent.submit(screen.getByRole('button', { name: '이미지 발행' }).closest('form')!);

    expect(await screen.findByText('저장 공간이 부족합니다.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'MDX snippet' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이미지 발행' })).toBeEnabled();
  });

  it('uses a generic message for an unstructured client failure', async () => {
    const user = userEvent.setup();
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: jest.fn().mockRejectedValue('network failure'),
    });
    render(<ImageUploadForm />);

    await user.upload(screen.getByLabelText('JPEG 이미지'), new File(['jpeg'], 'photo.jpg'));
    await user.type(screen.getByLabelText('업로드 토큰'), 'secret');
    await user.type(screen.getByLabelText('대체 텍스트'), '설명');
    fireEvent.submit(screen.getByRole('button', { name: '이미지 발행' }).closest('form')!);

    expect(await screen.findByText('이미지를 발행하지 못했습니다.')).toBeInTheDocument();
  });
});

describe('createSnippet', () => {
  it('creates one immutable WebP/JPEG picture pair with real dimensions', () => {
    expect(createSnippet(result, ' 산 위로 떠오르는 해 ', false)).toContain(`srcSet="${result.urls.webp}"`);
    expect(createSnippet(result, ' 산 위로 떠오르는 해 ', false)).toContain(`src="${result.urls.jpeg}"`);
    expect(createSnippet(result, ' 산 위로 떠오르는 해 ', false)).toContain('alt="산 위로 떠오르는 해"');
    expect(createSnippet(result, ' 산 위로 떠오르는 해 ', false)).toContain('width="1600"');
  });

  it('marks decorative images with the complete accessibility contract', () => {
    const snippet = createSnippet(result, '', true);
    expect(snippet).toContain('alt=""');
    expect(snippet).toContain('role="presentation"');
    expect(snippet).toContain('aria-hidden="true"');
  });

  it('escapes user-authored alt text inside the MDX attribute', () => {
    expect(createSnippet(result, 'A < B & "quoted"', false)).toContain('alt="A &lt; B &amp; &quot;quoted&quot;"');
  });
});
