import {
  createGardenResolver,
  transformWikilinks,
  transformWikilinksToMarkdown,
  type LinkResolver,
} from '../transformer';

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

  // 번역 파일에 결합하지 않도록 테스트 로컬 문구를 쓴다.
  const brokenNotice = { link: 'MISSING', embed: (slug: string) => `MISSING_EMBED:${slug}` };

  const transform = (content: string, currentSlug = 'current-note') =>
    transformWikilinks(content, { resolver: mockResolver, currentSlug, brokenNotice });

  it('alias가 없는 링크는 대상 노트의 제목을 표시 텍스트로 쓴다', () => {
    const content = '이것은 [[existing-note]] 입니다.';

    expect(transform(content)).toBe(
      '이것은 <WikiLink href="/ko/garden/existing-note" slug="existing-note">Title existing-note</WikiLink> 입니다.'
    );
  });

  it('레이블이 있는 링크는 레이블이 제목보다 우선한다', () => {
    const content = '참고: [[existing-note|기존 노트]]';

    expect(transform(content)).toBe(
      '참고: <WikiLink href="/ko/garden/existing-note" slug="existing-note">기존 노트</WikiLink>'
    );
  });

  it('헤딩 앵커 링크는 제목 뒤에 섹션을 덧붙여 목적지를 구분한다', () => {
    const result = transform('헤딩 링크: [[existing-note#valid-heading]]');

    expect(result).toContain('href="/ko/garden/existing-note#valid-heading"');
    expect(result).toContain('>Title existing-note § valid-heading<');
  });

  it('같은 노트의 다른 섹션을 가리키는 두 링크는 링크 텍스트가 서로 다르다 (WCAG 2.4.4)', () => {
    const headingResolver: LinkResolver = { ...mockResolver, exists: ({ slug }) => slug === 'existing-note' };
    const result = transformWikilinks('[[existing-note#alpha]] / [[existing-note#beta]]', {
      resolver: headingResolver,
      currentSlug: 'current-note',
      brokenNotice,
    });

    expect(result).toContain('>Title existing-note § alpha<');
    expect(result).toContain('>Title existing-note § beta<');
  });

  it('블록 앵커는 사람이 읽을 문구가 아니라 제목만 남긴다', () => {
    const result = transform('블록 링크: [[existing-note#^valid-block]]');

    expect(result).toContain('>Title existing-note<');
    expect(result).not.toContain('§');
  });

  it('문서 내부 앵커 [[#heading]]는 현재 노트 제목으로 바꾸지 않는다', () => {
    const result = transform('내부 링크: [[#valid-heading]]', 'existing-note');

    expect(result).toContain('href="/ko/garden/existing-note#valid-heading"');
    expect(result).toContain('>#valid-heading<');
  });

  it('제목의 중괄호를 escape해 MDX expression으로 파싱되지 않게 한다', () => {
    const bracedResolver: LinkResolver = {
      ...mockResolver,
      getEmbedPreview: () => ({ title: '{x}', excerpt: 'excerpt' }),
    };
    const result = transformWikilinks('[[existing-note]]', {
      resolver: bracedResolver,
      currentSlug: 'current-note',
      brokenNotice,
    });

    expect(result).toContain('&#123;x&#125;');
    expect(result).not.toContain('{');
  });

  it('존재하지 않는 노트는 BrokenWikiLink로 변환하고 slug를 그대로 남긴다', () => {
    const content = '없는 노트: [[non-existent]]';

    expect(transform(content)).toBe(
      '없는 노트: <BrokenWikiLink slug="non-existent" notice="MISSING">non-existent</BrokenWikiLink>'
    );
  });

  it('여러 링크를 동시에 변환한다', () => {
    const result = transform('[[existing-note]]와 [[non-existent]]');

    expect(result).toContain('<WikiLink');
    expect(result).toContain('<BrokenWikiLink');
  });

  it('slug의 특수문자를 escape하여 attribute injection을 방지한다', () => {
    const result = transform('[[test" onclick="alert(1)]]');

    // " 문자가 &quot;로 escape되어 attribute를 닫을 수 없음
    expect(result).toContain('&quot;');
    expect(result).toContain('slug="test&quot;');
  });

  it('label의 특수문자를 escape하여 HTML injection을 방지한다', () => {
    const result = transform('[[existing-note|<script>alert(1)</script>]]');

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
    const result = transformWikilinks('[[test]]', {
      resolver: maliciousResolver,
      currentSlug: 'current-note',
      brokenNotice,
    });

    // " > < 문자가 escape되어 attribute를 닫거나 새 태그를 열 수 없음
    expect(result).toContain('&quot;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&lt;');
  });

  it('임베드 문법은 WikiEmbed 컴포넌트로 변환한다', () => {
    const result = transform('![[existing-note]]');

    expect(result).toContain('<WikiEmbed');
    expect(result).toContain('title="Title existing-note"');
  });

  it('유효하지 않은 임베드는 notice를 실은 BrokenWikiEmbed로 변환한다', () => {
    const result = transform('![[existing-note#missing-heading]]');

    expect(result).toBe(
      '<BrokenWikiEmbed slug="existing-note#missing-heading" notice="MISSING_EMBED:existing-note#missing-heading" />'
    );
  });
});

describe('transformWikilinksToMarkdown', () => {
  const hrefFor = ({ slug, heading }: { slug: string; heading?: string }) =>
    `https://example.com/garden/${slug}${heading ? `#${heading}` : ''}`;

  it('converts a bare wikilink to a markdown link using the target as label', () => {
    const result = transformWikilinksToMarkdown('See [[note-a]] here', { hrefFor });

    expect(result).toBe('See [note-a](https://example.com/garden/note-a) here');
  });

  it('uses the target note title when a titleFor lookup is supplied', () => {
    const result = transformWikilinksToMarkdown('See [[note-a]] here', {
      hrefFor,
      titleFor: ({ slug }) => `Title ${slug}`,
    });

    expect(result).toBe('See [Title note-a](https://example.com/garden/note-a) here');
  });

  it('uses the explicit label when provided', () => {
    const result = transformWikilinksToMarkdown('See [[note-a|Note A]]', {
      hrefFor,
      titleFor: ({ slug }) => `Title ${slug}`,
    });

    expect(result).toBe('See [Note A](https://example.com/garden/note-a)');
  });

  it('falls back to the target when the title lookup misses', () => {
    const result = transformWikilinksToMarkdown('[[note-a#section]]', { hrefFor, titleFor: () => null });

    expect(result).toBe('[note-a#section](https://example.com/garden/note-a#section)');
  });

  it('leaves content without wikilinks untouched', () => {
    const content = 'plain text with [a link](https://x.com)';

    expect(transformWikilinksToMarkdown(content, { hrefFor })).toBe(content);
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

  it('존재하지 않는 노트에는 embed preview를 주지 않는다 — 깨진 링크가 제목으로 위장하지 않게', () => {
    const resolver = createGardenResolver({
      existingSlugs: new Set(['note-a']),
      hasHeadingAnchor: () => false,
      hasBlockAnchor: () => false,
      getEmbedPreview: input => ({ title: `Title ${input.slug}`, excerpt: 'preview' }),
    });

    expect(resolver.getEmbedPreview({ slug: 'note-a' })?.title).toBe('Title note-a');
    expect(resolver.getEmbedPreview({ slug: 'non-existent' })).toBeNull();
  });
});
