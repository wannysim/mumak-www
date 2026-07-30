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

export interface SearchIndexNote {
  title: string;
  excerpt: string;
  slug: string;
  tags: string[];
}

// 노트가 인덱스에 함께 실리는 이유: 전역 검색은 헤더에 마운트되어 모든 페이지에서 열리므로,
// 가든 레이아웃만 가지고 있는 노트 트리 payload에 의존할 수 없다. 두 섹션을 한 정적 JSON에
// 합쳐야 헤더에서 한 번의 lazy fetch로 사이트 전체를 검색할 수 있다.
export interface SearchIndex {
  posts: SearchIndexPost[];
  notes: SearchIndexNote[];
}

export const EMPTY_SEARCH_INDEX: SearchIndex = { posts: [], notes: [] };

// localePrefix: 'always' 라우팅과 동일하게 항상 locale 프리픽스를 붙인다.
export function getSearchIndexPath(locale: string): string {
  return `/${locale}/search-index.json`;
}
