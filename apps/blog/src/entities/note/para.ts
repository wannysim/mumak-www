// PARA 카테고리 단일 소스. fs 의존이 없는 순수 모듈이라 server/client 양쪽에서 안전하게 import할 수 있다.
// label은 사이드바(`garden/layout.tsx`)와 동일하게 PARA 용어를 영어로 유지한다 (AGENTS.md의 i18n 정책).

export const PARA_CATEGORY_KEYS = ['projects', 'areas', 'resources', 'archives'] as const;

export type ParaCategoryKey = (typeof PARA_CATEGORY_KEYS)[number];

export const PARA_LABELS: Record<ParaCategoryKey, string> = {
  projects: 'Projects',
  areas: 'Areas',
  resources: 'Resources',
  archives: 'Archives',
};

export function isValidParaCategory(key: string): key is ParaCategoryKey {
  return (PARA_CATEGORY_KEYS as readonly string[]).includes(key);
}
