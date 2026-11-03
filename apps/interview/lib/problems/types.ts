export const categories = [
  '배열·해시',
  '슬라이딩 윈도우',
  '링크드 리스트',
  '스택·큐',
  '탐색·정렬',
  '트리·그래프',
  '힙',
  'DP·백트래킹',
  '프론트엔드·비동기',
] as const;
export const difficulties = ['기본', '실전', '심화'] as const;
export type CodeTest = {
  label: string;
  args: unknown[];
  expected: unknown;
  queue?: boolean;
  mode?: 'events' | 'list' | 'reverse' | 'cycle' | 'copy-random' | 'deque';
};
export type CodeProblem = {
  id: string;
  title: string;
  category: (typeof categories)[number];
  difficulty: (typeof difficulties)[number];
  minutes: number;
  description: string;
  contract: string;
  starter: string;
  hint: string;
  solution: string;
  complexity: string;
  steps: string[];
  followups: string[];
  diagram?: string;
  tests: CodeTest[];
};
