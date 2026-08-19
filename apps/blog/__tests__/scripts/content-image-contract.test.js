import { validateContentImages } from '../../scripts/content-image-contract.js';

const HASH = 'a'.repeat(64);
const picture = ({
  webpHash = HASH,
  jpegHash = HASH,
  webpVersion = 'content-v1',
  jpegVersion = webpVersion,
  alt = '바닷가의 해 질 녘',
  dimensions = 'width="1600" height="1067"',
  decorative = '',
} = {}) => `<picture>
  <source type="image/webp" srcSet="https://img.wannysim.com/blog/${webpHash}/${webpVersion}/image.webp" />
  <img src="https://img.wannysim.com/blog/${jpegHash}/${jpegVersion}/image.jpg" alt="${alt}" ${dimensions} ${decorative} loading="lazy" decoding="async" />
</picture>`;

describe('validateContentImages', () => {
  it('accepts meaningful and decorative immutable picture pairs', () => {
    expect(validateContentImages(picture())).toEqual([]);
    expect(validateContentImages(picture({ webpVersion: 'content-v10' }))).toEqual([]);
    expect(validateContentImages(picture({ alt: '', decorative: 'role="presentation" aria-hidden="true"' }))).toEqual(
      []
    );
  });

  it('ignores image examples in fenced and inline code', () => {
    const content = `
\`<img src="unsafe.jpg" />\`

\`multi-line
<img src="unsafe.jpg" />
example\`

\`\`\`mdx
![example](unsafe.jpg)
<picture><img src="unsafe.jpg" /></picture>
\`\`\`

~~~html
<IMG src="unsafe.jpg">
~~~`;

    expect(validateContentImages(content)).toEqual([]);
  });

  it('rejects Markdown images and image elements outside lowercase picture', () => {
    expect(validateContentImages('![설명]\n(https://example.com/image.jpg)')).toEqual([
      expect.stringContaining('Markdown 이미지 문법'),
    ]);
    for (const image of ['<IMG src="image.jpg" alt="설명" />', '<Image src="image.jpg" alt="설명" />']) {
      expect(validateContentImages(image)).toEqual([expect.stringContaining('lowercase <picture>')]);
    }
    expect(validateContentImages('\\\\![설명](https://example.com/image.jpg)')).toEqual([
      expect.stringContaining('Markdown 이미지 문법'),
    ]);
    expect(validateContentImages('\\![문자 그대로](https://example.com/image.jpg)')).toEqual([]);
  });

  it('rejects the wrong host, path, hash length, case, version, or format', () => {
    const invalidPictures = [
      picture().replace('img.wannysim.com', 'example.com'),
      picture().replace('/blog/', '/photos/'),
      picture({ webpHash: 'a'.repeat(63), jpegHash: 'a'.repeat(63) }),
      picture({ webpHash: 'A'.repeat(64), jpegHash: 'A'.repeat(64) }),
      picture({ webpVersion: 'content-v0' }),
      picture({ webpVersion: 'content-v01' }),
      picture().replace('image.webp', 'image.jpg'),
    ];

    for (const content of invalidPictures) {
      expect(validateContentImages(content)).toEqual([expect.stringContaining('full lowercase SHA-256 content-vN')]);
    }
  });

  it('rejects mismatched hashes and incomplete picture pairs', () => {
    expect(validateContentImages(picture({ jpegHash: 'b'.repeat(64) }))).toEqual([
      expect.stringContaining('같은 hash와 version'),
    ]);
    expect(validateContentImages(picture({ jpegVersion: 'content-v2' }))).toEqual([
      expect.stringContaining('같은 hash와 version'),
    ]);
    expect(validateContentImages(`<picture><img src="image.jpg" /></picture>`)).toEqual([
      expect.stringContaining('WebP <source />와 JPEG <img />'),
    ]);
  });

  it('rejects duplicate or unvalidated fetch-bearing attributes', () => {
    expect(validateContentImages(picture().replace('<img ', '<img srcSet="https://example.com/evil.jpg 2x" '))).toEqual(
      expect.arrayContaining([expect.stringContaining('검증된 native image 속성')])
    );
    expect(validateContentImages(picture().replace('srcSet=', 'SRCSET="duplicate" srcSet='))).toEqual([
      expect.stringContaining('중복 없이'),
    ]);
    expect(validateContentImages(picture().replace('<source ', '<source sizes="100vw" '))).toEqual(
      expect.arrayContaining([expect.stringContaining('type과 srcSet만')])
    );
  });

  it('rejects missing or non-positive dimensions', () => {
    for (const dimensions of ['', 'width="0" height="1067"', 'width="1600" height="-1"']) {
      expect(validateContentImages(picture({ dimensions }))).toEqual(
        expect.arrayContaining([expect.stringMatching(/width|height/)])
      );
    }
  });

  it('requires meaningful alt text or the complete decorative contract', () => {
    expect(validateContentImages(picture({ alt: '' }))).toEqual([expect.stringContaining('role="presentation"')]);
    expect(validateContentImages(picture({ alt: '   ' }))).toEqual([expect.stringContaining('의미 있는 alt')]);
    expect(validateContentImages(picture({ decorative: 'role="presentation" aria-hidden="true"' }))).toEqual([
      expect.stringContaining('숨길 수 없습니다'),
    ]);
  });
});
