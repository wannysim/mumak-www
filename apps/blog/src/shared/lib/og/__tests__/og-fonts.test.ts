import { readFile } from 'node:fs/promises';

import { loadOgFonts } from '../og-fonts';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));

const mockReadFile = jest.mocked(readFile);

describe('loadOgFonts', () => {
  beforeEach(() => {
    mockReadFile.mockImplementation(async file => Buffer.from(String(file)));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads Pretendard font buffers for supported OG weights', async () => {
    const fonts = await loadOgFonts();

    expect(fonts).toHaveLength(3);
    expect(fonts.map(font => font.weight)).toEqual([400, 600, 700]);
    expect(fonts.every(font => font.name === 'Pretendard')).toBe(true);
    expect(fonts.every(font => font.style === 'normal')).toBe(true);
    expect(fonts.every(font => font.data.byteLength > 0)).toBe(true);
  });

  it('reads fonts from the public asset directory', async () => {
    await loadOgFonts();

    expect(mockReadFile).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('public/assets/fonts/Pretendard-Regular.woff')
    );
    expect(mockReadFile).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('public/assets/fonts/Pretendard-SemiBold.woff')
    );
    expect(mockReadFile).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('public/assets/fonts/Pretendard-Bold.woff')
    );
  });
});
