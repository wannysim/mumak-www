import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronRight,
  Code2,
  Footprints,
  Headphones,
  MessageCircle,
  Route,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@mumak/ui/components/button';

import { questions, resources } from '@/lib/curriculum';
import { localDateKey, resumableCodeProblems, understoodIds, type Progress } from '@/lib/progress';

export function Today({
  progress,
  minutes,
  setMinutes,
  start,
  openCode,
  openStories,
  openReview,
}: {
  progress: Progress;
  minutes: number;
  setMinutes: (minutes: number) => void;
  start: () => void;
  openCode: (id?: string) => void;
  openStories: () => void;
  openReview: () => void;
}) {
  const [todayKey] = useState(() => localDateKey(Date.now()));
  const solved = understoodIds(progress);
  const resumable = resumableCodeProblems(progress);
  const done = questions.filter(q => solved.has(q.id)).length;
  const today = progress.attempts.filter(a => localDateKey(a.at) === todayKey).length;
  return (
    <div>
      <section className="relative overflow-hidden rounded-[28px] bg-[#e6edfc] px-7 py-9 sm:p-10 lg:p-12">
        <div className="relative z-10 max-w-lg">
          <p className="mb-5 flex items-center gap-2 text-sm font-semibold text-primary">
            <Footprints className="size-4" aria-hidden />
            작은 연습, 다음 기회
          </p>
          <h1 className="text-[36px] leading-[1.2] font-bold tracking-[-0.045em] sm:text-5xl">
            이동 중에도,
            <br />한 문제만 더.
          </h1>
          <p className="mt-5 text-sm leading-7 text-[#526583] sm:text-base">
            완벽한 한 시간 대신, 오늘의 짧은 집중.
            <br />
            지금 갈 수 있는 만큼만 가봐요.
          </p>
          <div className="mt-8">
            <p className="mb-3 text-sm font-semibold" id="duration-label">
              오늘은 얼마나 이동하나요?
            </p>
            <div
              className="inline-flex rounded-xl border border-white/70 bg-white/55 p-1"
              role="group"
              aria-labelledby="duration-label"
            >
              {[5, 10, 15].map(n => (
                <button
                  key={n}
                  aria-pressed={minutes === n}
                  onClick={() => setMinutes(n)}
                  className={`min-h-11 min-w-18 rounded-lg px-5 text-sm font-semibold transition-colors ${minutes === n ? 'bg-white text-primary shadow-sm' : 'text-[#526583] hover:bg-white/60'}`}
                >
                  {n}분
                </button>
              ))}
            </div>
          </div>
          <Button onClick={start} className="mt-5 h-13 w-full rounded-xl px-6 text-base shadow-sm sm:w-auto">
            {progress.session ? '하던 연습 이어가기' : `${minutes}분 연습 출발`}
            <ArrowRight className="ml-5" aria-hidden />
          </Button>
          <p className="mt-3 text-xs text-[#526583]">
            {progress.session
              ? '시간을 바꾸려면 연습 화면에서 현재 연습을 마쳐 주세요.'
              : '코드 읽기부터 가볍게 · 중간에 멈춰도 괜찮아요'}
          </p>
        </div>
        <svg
          viewBox="0 0 280 320"
          className="pointer-events-none absolute -right-12 -bottom-18 hidden w-72 text-primary/20 sm:block xl:right-2 xl:bottom-3 xl:w-80"
          aria-hidden
        >
          <path
            d="M18 25h120a52 52 0 0 1 0 104H98a52 52 0 0 0 0 104h125"
            fill="none"
            stroke="currentColor"
            strokeWidth="22"
          />
          <path
            d="M18 25h120a52 52 0 0 1 0 104H98a52 52 0 0 0 0 104h125"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeDasharray="5 9"
          />
          <circle cx="35" cy="25" r="15" fill="#375beb" stroke="#e6edfc" strokeWidth="8" />
          <circle cx="98" cy="129" r="17" fill="#f3b760" stroke="#e6edfc" strokeWidth="8" />
          <circle cx="223" cy="233" r="17" fill="#172b4d" stroke="#e6edfc" strokeWidth="8" />
          <text x="35" y="65" fill="#526583" fontSize="12">
            출발
          </text>
          <text x="183" y="278" fill="#526583" fontSize="12">
            다음 정거장
          </text>
        </svg>
      </section>
      {resumable.length > 0 && (
        <section className="mt-7 rounded-2xl border bg-white p-5 sm:p-6" aria-labelledby="resume-code-title">
          <h2 id="resume-code-title" className="text-lg font-bold">
            코드·메모 이어가기
          </h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            저장된 코드와 화이트보드 메모를 바로 열어요. 다른 기기의 초안은 서버 저장이 끝난 뒤 표시돼요.
          </p>
          <ul className="mt-3 divide-y">
            {resumable.slice(0, 3).map(problem => (
              <li key={problem.id}>
                <button
                  onClick={() => openCode(problem.id)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left text-sm font-semibold hover:text-primary"
                >
                  <span>{problem.title}</span>
                  <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => openCode()} className="mt-2 min-h-11 text-xs font-semibold text-primary underline">
            전체 코드 문제 보기
          </button>
        </section>
      )}
      <div className="my-8 grid grid-cols-3 divide-x border-y py-5">
        <div className="px-2 sm:px-5">
          <p className="text-xs text-muted-foreground">오늘의 연습</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {today}
            <span className="ml-1 text-xs font-normal text-muted-foreground">회</span>
          </p>
        </div>
        <div className="px-4 sm:px-7">
          <p className="text-xs text-muted-foreground">이해한 개념</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {done}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/ {questions.length}</span>
          </p>
        </div>
        <button onClick={openReview} className="px-4 text-left sm:px-7">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            다시 볼 문제
            <ChevronRight className="size-3" aria-hidden />
          </p>
          <p className="mt-2 text-2xl font-bold text-primary tabular-nums">
            {progress.review.length}
            <span className="ml-1 text-xs font-normal text-muted-foreground">개</span>
          </p>
        </button>
      </div>
      <div className="mb-5 flex items-end justify-between">
        <h2 className="text-lg font-bold tracking-tight">지금, 나에게 맞는 연습</h2>
        <span className="text-xs text-muted-foreground">어디서든 한 걸음</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={start}
          className="group flex items-start gap-4 rounded-2xl border bg-white p-5 text-left transition-colors hover:border-primary/40"
        >
          <span className="rounded-xl bg-[#e8edff] p-3 text-primary">
            <Headphones aria-hidden className="size-5" />
          </span>
          <div className="flex-1">
            <span className="text-[11px] font-semibold text-primary">서서 가는 길 · 3–5분</span>
            <h3 className="mt-1 font-bold">읽고, 생각하고, 선택하기</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">입력 없이도 익히는 React와 JavaScript</p>
          </div>
          <ArrowUpRight aria-hidden className="size-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => openCode()}
          className="group flex items-start gap-4 rounded-2xl border bg-white p-5 text-left transition-colors hover:border-primary/40"
        >
          <span className="rounded-xl bg-[#fff2da] p-3 text-[#95601f]">
            <Code2 aria-hidden className="size-5" />
          </span>
          <div className="flex-1">
            <span className="text-[11px] font-semibold text-[#95601f]">짧게 설계 · 15–45분 구현</span>
            <h3 className="mt-1 font-bold">설명하며 푸는 라이브 코딩</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">윈도우·연결 리스트부터 비동기 상태 처리까지</p>
          </div>
          <ArrowUpRight aria-hidden className="size-4 text-muted-foreground" />
        </button>
      </div>
      <button
        onClick={openStories}
        className="mt-3 flex w-full items-center gap-4 rounded-2xl border bg-white p-5 text-left hover:border-primary/40"
      >
        <span className="rounded-xl bg-[#e7f1ec] p-3 text-[#386e54]">
          <MessageCircle aria-hidden className="size-5" />
        </span>
        <div className="flex-1">
          <h3 className="font-bold">내 경험을, 내 언어로</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            이력서의 한 줄을 면접에서 들려줄 이야기로 바꿔요.
          </p>
        </div>
        <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
      </button>
      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">이번 여정의 정거장</h2>
          <Route aria-hidden className="size-4 text-muted-foreground" />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {(['JavaScript', 'React', '설계·테스트'] as const).map((topic, i) => {
            const group = questions.filter(q => q.topic === topic);
            const count = group.filter(q => solved.has(q.id)).length;
            return (
              <div key={topic} className="border-t-2 pt-4">
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="grid size-5 place-items-center rounded-full bg-foreground text-[10px] text-white">
                    {count === group.length ? <Check className="size-3" /> : `0${i + 1}`}
                  </span>
                  {count} / {group.length} 이해함
                </div>
                <h3 className="font-semibold">{topic}</h3>
                <div className="mt-3 flex gap-1" aria-label={`${topic} ${group.length}개 중 ${count}개 완료`}>
                  {group.map(q => (
                    <span
                      key={q.id}
                      className={`h-1.5 flex-1 rounded-full ${solved.has(q.id) ? 'bg-primary' : 'bg-[#dce3ef]'}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Bookmark className="size-4" aria-hidden />
          곁에 두고 볼 자료
        </h2>
        {resources.map(resource => (
          <a
            key={resource.url}
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-16 items-center justify-between gap-3 border-b py-3 hover:text-primary"
          >
            <div>
              <p className="text-sm font-medium">{resource.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{resource.description}</p>
            </div>
            <ArrowUpRight className="size-4 shrink-0" aria-hidden />
          </a>
        ))}
      </section>
      <p className="mt-6 text-[11px] leading-5 text-muted-foreground">
        직접 만든 연습 문제입니다. 실제 채용 시험 문제나 합격을 보장하는 자료가 아니에요.
      </p>
    </div>
  );
}
