'use client';

import * as React from 'react';

import { EMPTY_SEARCH_INDEX, getSearchIndexPath, type SearchIndex } from '@/src/shared/lib/search';

// locale별로 한 번만 fetch하고 모듈 레벨에서 메모이즈한다. 같은 세션에서 검색창을 여러 번
// 열거나 페이지를 이동해도 정적 JSON을 다시 받지 않는다.
const cache = new Map<string, Promise<SearchIndex>>();

function loadSearchIndex(locale: string): Promise<SearchIndex> {
  const cached = cache.get(locale);
  if (cached) {
    return cached;
  }

  const promise = fetch(getSearchIndexPath(locale))
    .then(response => {
      if (!response.ok) {
        throw new Error(`search-index ${response.status}`);
      }
      return response.json() as Promise<SearchIndex>;
    })
    .catch(error => {
      // 실패한 promise를 캐시에 남기지 않아 다음에 검색을 열 때 재시도할 수 있게 한다.
      cache.delete(locale);
      throw error;
    });

  cache.set(locale, promise);
  return promise;
}

// enabled가 true가 되는 순간(검색창 open)에만 fetch를 트리거한다. 실패 시 빈 인덱스로 떨어져
// 팔레트가 "결과 없음" 상태로 graceful degrade한다. locale은 호출부에서 주입한다 — 이 hook이
// next-intl을 직접 import하지 않게 해서 shared/hooks 배럴이 next-intl ESM을 끌고 오지 않도록 한다.
export function useSearchIndex(locale: string, enabled: boolean): SearchIndex | null {
  const [index, setIndex] = React.useState<SearchIndex | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    loadSearchIndex(locale)
      .then(data => {
        if (active) setIndex(data);
      })
      .catch(() => {
        if (active) setIndex(EMPTY_SEARCH_INDEX);
      });

    return () => {
      active = false;
    };
  }, [enabled, locale]);

  return index;
}
