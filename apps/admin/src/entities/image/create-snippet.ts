import type { PublishedImage } from './published-image';

const SNIPPET_FORMATS = [
  {
    value: 'react',
    label: 'React / MDX',
    description: 'JSX 또는 MDX에 붙이세요. 이 블로그에서는 자동 최적화와 이미지 확대가 적용됩니다.',
  },
  {
    value: 'html',
    label: 'HTML',
    description: 'WebP와 JPEG fallback을 포함한 HTML입니다. 화면 너비에 맞는 크기는 CSS로 지정하세요.',
  },
  {
    value: 'markdown',
    label: 'Markdown',
    description: '일반 Markdown용입니다. 크기와 WebP fallback을 지정할 수 없어 이 블로그에는 React / MDX를 사용하세요.',
  },
  {
    value: 'next',
    label: 'Next.js',
    description: 'Next.js 페이지·컴포넌트용입니다. Image import를 파일 상단에 두고 sizes를 실제 표시 너비에 맞추세요.',
  },
] as const;

type SnippetFormat = (typeof SNIPPET_FORMATS)[number]['value'];

const NEXT_IMAGE_REMOTE_PATTERN = `{
  protocol: 'https',
  hostname: 'img.wannysim.com',
  pathname: '/blog/**',
  search: '',
}`;

function createSnippet(result: PublishedImage, alt: string, decorative: boolean, format: SnippetFormat = 'react') {
  if (format === 'markdown') {
    const markdownAlt = decorative
      ? ''
      : alt
          .trim()
          .replace(/\s+/g, ' ')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replace(/[\\[\]`*_]/g, '\\$&');
    return `![${markdownAlt}](${result.urls.jpeg})`;
  }

  const escapedAlt = alt
    .trim()
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const accessibility = decorative ? 'alt=""\n    role="presentation"\n    aria-hidden="true"' : `alt="${escapedAlt}"`;

  if (format === 'next') {
    return `import Image from 'next/image';

<Image
  src="${result.urls.jpeg}"
  ${accessibility.replaceAll('\n    ', '\n  ')}
  width={${result.width}}
  height={${result.height}}
  sizes="100vw"
  style={{ width: '100%', height: 'auto' }}
/>`;
  }

  return `<picture>
  <source type="image/webp" ${format === 'html' ? 'srcset' : 'srcSet'}="${result.urls.webp}" />
  <img
    src="${result.urls.jpeg}"
    ${accessibility}
    width="${result.width}"
    height="${result.height}"
    loading="lazy"
    decoding="async"
  />
</picture>`;
}

export { createSnippet, NEXT_IMAGE_REMOTE_PATTERN, SNIPPET_FORMATS, type SnippetFormat };
