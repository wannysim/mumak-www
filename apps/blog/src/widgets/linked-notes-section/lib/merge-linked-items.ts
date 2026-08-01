import type { LinkDirection } from '@/src/entities/note';

/**
 * 목록 한 줄.
 *
 * 항목이 자기 href를 들고 오기 때문에 가든 노트와 블로그 글을 한 목록에 섞을 수 있다.
 * 위키링크는 가든 안에서만 통하는 주소라, 노트와 글을 잇는 링크는 경로로만 표현된다.
 */
export interface LinkedItem {
  href: string;
  title: string;
  direction: LinkDirection;
}

type LinkTarget = Omit<LinkedItem, 'direction'>;

/**
 * 나가는 링크와 들어오는 링크를 하나의 목록으로 합치고 방향을 정한다.
 *
 * 두 상세 페이지가 같은 함수를 쓰지 않으면 같은 상호 참조 쌍이 한쪽에서는 "서로 참조",
 * 다른 쪽에서는 "이 노트를 참조"로 갈린다.
 *
 * 렌더 컴포넌트(ui/)가 'use client'라 여기 둔다 — 서버 컴포넌트인 두 상세 페이지가
 * 클라이언트 모듈의 함수를 호출하면 빌드가 깨진다.
 */
export function mergeLinkedItems(outgoing: LinkTarget[], incoming: LinkTarget[]): LinkedItem[] {
  const outgoingHrefs = new Set(outgoing.map(item => item.href));
  const incomingHrefs = new Set(incoming.map(item => item.href));

  return [
    ...outgoing.map(item => ({
      ...item,
      direction: incomingHrefs.has(item.href) ? ('bidirectional' as const) : ('outgoing' as const),
    })),
    ...incoming
      .filter(item => !outgoingHrefs.has(item.href))
      .map(item => ({ ...item, direction: 'incoming' as const })),
  ];
}
