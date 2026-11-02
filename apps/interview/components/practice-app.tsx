'use client';

import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  House,
  LockKeyhole,
  LogOut,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { CodePractice } from '@/components/code-practice';
import { ExerciseLibrary } from '@/components/exercise-library';
import { QuestionPractice } from '@/components/question-practice';
import { Records } from '@/components/records';
import { StoryNotes } from '@/components/story-notes';
import { Today } from '@/components/today';
import { Brand } from '@/components/ui';
import { codeProblems, questions } from '@/lib/curriculum';
import { understoodIds } from '@/lib/progress';
import { hasUnsavedProgress, resolveConflict, saveProgress, synchronize, useProgress } from '@/lib/progress-store';

type View = { tab: 'today' | 'library' | 'stories' | 'records'; question?: string; code?: string; filter?: string };
const tabs = [
  { id: 'today', title: '오늘', icon: House },
  { id: 'library', title: '문제', icon: BookOpen },
  { id: 'stories', title: '내 이야기', icon: MessageCircle },
  { id: 'records', title: '기록', icon: ChartNoAxesColumnIncreasing },
] as const;

export function PracticeApp() {
  const { progress, ready, error, blocked, unreadableLocal, status, conflict } = useProgress();
  const [view, updateView] = useState<View>({ tab: 'today' });
  const [minutes, setMinutes] = useState(5);
  const [logoutError, setLogoutError] = useState('');
  const main = useRef<HTMLElement>(null);
  function setView(value: View) {
    updateView(value);
    main.current?.focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const question = questions.find(q => q.id === view.question);
  const code = codeProblems.find(p => p.id === view.code);
  function openQuestion(id: string) {
    setView({ tab: 'library', question: id });
    saveProgress(p => (p.session ? { ...p, session: { ...p.session, questionId: id } } : p));
  }
  function start() {
    const solved = understoodIds(progress);
    const id =
      progress.session?.questionId ??
      questions.find(q => progress.review.includes(q.id))?.id ??
      questions.find(q => !solved.has(q.id))?.id ??
      questions[0]!.id;
    if (!progress.session)
      saveProgress(p => ({
        ...p,
        session: { minutes, remaining: minutes * 60, deadline: Date.now() + minutes * 60000, questionId: id },
      }));
    openQuestion(id);
  }
  async function logout() {
    if (
      hasUnsavedProgress() &&
      !window.confirm('서버에 아직 저장되지 않은 초안이 있어요. 이 기기에 초안을 남기고 로그아웃할까요?')
    )
      return;
    try {
      const response = await fetch('/api/session', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      window.location.reload();
    } catch {
      setLogoutError('로그아웃하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    }
  }
  const navigation = (mobile: boolean) => (
    <nav aria-label={mobile ? '모바일 주요 메뉴' : '주요 메뉴'} className={mobile ? 'grid grid-cols-4' : 'space-y-2'}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          aria-current={view.tab === tab.id ? 'page' : undefined}
          onClick={() => setView({ tab: tab.id })}
          className={`${mobile ? 'flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]' : 'flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-sm'} font-semibold transition-colors ${view.tab === tab.id ? (mobile ? 'text-primary' : 'bg-[#e6edfc] text-primary') : 'text-muted-foreground hover:text-foreground'}`}
        >
          <tab.icon className={mobile ? 'size-5' : 'size-[18px]'} aria-hidden />
          {tab.title}
          {!mobile && view.tab === tab.id && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
        </button>
      ))}
    </nav>
  );
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-white p-3 focus:not-sr-only">
        본문으로 이동
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r bg-[#f9fbfe] px-6 py-9 lg:flex">
        <Brand />
        <div className="mt-12">{navigation(false)}</div>
        <div className="mt-auto">
          <div className="mb-6 rounded-2xl border bg-white p-4">
            <span className="text-xs font-medium text-primary">다음 기회를 향해</span>
            <p className="mt-2 text-sm font-bold">Frontend Engineer</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              코드로 풀고,
              <br />내 언어로 설명하기.
            </p>
            <ArrowUpRight className="mt-4 size-4 text-primary" aria-hidden />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="size-3.5" aria-hidden />
            나만의 비공개 연습실
          </div>
          <button
            onClick={logout}
            className="mt-4 flex min-h-11 items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" aria-hidden />
            로그아웃
          </button>
        </div>
      </aside>
      <header className="flex items-center justify-between border-b bg-[#f9fbfe] px-5 py-5 lg:hidden">
        <Brand />
        <button
          onClick={logout}
          aria-label="로그아웃"
          className="grid size-11 place-items-center rounded-full border bg-white"
        >
          <LogOut className="size-4 text-muted-foreground" />
        </button>
      </header>
      <div className="lg:ml-64">
        <div className="mx-auto max-w-5xl px-5 pt-7 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-9 lg:px-12 lg:py-10">
          <div className="mb-7 hidden items-center justify-between border-b pb-5 lg:flex">
            <p className="text-xs text-muted-foreground">
              나의 준비 <span className="mx-3 text-border">/</span> {tabs.find(t => t.id === view.tab)?.title}
            </p>
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden />
              모든 기기에서 이어서
            </span>
          </div>
          {(error || logoutError) && (
            <p
              role="alert"
              className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
            >
              {error || logoutError}
            </p>
          )}
          <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span aria-label="동기화 상태">
              {
                {
                  loading: '서버 기록 불러오는 중',
                  saved: '서버 저장 완료',
                  saving: '서버에 저장 중…',
                  offline: '연결 대기 · 기기 초안 보관',
                  conflict: '기록 선택 필요',
                }[status]
              }
            </span>
            <button
              className="min-h-11 text-primary underline"
              onClick={() => void synchronize()}
              disabled={status === 'saving' || !!conflict}
            >
              지금 동기화
            </button>
          </div>
          {conflict && (
            <section className="mb-6 rounded-2xl border bg-white p-5">
              <h2 className="font-bold">어떤 기록으로 이어갈까요?</h2>
              <p className="mt-2 text-sm leading-6">
                {unreadableLocal
                  ? '이 기기의 초안을 읽지 못해 서버 기록을 덮어쓸 수 없어요. 서버 기록으로 이어가 주세요.'
                  : '먼저 기록 탭에서 이 기기의 초안을 백업해 주세요. 서버 기록을 사용하면 이 기기의 초안이 교체됩니다.'}
              </p>
              <details className="my-4 text-xs">
                <summary className="cursor-pointer py-3">서버 기록 확인</summary>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(conflict.progress, null, 2)}
                </pre>
              </details>
              <div className="flex flex-wrap gap-3">
                {!unreadableLocal && (
                  <button className="min-h-11 text-primary underline" onClick={() => setView({ tab: 'records' })}>
                    이 기기 초안 백업
                  </button>
                )}
                <button
                  className="min-h-11 text-primary underline"
                  onClick={() => {
                    if (window.confirm('이 기기의 초안을 서버 기록으로 교체할까요? 필요한 초안은 먼저 백업해 주세요.'))
                      resolveConflict(false);
                  }}
                >
                  서버 기록 사용
                </button>
                {!unreadableLocal && (
                  <button
                    className="min-h-11 text-primary underline"
                    onClick={() => {
                      if (window.confirm('모든 기기에서 사용할 서버 기록을 이 기기의 초안으로 교체할까요?'))
                        resolveConflict(true);
                    }}
                  >
                    이 기기 기록으로 교체
                  </button>
                )}
              </div>
            </section>
          )}
          <main id="main" ref={main} tabIndex={-1} className="outline-none">
            {!ready ? (
              <p role="status" className="py-20 text-center text-sm text-muted-foreground">
                나의 연습실을 준비하고 있어요…
              </p>
            ) : blocked && view.tab !== 'records' ? (
              <div className="py-10">
                <p className="mb-4 text-sm">기존 기록을 확인한 뒤 연습을 이어가요.</p>
                <button className="min-h-11 text-primary underline" onClick={() => setView({ tab: 'records' })}>
                  기록 복원·초기화 열기
                </button>
              </div>
            ) : question ? (
              <QuestionPractice
                key={question.id}
                question={question}
                progress={progress}
                back={() => setView({ tab: 'library' })}
                next={() => openQuestion(questions[(questions.indexOf(question) + 1) % questions.length]!.id)}
              />
            ) : code ? (
              <CodePractice
                key={code.id}
                problem={code}
                progress={progress}
                back={() => setView({ tab: 'library', filter: '코드 작성' })}
              />
            ) : view.tab === 'today' ? (
              <Today
                progress={progress}
                minutes={minutes}
                setMinutes={setMinutes}
                start={start}
                openCode={id => setView(id ? { tab: 'library', code: id } : { tab: 'library', filter: '코드 작성' })}
                openStories={() => setView({ tab: 'stories' })}
                openReview={() => setView({ tab: 'library', filter: '다시 보기' })}
              />
            ) : view.tab === 'library' ? (
              <ExerciseLibrary
                key={view.filter ?? '전체'}
                progress={progress}
                initialFilter={view.filter ?? '전체'}
                onQuestion={openQuestion}
                onCode={id => setView({ tab: 'library', code: id })}
              />
            ) : view.tab === 'stories' ? (
              <StoryNotes progress={progress} />
            ) : (
              <Records progress={progress} start={start} />
            )}
          </main>
          {ready && (
            <footer className="mt-12 border-t pt-5 text-[11px] leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">오늘도 조금 더, 다음 정거장.</span>
              <br />
              로그인한 기기 사이에 기록 동기화 · 서버 저장 상태를 확인해 주세요.
            </footer>
          )}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-[#f9fbfe]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        {navigation(true)}
      </div>
    </div>
  );
}
