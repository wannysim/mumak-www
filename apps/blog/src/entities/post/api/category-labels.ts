import type { Locale } from '@/src/shared/config/i18n';

import type { Category } from './posts';

// 카테고리 표시 라벨의 단일 소스. 포스트 페이지(breadcrumb)와 OG 이미지가 공유한다.
// 페이지별 인라인 staticTranslations에 흩어져 drift하지 않도록 여기로 모은다.
export const CATEGORY_LABELS: Record<Category, Record<Locale, string>> = {
  essay: { ko: '에세이', en: 'Essay' },
  articles: { ko: '아티클', en: 'Articles' },
  notes: { ko: '단상', en: 'Thoughts' },
};

export function getCategoryLabel(category: Category, locale: Locale): string {
  return CATEGORY_LABELS[category][locale];
}
