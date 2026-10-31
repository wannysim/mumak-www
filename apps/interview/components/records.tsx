import { Download, HardDrive, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@mumak/ui/components/button';

import { EmptyState, SectionTitle } from '@/components/ui';
import { codeProblems, questions } from '@/lib/curriculum';
import {
  emptyProgress,
  localDateKey,
  MAX_BACKUP_BYTES,
  parseProgress,
  remainingSeconds,
  type Progress,
} from '@/lib/progress';
import { saveProgress } from '@/lib/progress-store';

export function Records({ progress, start }: { progress: Progress; start: () => void }) {
  const [message, setMessage] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const [now] = useState(() => Date.now());
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - 6 + i);
    return date;
  });
  function download() {
    const blob = new Blob(
      [
        JSON.stringify({
          ...progress,
          session: progress.session
            ? { ...progress.session, remaining: remainingSeconds(progress.session, Date.now()), deadline: null }
            : null,
        }),
      ],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `next-stop-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('백업 다운로드를 요청했어요. 다운로드 목록에서 파일을 확인해 주세요.');
  }
  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    try {
      if (selected.size > MAX_BACKUP_BYTES) throw new Error('2MB 이하 백업만 가져올 수 있어요.');
      const imported = parseProgress(await selected.text());
      if (!window.confirm('서버와 모든 기기의 기록을 백업 파일의 내용으로 교체할까요?')) return;
      // A running timer is paused on import; its wall-clock deadline belongs to the old session.
      const saved = saveProgress(
        () => ({ ...imported, session: imported.session ? { ...imported.session, deadline: null } : null }),
        true
      );
      setMessage(
        saved
          ? '백업을 불러왔어요. 상단의 저장 상태도 확인해 주세요.'
          : '먼저 서버 연결과 기록 충돌을 해결해 주세요. 기존 기록은 유지됩니다.'
      );
    } catch {
      setMessage(
        '백업을 가져오지 못했어요. 다음 정거장에서 내려받은 2MB 이하의 기록 파일인지 확인해 주세요. 기존 기록은 유지됩니다.'
      );
    }
  }
  return (
    <>
      <SectionTitle eyebrow="하루의 작은 집중" title="쌓여가는 나의 기록" />
      <div className="mb-8 rounded-2xl border bg-white p-6">
        <h2 className="mb-6 text-sm font-semibold">최근 7일의 발걸음</h2>
        <div className="grid grid-cols-7 gap-2">
          {days.map(day => {
            const count = progress.attempts.filter(a => localDateKey(a.at) === localDateKey(day.getTime())).length;
            return (
              <div key={day.toISOString()} className="text-center">
                <span className="text-[11px] text-muted-foreground">
                  {['일', '월', '화', '수', '목', '금', '토'][day.getDay()]}
                </span>
                <span
                  className={`mx-auto my-2 grid aspect-square max-w-13 place-items-center rounded-xl text-sm font-semibold ${count ? 'bg-primary text-white' : 'bg-background text-muted-foreground'}`}
                >
                  {count}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {day.getMonth() + 1}.{day.getDate()}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          답 확인과 코드 실행 횟수예요. 최근 500회까지 서버에 보관합니다.
        </p>
      </div>
      <section className="mb-9">
        <h2 className="mb-4 text-lg font-bold">최근에 만난 문제</h2>
        {!progress.attempts.length ? (
          <EmptyState
            title="첫 발걸음을 기다리고 있어요"
            text="문제 하나를 풀면 이곳에 기록이 남아요. 짧게 시작해 봐요."
            action="첫 연습 시작"
            onAction={start}
          />
        ) : (
          <ol className="divide-y">
            {progress.attempts
              .slice(-8)
              .toReversed()
              .map((a, i) => (
                <li key={`${a.id}-${a.at}-${i}`} className="flex items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-sm font-medium">
                      {[...questions, ...codeProblems].find(p => p.id === a.id)?.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(a.at).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${a.correct ? 'bg-[#e7f1ec] text-[#386e54]' : 'bg-[#fff2da] text-[#95601f]'}`}
                  >
                    {a.correct ? '이해함' : '한 번 더'}
                  </span>
                </li>
              ))}
          </ol>
        )}
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <HardDrive className="mb-4 size-5 text-primary" aria-hidden />
        <h2 className="font-bold">어느 기기에서든 이어서</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          같은 접속 키로 로그인하면 풀이·코드 초안·경력 메모가 이어져요. 오프라인 초안은 이 브라우저에 보관하고, 서버
          저장이 끝나면 다른 기기에서도 확인할 수 있어요. 중요한 기록은 별도 백업도 챙겨 주세요.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" onClick={download} className="h-11">
            <Download aria-hidden />
            백업 내려받기
          </Button>
          <Button variant="outline" onClick={() => file.current?.click()} className="h-11">
            <Upload aria-hidden />
            백업 가져오기
          </Button>
          <input
            ref={file}
            aria-label="기록 백업 파일"
            type="file"
            accept=".txt,.json"
            onChange={importFile}
            className="sr-only"
            tabIndex={-1}
          />
        </div>
        {message && (
          <p role="status" className="mt-4 text-sm leading-6 text-primary">
            {message}
          </p>
        )}
        <div className="mt-6 border-t pt-4">
          <button
            onClick={() => {
              if (
                window.confirm(
                  '서버와 모든 기기의 풀이 기록, 코드 초안, 경력 메모를 삭제할까요? 복구하려면 미리 백업이 필요합니다.'
                )
              ) {
                const saved = saveProgress(() => emptyProgress(), true);
                setMessage(
                  saved
                    ? '기록 초기화를 요청했어요. 서버 저장 상태를 확인해 주세요.'
                    : '먼저 서버 연결과 기록 충돌을 해결해 주세요.'
                );
              }
            }}
            className="min-h-11 text-xs text-red-700 underline underline-offset-4"
          >
            전체 기록 초기화
          </button>
        </div>
      </section>
    </>
  );
}
