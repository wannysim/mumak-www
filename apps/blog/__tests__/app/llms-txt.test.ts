/**
 * @jest-environment node
 */
import { buildLlmsTxt } from '@/src/app/seo';
import { getNotes } from '@/src/entities/note';
import { getPosts } from '@/src/entities/post';

describe('buildLlmsTxt', () => {
  const text = buildLlmsTxt();

  it('should start with the site title and a summary blockquote', () => {
    expect(text.startsWith('# Wan Sim\n')).toBe(true);
    expect(text).toMatch(/\n> .+/);
  });

  it('should document the .md clean-markdown convention', () => {
    expect(text).toContain('.md');
    expect(text).toMatch(/clean markdown/i);
  });

  it('should provide per-locale Blog and Garden sections', () => {
    expect(text).toContain('## Blog (한국어)');
    expect(text).toContain('## Garden (한국어)');
    expect(text).toContain('## Blog (English)');
    expect(text).toContain('## Garden (English)');
  });

  it('should link blog posts to their .md endpoint', () => {
    const [post] = getPosts('ko');
    if (!post) throw new Error('expected at least one ko post fixture');
    expect(text).toContain(`/ko/blog/${post.category}/${post.slug}.md`);
  });

  it('should link garden notes to their page URL', () => {
    const [note] = getNotes('ko');
    if (!note) throw new Error('expected at least one ko note fixture');
    expect(text).toContain(`/ko/garden/${note.slug}`);
  });

  it('should end with a trailing newline', () => {
    expect(text.endsWith('\n')).toBe(true);
  });
});

describe('llms.txt route', () => {
  it('should serve text/plain with cache headers', async () => {
    const { GET } = await import('@/app/llms.txt/route');
    const response = GET();

    expect(response.headers.get('Content-Type')).toContain('text/plain');
    expect(response.headers.get('Cache-Control')).toContain('s-maxage');
    expect((await response.text()).startsWith('# Wan Sim')).toBe(true);
  });
});
