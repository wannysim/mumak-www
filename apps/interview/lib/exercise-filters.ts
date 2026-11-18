import { codeProblems, questions } from '@/lib/curriculum';

export const filters = [
  '전체',
  'JavaScript',
  'React',
  '설계·테스트',
  '코드 작성',
  '기업 공개 자료',
  '다시 보기',
] as const;
export type LibraryFilter = (typeof filters)[number];

export function filterExercises(
  {
    filter,
    category,
    difficulty,
    search,
  }: { filter: LibraryFilter; category: string; difficulty: string; search: string },
  review: readonly string[]
) {
  const query = search.toLowerCase();
  const visibleQuestions = questions.filter(
    q =>
      category === '전체' &&
      difficulty === '전체' &&
      (filter === '전체' || filter === q.topic || (filter === '다시 보기' && review.includes(q.id))) &&
      `${q.title} ${q.prompt}`.toLowerCase().includes(query)
  );
  const visibleCode = codeProblems.filter(
    p =>
      (category === '전체' || category === p.category) &&
      (difficulty === '전체' || difficulty === p.difficulty) &&
      (filter === '전체' ||
        filter === '코드 작성' ||
        (filter === '기업 공개 자료' && !!p.source) ||
        (filter === '다시 보기' && review.includes(p.id))) &&
      `${p.title} ${p.description} ${p.category} ${p.source?.label ?? ''}`.toLowerCase().includes(query)
  );
  return { visibleQuestions, visibleCode };
}
