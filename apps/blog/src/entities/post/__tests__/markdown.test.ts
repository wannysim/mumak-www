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
});
