import { createGardenResolver, transformWikilinks, type LinkResolver } from '../transformer';

describe('transformWikilinks', () => {
  const mockResolver: LinkResolver = {
    resolve: ({ slug, heading, blockId }) =>
      `/ko/garden/${slug}${heading ? `#${heading}` : ''}${blockId ? `#^${blockId}` : ''}`,
    exists: ({ slug, heading, blockId }) =>
      ['existing-note', 'another-note'].includes(slug) &&
      (!heading || heading === 'valid-heading') &&
      (!blockId || blockId === 'valid-block'),
    getEmbedPreview: ({ slug }) => ({ title: `Title ${slug}`, excerpt: `Excerpt ${slug}` }),
  };

  it('존재하는 노트 링크를 WikiLink 컴포넌트로 변환한다', () => {
    const content = '이것은 [[existing-note]] 입니다.';
    const result = transformWikilinks(content, { resolver: mockResolver, currentSlug: 'current-note' });

    expect(result).toBe(
      '이것은 <WikiLink href="/ko/garden/existing-note" slug="existing-note">existing-note</WikiLink> 입니다.'
    );
  });

  it('레이블이 있는 링크를 올바르게 변환한다', () => {
    const content = '참고: [[existing-note|기존 노트]]';
    const result = transformWikilinks(content, { resolver: mockResolver, currentSlug: 'current-note' });

    expect(result).toBe('참고: <WikiLink href="/ko/garden/existing-note" slug="existing-note">기존 노트</WikiLink>');
  });

  it('존재하지 않는 노트는 BrokenWikiLink 컴포넌트로 변환한다', () => {
    const content = '없는 노트: [[non-existent]]';
    const result = transformWikilinks(content, { resolver: mockResolver, currentSlug: 'current-note' });

    expect(result).toBe('없는 노트: <BrokenWikiLink slug="non-existent">non-existent</BrokenWikiLink>');
  });

  it('여러 링크를 동시에 변환한다', () => {
    const content = '[[existing-note]]와 [[non-existent]]';
    const result = transformWikilinks(content, { resolver: mockResolver, currentSlug: 'current-note' });

    expect(result).toContain('<WikiLink');
    expect(result).toContain('<BrokenWikiLink');
  });

  it('slug의 특수문자를 escape하여 attribute injection을 방지한다', () => {
    const content = '[[test" onclick="alert(1)]]';
    const result = transformWikilinks(content, { resolver: mockResolver, currentSlug: 'current-note' });

    // " 문자가 &quot;로 escape되어 attribute를 닫을 수 없음
    expect(result).toContain('&quot;');
    expect(result).toContain('slug="test&quot;');
  });

  it('label의 특수문자를 escape하여 HTML injection을 방지한다', () => {
    const content = '[[existing-note|<script>alert(1)</script>]]';
    const result = transformWikilinks(content, { resolver: mockResolver, currentSlug: 'current-note' });

    // < > 문자가 escape되어 HTML 태그로 해석되지 않음
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('href의 특수문자도 escape하여 attribute injection을 방지한다', () => {
    const maliciousResolver: LinkResolver = {
      resolve: () => '/garden/test"><img src=x onerror=alert(1)>',
      exists: () => true,
      getEmbedPreview: () => ({ title: 'title', excerpt: 'excerpt' }),
    };
    const content = '[[test]]';
    const result = transformWikilinks(content, { resolver: maliciousResolver, currentSlug: 'current-note' });

    // " > < 문자가 escape되어 attribute를 닫거나 새 태그를 열 수 없음
    expect(result).toContain('&quot;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&lt;');
  });

  it('note#heading 링크를 검증 후 변환한다', () => {
    const content = '헤딩 링크: [[existing-note#valid-heading]]';
    const result = transformWikilinks(content, { resolver: mockResolver, currentSlug: 'current-note' });
    expect(result).toContain('href="/ko/garden/existing-note#valid-heading"');
  });

  it('현재 문서 내부 링크 [[#heading]]를 현재 slug 기준으로 변환한다', () => {
    const content = '내부 링크: [[#valid-heading]]';
    const result = transformWikilinks(content, { resolver: mockResolver, currentSlug: 'existing-note' });
    expect(result).toContain('href="/ko/garden/existing-note#valid-heading"');
  });

  it('임베드 문법은 WikiEmbed 컴포넌트로 변환한다', () => {
    const content = '![[existing-note]]';
    const result = transformWikilinks(content, { resolver: mockResolver, currentSlug: 'current-note' });
    expect(result).toContain('<WikiEmbed');
    expect(result).toContain('title="Title existing-note"');
  });

  it('유효하지 않은 임베드는 BrokenWikiEmbed로 변환한다', () => {
    const content = '![[existing-note#missing-heading]]';
    const result = transformWikilinks(content, { resolver: mockResolver, currentSlug: 'current-note' });
    expect(result).toContain('<BrokenWikiEmbed');
  });
});

describe('createGardenResolver', () => {
  it('locale 없이 garden 경로를 생성한다', () => {
    const slugs = new Set(['note-a', 'note-b', 'current-note']);
    const resolver = createGardenResolver({
      existingSlugs: slugs,
      hasHeadingAnchor: (_slug, heading) => heading === 'known-heading',
      hasBlockAnchor: (_slug, blockId) => blockId === 'known-block',
      getEmbedPreview: input => ({ title: input.slug, excerpt: 'preview' }),
    });

    expect(resolver.resolve({ slug: 'note-a' })).toBe('/garden/note-a');
    expect(resolver.resolve({ slug: 'note-a', heading: 'known-heading' })).toBe('/garden/note-a#known-heading');
    expect(resolver.exists({ slug: 'note-a' })).toBe(true);
    expect(resolver.exists({ slug: 'note-a', heading: 'known-heading' })).toBe(true);
    expect(resolver.exists({ slug: 'note-a', blockId: 'known-block' })).toBe(true);
    expect(resolver.exists({ slug: 'non-existent' })).toBe(false);
  });
});
