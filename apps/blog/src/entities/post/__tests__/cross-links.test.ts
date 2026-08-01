import { getPostsLinkingTo, toPostHref } from '../api/cross-links';
import { getPosts, type PostMeta } from '../api/posts';

describe('toPostHref', () => {
  it('상세 경로를 만든다', () => {
    expect(toPostHref({ category: 'articles', slug: 'x' })).toBe('/blog/articles/x');
  });
});

describe('getPostsLinkingTo', () => {
  // 실제 콘텐츠로 검증한다. 이 관계의 값어치는 "저자가 이미 손으로 쓴 링크"에서
  // 나오는 것이라, mock으로 확인하면 정작 파싱이 어긋나도 초록이 된다.
  it('가든 노트를 인용한 글을 찾아낸다', () => {
    const citing = getPostsLinkingTo('ko', '/garden/keep-alive-timeout-ordering');

    expect(citing.map(post => post.slug)).toContain('silent-502-keepalive-race');
  });

  it('아무도 가리키지 않는 경로는 빈 배열이다', () => {
    expect(getPostsLinkingTo('ko', '/garden/nobody-links-here')).toEqual([]);
  });

  it('ko/en 양쪽에서 같은 관계가 성립한다', () => {
    for (const locale of ['ko', 'en'] as const) {
      expect(getPostsLinkingTo(locale, '/garden/browser-rendering-pipeline').map(p => p.slug)).toContain(
        'css-animation-performance'
      );
    }
  });
});

describe('outgoingHrefs', () => {
  it('본문의 가든 링크가 정규화된 경로로 실린다', () => {
    const post = getPosts('ko').find(candidate => candidate.slug === 'css-animation-performance');

    // 본문은 파일 경로(`/ko/garden/resources/.../x.mdx`)로 적혀 있지만
    // 렌더된 href와 같은 평탄한 형태로 저장돼야 노트 쪽과 맞물린다.
    expect(post?.outgoingHrefs).toContain('/garden/browser-rendering-pipeline');
  });

  it('모든 글이 배열을 갖는다 (undefined 분기가 없다)', () => {
    const posts: PostMeta[] = getPosts('ko');

    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every(post => Array.isArray(post.outgoingHrefs))).toBe(true);
  });
});
