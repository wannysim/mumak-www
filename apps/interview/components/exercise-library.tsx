import { ArrowUpRight, Bookmark, CheckCircle2, Code2, Search } from 'lucide-react';
import { useState } from 'react';

import { EmptyState, SectionTitle } from '@/components/ui';
import { codeProblems, questions } from '@/lib/curriculum';
import { filters, filterExercises, type LibraryFilter } from '@/lib/exercise-filters';
import { categories, difficulties } from '@/lib/problems/types';
import { understoodIds, type Progress } from '@/lib/progress';

export function ExerciseLibrary({
  progress,
  initialFilter,
  onQuestion,
  onCode,
}: {
  progress: Progress;
  initialFilter: LibraryFilter;
  onQuestion: (id: string) => void;
  onCode: (id: string) => void;
}) {
  const [selection, setSelection] = useState({ filter: initialFilter, category: '전체', difficulty: '전체' });
  const [search, setSearch] = useState('');
  const { filter, category, difficulty } = selection;
  const solved = understoodIds(progress);
  const { visibleQuestions, visibleCode } = filterExercises({ ...selection, search }, progress.review);
  function selectFilter(filter: LibraryFilter) {
    setSelection({ filter, category: '전체', difficulty: '전체' });
  }
  function selectCodeFacet(facet: 'category' | 'difficulty', value: string) {
    setSelection(current => ({
      ...current,
      filter: current.filter === '다시 보기' || current.filter === '기업 공개 자료' ? current.filter : '코드 작성',
      [facet]: value,
    }));
  }
  return (
    <>
      <SectionTitle eyebrow="개념과 코드 연습" title="오늘의 한 문제" />
      <p className="-mt-4 mb-7 text-sm leading-6 text-muted-foreground">
        코드 {codeProblems.length}문제 · 개념 {questions.length}문제. 기본부터 실전·심화까지, 설명과 구현을 함께
        연습해요.
      </p>
      <details className="mb-5 rounded-2xl border bg-card p-5">
        <summary className="cursor-pointer text-sm font-semibold">추천 순서 · 윈도우와 연결 리스트 집중 훈련</summary>
        <div className="mt-4 space-y-2 text-xs leading-6 text-muted-foreground">
          <p>
            기초가 낯설다면 장바구니의 합계 누적 → 이벤트의 Set·참조 보존부터 시작하세요. 합계는 지금까지 더한 값, Set은
            본 적 있는 값, Map은 값별 개수나 위치를 기억합니다.
          </p>
          <p>
            창은 연속한 [left, right] 구간이고 길이는 right − left + 1입니다. 고정 창은 들어온 값을 더하고 나간 값을
            뺍니다. 가변 창은 조건에 따라 왼쪽을 여러 번 움직입니다.
          </p>
          <p>
            최소 길이는 조건을 만족하는 동안 답을 기록하고 축소합니다. 최대 길이는 조건을 위반하는 동안 축소한 뒤 답을
            기록합니다. 각 문제의 예시 그림에서 한 칸씩 따라가 보세요.
          </p>
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {[
            { name: '기초 준비', ids: ['cart', 'events'] },
            {
              name: '슬라이딩 윈도우',
              ids: ['window-fixed', 'window-min-sum', 'window-unique', 'window-k-distinct', 'window-cover'],
            },
            {
              name: '링크드 리스트',
              ids: ['list-basic', 'list-reverse', 'list-cycle', 'list-deque', 'lru-cache', 'list-random'],
            },
          ].map(path => (
            <div key={path.name}>
              <h2 className="text-sm font-bold">{path.name}</h2>
              <ol className="mt-2 space-y-1">
                {path.ids.map((id, index) => (
                  <li key={id}>
                    <button
                      className="min-h-11 text-left text-xs text-primary underline underline-offset-4"
                      aria-label={`${path.name} ${index + 1}단계 열기`}
                      onClick={() => onCode(id)}
                    >
                      {index + 1}. {codeProblems.find(p => p.id === id)!.title}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </details>
      <label className="mb-5 flex h-12 items-center gap-3 rounded-xl border border-input bg-card px-4 focus-within:focus-outline">
        <Search aria-hidden className="size-4 text-muted-foreground" />
        <input
          aria-label="문제 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="문제명 또는 회사명으로 검색"
          className="w-full bg-transparent text-base outline-none sm:text-sm"
        />
      </label>
      <div className="mb-7 flex flex-wrap gap-2" role="group" aria-label="문제 분류">
        {filters.map(item => (
          <button
            key={item}
            onClick={() => selectFilter(item)}
            aria-pressed={filter === item}
            className={`min-h-11 rounded-full border px-4 text-xs font-semibold ${filter === item ? 'border-foreground bg-foreground text-background' : 'bg-card text-muted-foreground hover:border-primary'}`}
          >
            {item}
          </button>
        ))}
      </div>
      {filter === '기업 공개 자료' && (
        <section aria-label="공식 프로젝트 과제" className="mb-5 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">프로젝트로 풀어보기</h2>
          <ul className="mt-2 space-y-2 text-sm text-primary">
            {' '}
            <li>
              <a
                className="underline"
                href="https://github.com/toss-fe-interview/frontend-fundamentals-mock-exam-1"
                target="_blank"
                rel="noreferrer"
              >
                토스 · Frontend Fundamentals 모의고사 1회 공식 저장소
              </a>
            </li>
            <li>
              <a
                className="underline"
                href="https://github.com/NAVER-CAMPUS-HACKDAY/common/issues/22"
                target="_blank"
                rel="noreferrer"
              >
                네이버 · CAMPUS HACKDAY 스포츠 생중계 대기열 과제
              </a>
            </li>
          </ul>
        </section>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold">
          코드 분야
          <select
            value={category}
            onChange={e => selectCodeFacet('category', e.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-input bg-card px-3 text-sm"
          >
            {['전체', ...categories].map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold">
          코드 난이도
          <select
            value={difficulty}
            onChange={e => selectCodeFacet('difficulty', e.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-input bg-card px-3 text-sm"
          >
            {['전체', ...difficulties].map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-4 text-xs text-muted-foreground" role="status">
        {visibleCode.length + visibleQuestions.length}개 표시
      </p>
      <div className="space-y-3">
        {visibleQuestions.map(q => (
          <button
            key={q.id}
            onClick={() => onQuestion(q.id)}
            className="flex w-full items-center gap-4 rounded-2xl border bg-card p-5 text-left hover:border-primary/40"
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full ${solved.has(q.id) ? 'bg-(--success) text-(color:--success-foreground)' : 'bg-secondary text-primary'}`}
            >
              {solved.has(q.id) ? (
                <CheckCircle2 className="size-5" aria-label="이해함" />
              ) : (
                <span className="text-xs font-bold">{String(questions.indexOf(q) + 1).padStart(2, '0')}</span>
              )}
            </span>
            <div className="flex-1">
              <p className="mb-1 text-[11px] text-muted-foreground">
                {q.topic} · {q.minutes}분
              </p>
              <h2 className="text-sm font-semibold sm:text-base">{q.title}</h2>
            </div>
            {progress.review.includes(q.id) && (
              <Bookmark className="size-4 shrink-0 text-primary" aria-label="다시 보기" />
            )}
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))}
        {visibleCode.map(p => (
          <button
            key={p.id}
            onClick={() => onCode(p.id)}
            className="flex w-full items-center gap-4 rounded-2xl border bg-card p-5 text-left hover:border-primary/40"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--warning) text-(color:--warning-foreground)">
              <Code2 className="size-5" aria-hidden />
            </span>
            <div className="flex-1">
              <p className="mb-1 text-[11px] text-muted-foreground">
                {p.category} · {p.difficulty} · {p.minutes}분{p.source && ` · ${p.source.label}`}
              </p>
              <h2 className="text-sm font-semibold sm:text-base">{p.title}</h2>
            </div>
            {progress.review.includes(p.id) && (
              <Bookmark className="size-4 shrink-0 text-primary" aria-label="다시 보기" />
            )}
            {solved.has(p.id) && (
              <CheckCircle2 className="size-4 text-(color:--success-foreground)" aria-label="통과함" />
            )}
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))}
      </div>
      {!visibleQuestions.length && !visibleCode.length && (
        <EmptyState
          title={filter === '다시 보기' ? '아직 다시 볼 문제가 없어요' : '맞는 문제를 찾지 못했어요'}
          text={
            filter === '다시 보기'
              ? '틀린 문제와 직접 저장한 문제가 여기에 모여요.'
              : '다른 검색어 또는 분류를 선택해 보세요.'
          }
          action="전체 문제 보기"
          onAction={() => {
            setSearch('');
            selectFilter('전체');
          }}
        />
      )}
      <details className="mt-8 rounded-xl border bg-card p-5 text-xs leading-6 text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-foreground">난이도 기준과 조사 근거</summary>
        <p className="mt-3">
          회사명으로 검색하면 공개 기출을 재구성한 문제와 교육·기술 자료를 응용한 문제를 찾을 수 있어요. 각 문제에서
          원문을 확인하세요. 실제 UI 프로젝트를 열어 연습할 수 있는 공개 과제도 있어요.
        </p>
        <p className="mt-3">
          기본: 한 자료구조와 경계값. 실전: 불변식·복잡도·상태 변화. 심화: 자료구조 조합과 요구사항 확장. 시간은 설명과
          테스트를 포함한 권장 연습 시간입니다.
        </p>
        <ul className="mt-3 list-disc pl-4">
          <li>
            <a
              className="underline"
              href="https://toss.im/career/job-detail?job_id=5311744003"
              target="_blank"
              rel="noreferrer"
            >
              토스플레이스 Frontend Developer: 라이브코딩·React·추상화
            </a>
          </li>
          <li>
            <a
              className="underline"
              href="https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing"
              target="_blank"
              rel="noreferrer"
            >
              Microsoft: 자료구조·복잡도·테스트와 설명
            </a>
          </li>
          <li>
            <a
              className="underline"
              href="https://amazon.jobs/content/en/how-we-hire/fee-interview-prep"
              target="_blank"
              rel="noreferrer"
            >
              Amazon FEE: 프론트엔드 코딩·경계값·설계
            </a>
          </li>
        </ul>
      </details>
    </>
  );
}
