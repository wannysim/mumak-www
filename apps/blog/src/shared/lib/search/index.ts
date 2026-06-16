// 검색 인덱스 단일 소스. fs 의존이 없는 순수 타입/경로 모듈이라 server(route handler)와
// client(SearchPalette lazy fetch) 양쪽에서 안전하게 import할 수 있다.
//
// 배경(C-3): 리스트/카테고리 페이지가 전체 포스트의 검색 필드를 RSC payload에 직렬화하던 것을
// 단일 정적 `/{locale}/search-index.json`으로 빼고, 검색창을 열 때만 lazy fetch한다.
// 페이지는 그대로 SSG로 두되 초기 payload에서 검색 데이터셋을 제거한다.

export interface SearchIndexPost {
  title: string;
  description: string;
  category: string;
  slug: string;
  tags: string[];
}

export interface SearchIndex {
  posts: SearchIndexPost[];
}

// localePrefix: 'always' 라우팅과 동일하게 항상 locale 프리픽스를 붙인다.
export function getSearchIndexPath(locale: string): string {
  return `/${locale}/search-index.json`;
}
