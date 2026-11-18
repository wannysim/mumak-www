import { resolveConflict, synchronize, type ProgressSnapshot } from '@/lib/progress-store';

export function ProgressSyncPanel({
  snapshot: { ready, status, conflict, unreadableLocal },
  openRecords,
}: {
  snapshot: ProgressSnapshot;
  openRecords: () => void;
}) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span aria-label="동기화 상태">
          {
            {
              loading: '서버 기록 불러오는 중',
              saved: '서버 저장 완료',
              saving: '서버에 저장 중…',
              offline: ready ? '연결 대기 · 기기 초안 보관' : '기록 불러오기 실패',
              conflict: '기록 선택 필요',
            }[status]
          }
        </span>
        <button
          className="min-h-11 text-primary underline"
          onClick={() => void synchronize()}
          disabled={status === 'saving' || !!conflict}
        >
          {status === 'offline' && !ready ? '기록 다시 불러오기' : '지금 동기화'}
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
              <button className="min-h-11 text-primary underline" onClick={openRecords}>
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
    </>
  );
}
