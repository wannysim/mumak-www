import { extractWikilinkSlugs, hasWikilinks, parseWikilinkTarget, parseWikilinks } from '../parser';

describe('parseWikilinks', () => {
  it('기본 위키링크 [[slug]]를 파싱한다', () => {
    const content = '이것은 [[test-note]] 입니다.';
    const result = parseWikilinks(content);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      slug: 'test-note',
      heading: undefined,
      blockId: undefined,
      isInternal: false,
      target: 'test-note',
      label: 'test-note',
      raw: '[[test-note]]',
      isEmbed: false,
    });
  });

  it('레이블이 있는 위키링크 [[slug|label]]를 파싱한다', () => {
    const content = '자세한 내용은 [[ai-survival|AI 시대 생존법]]을 참고하세요.';
    const result = parseWikilinks(content);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      slug: 'ai-survival',
      heading: undefined,
      blockId: undefined,
      isInternal: false,
      target: 'ai-survival',
      label: 'AI 시대 생존법',
      raw: '[[ai-survival|AI 시대 생존법]]',
      isEmbed: false,
    });
  });

  it('여러 위키링크를 파싱한다', () => {
    const content = '[[first-note]]와 [[second-note|두번째]]가 있습니다.';
    const result = parseWikilinks(content);

    expect(result).toHaveLength(2);
    expect(result[0]?.slug).toBe('first-note');
    expect(result[1]?.slug).toBe('second-note');
    expect(result[1]?.label).toBe('두번째');
  });

  it('공백이 있는 slug를 trim한다', () => {
    const content = '[[ spaced-slug ]]와 [[ another | 레이블 ]]';
    const result = parseWikilinks(content);

    expect(result[0]?.slug).toBe('spaced-slug');
    expect(result[1]?.slug).toBe('another');
    expect(result[1]?.label).toBe('레이블');
  });

  it('헤딩/블록/임베드 링크를 파싱한다', () => {
    const content = '![[note-a#Section 1]] [[note-b^block-id]] [[#local heading]] [[^local-block]]';
    const result = parseWikilinks(content);

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      slug: 'note-a',
      heading: 'Section 1',
      blockId: undefined,
      isEmbed: true,
    });
    expect(result[1]).toMatchObject({
      slug: 'note-b',
      heading: undefined,
      blockId: 'block-id',
      isEmbed: false,
    });
    expect(result[2]).toMatchObject({
      slug: '',
      heading: 'local heading',
      isInternal: true,
    });
    expect(result[3]).toMatchObject({
      slug: '',
      blockId: 'local-block',
      isInternal: true,
    });
  });

  it('위키링크가 없으면 빈 배열을 반환한다', () => {
    const content = '일반 텍스트입니다.';
    const result = parseWikilinks(content);

    expect(result).toEqual([]);
  });
});

describe('parseWikilinkTarget', () => {
  it('note#heading을 분해한다', () => {
    expect(parseWikilinkTarget('note#heading')).toEqual({
      slug: 'note',
      heading: 'heading',
      blockId: undefined,
      isInternal: false,
      target: 'note#heading',
    });
  });

  it('note^block을 분해한다', () => {
    expect(parseWikilinkTarget('note^block')).toEqual({
      slug: 'note',
      heading: undefined,
      blockId: 'block',
      isInternal: false,
      target: 'note^block',
    });
  });
});

describe('extractWikilinkSlugs', () => {
  it('중복 없이 slug 목록을 반환한다', () => {
    const content = '[[note-a]]와 [[note-b]]와 또 [[note-a|다른 레이블]]';
    const result = extractWikilinkSlugs(content);

    expect(result).toEqual(['note-a', 'note-b']);
  });
});

describe('hasWikilinks', () => {
  it('위키링크가 있으면 true를 반환한다', () => {
    expect(hasWikilinks('[[test]]')).toBe(true);
  });

  it('위키링크가 없으면 false를 반환한다', () => {
    expect(hasWikilinks('일반 텍스트')).toBe(false);
  });
});

describe('regex lastIndex 상태 관리', () => {
  it('hasWikilinks 후 extractWikilinkSlugs 호출 시 모든 링크를 찾는다', () => {
    const content = '[[note-a]] and [[note-b]]';

    hasWikilinks(content);
    const slugs = extractWikilinkSlugs(content);

    expect(slugs).toEqual(['note-a', 'note-b']);
  });

  it('연속 호출 시에도 모든 링크를 찾는다', () => {
    const content = '[[first]] and [[second]] and [[third]]';

    parseWikilinks(content);
    parseWikilinks(content);
    const result = parseWikilinks(content);

    expect(result).toHaveLength(3);
    expect(result.map(r => r.slug)).toEqual(['first', 'second', 'third']);
  });
});
