import { createSnippet } from '../create-snippet';

const result = {
  assetId: 'a'.repeat(64),
  width: 1600,
  height: 1067,
  urls: {
    jpeg: `https://img.wannysim.com/blog/${'a'.repeat(64)}/content-v1/image.jpg`,
    webp: `https://img.wannysim.com/blog/${'a'.repeat(64)}/content-v1/image.webp`,
  },
};

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

  it('uses HTML attribute casing for the HTML format', () => {
    const snippet = createSnippet(result, 'Garden', false, 'html');
    expect(snippet).toContain(`srcset="${result.urls.webp}"`);
    expect(snippet).not.toContain('srcSet');
    const template = document.createElement('template');
    template.innerHTML = snippet;
    expect(template.content.querySelector('img')?.getAttribute('alt')).toBe('Garden');
  });

  it('escapes Markdown alt syntax and keeps the published JPEG URL', () => {
    expect(createSnippet(result, ' A [garden] *photo*\n& <tree> ', false, 'markdown')).toBe(
      `![A \\[garden\\] \\*photo\\* &amp; &lt;tree&gt;](${result.urls.jpeg})`
    );
    expect(createSnippet(result, 'ignored', true, 'markdown')).toBe(`![](${result.urls.jpeg})`);
  });

  it('creates a responsive Next Image with an import and numeric dimensions', () => {
    const snippet = createSnippet(result, 'A "garden"', false, 'next');
    expect(snippet).toContain("import Image from 'next/image';");
    expect(snippet).toContain('<Image');
    expect(snippet).toContain(`src="${result.urls.jpeg}"`);
    expect(snippet).toContain('alt="A &quot;garden&quot;"');
    expect(snippet).toContain('width={1600}');
    expect(snippet).toContain('height={1067}');
    expect(snippet).toContain('sizes="100vw"');
    expect(snippet).toContain("height: 'auto'");
    expect(snippet).not.toContain('unoptimized');
    expect(snippet).not.toContain('<picture>');
  });

  it.each(['react', 'html', 'next'] as const)('keeps decorative semantics in %s', format => {
    const snippet = createSnippet(result, 'Ignored caption', true, format);
    expect(snippet).toContain('alt=""');
    expect(snippet).toContain('role="presentation"');
    expect(snippet).toContain('aria-hidden="true"');
    expect(snippet).not.toContain('Ignored caption');
  });
});
