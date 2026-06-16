import { CATEGORY_LABELS, getCategoryLabel } from '../api/category-labels';

describe('getCategoryLabel', () => {
  it('한국어 라벨을 반환한다', () => {
    expect(getCategoryLabel('essay', 'ko')).toBe('에세이');
    expect(getCategoryLabel('articles', 'ko')).toBe('아티클');
    expect(getCategoryLabel('notes', 'ko')).toBe('노트');
  });

  it('영어 라벨을 반환한다', () => {
    expect(getCategoryLabel('essay', 'en')).toBe('Essay');
    expect(getCategoryLabel('articles', 'en')).toBe('Articles');
    expect(getCategoryLabel('notes', 'en')).toBe('Notes');
  });

  it('모든 카테고리가 ko/en 라벨을 갖는다', () => {
    for (const labels of Object.values(CATEGORY_LABELS)) {
      expect(labels.ko).toBeTruthy();
      expect(labels.en).toBeTruthy();
    }
  });
});
