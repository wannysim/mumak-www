import { toPostContentHtml, toPostDocumentMarkdown } from '../api/markdown';
import type { Post } from '../api/posts';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

const post: Post = {
  meta: {
    slug: 'my-post',
    title: 'My Post',
    date: '2026-06-01',
    description: 'A short description',
    category: 'essay',
    readingTime: 3,
    outgoingHrefs: [],
  },
  content: '## Heading\n\nBody paragraph linking [[some-note|a note]].',
};

describe('toPostDocumentMarkdown', () => {
  it('prepends an H1 title, description, and canonical link', () => {
    const md = toPostDocumentMarkdown('en', post);

    expect(md).toContain('# My Post');
    expect(md).toContain('A short description');
    expect(md).toContain(`[${BASE_URL}/en/blog/essay/my-post](${BASE_URL}/en/blog/essay/my-post)`);
  });

  it('converts wikilinks in the body to absolute markdown links', () => {
    const md = toPostDocumentMarkdown('ko', post);

    expect(md).toContain(`[a note](${BASE_URL}/ko/garden/some-note)`);
    expect(md).not.toContain('[[some-note');
  });
});

describe('toPostContentHtml', () => {
  it('renders the body (without the title) to HTML', () => {
    const html = toPostContentHtml('en', post);

    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<a href="https://wannysim.com/en/garden/some-note">a note</a>');
    // 제목(H1)은 채널 item title이 담으므로 본문 HTML에는 포함하지 않는다.
    expect(html).not.toContain('My Post');
  });

  it('preserves the validated picture contract for RSS content', () => {
    const hash = 'a'.repeat(64);
    const picture = `<picture>
  <source type="image/webp" srcSet="https://img.wannysim.com/blog/${hash}/content-v1/image.webp" />
  <img src="https://img.wannysim.com/blog/${hash}/content-v1/image.jpg" alt="바닷가의 해 질 녘" width="1600" height="1067" loading="lazy" decoding="async" />
</picture>`;

    const html = toPostContentHtml('ko', { ...post, content: picture });

    expect(html).toContain(`https://img.wannysim.com/blog/${hash}/content-v1/image.webp`);
    expect(html).toContain(`https://img.wannysim.com/blog/${hash}/content-v1/image.jpg`);
    expect(html).toContain('alt="바닷가의 해 질 녘"');
    expect(html).toContain('width="1600" height="1067"');
    expect(html).not.toContain('/_next/image');
  });
});
