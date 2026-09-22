import { CircleCheck, OctagonX, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// shadcn이 권하는 토스트는 sonner인데, 이 앱에서는 쓸 수 없다. sonner는 자기 CSS를
// 런타임 <style> 태그로 주입하고 위치·높이를 인라인 style로 넘기는데, 이 앱의 CSP는
// style-src 'self'라 둘 다 차단된다. 실제로 붙여보니 토스트를 띄우지 않은 평범한 페이지
// 로드에서도 CSP 위반이 6건 찍혀 `paints the chart line under the production CSP`
// 회귀 테스트가 깨졌다. 그 가드레일을 무르는 대신 필요한 만큼만 직접 만든다.
//
// 동작 범위는 sonner와 같게 뒀다 — 하단 중앙, 자동 소멸, 수동 닫기, 스크린리더 알림.
// 다만 한 번에 하나만 띄운다. 이 앱에서 토스트를 내는 동작은 수동 새로고침 하나뿐이라
// 큐와 스택은 쓰지 않는 코드가 된다.

const TOAST_DURATION = 6000;

type ToastTone = 'success' | 'error';
type ToastInput = { tone: ToastTone; title: string; description?: string };
type ToastMessage = ToastInput & { id: number };

const ToastContext = createContext<(toast: ToastInput) => void>(() => undefined);

function useToast() {
  return useContext(ToastContext);
}

const TONE_ICON = {
  success: <CircleCheck className="size-4 shrink-0 text-[var(--positive)]" aria-hidden="true" />,
  error: <OctagonX className="size-4 shrink-0 text-destructive" aria-hidden="true" />,
} as const;

function ToastCard({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  return (
    <div
      // key로 remount시켜 같은 문구를 다시 띄워도 등장 애니메이션이 다시 돈다.
      // (prefers-reduced-motion은 index.css의 전역 규칙이 이미 막는다.)
      className="pointer-events-auto flex w-full items-start gap-3 border border-border bg-popover p-4 text-popover-foreground animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
    >
      {TONE_ICON[toast.tone]}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 font-mono text-xs leading-5 text-muted-foreground tabular-nums">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="알림 닫기"
        onClick={onDismiss}
        className="-m-1 shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const nextId = useRef(0);

  const show = useCallback((input: ToastInput) => {
    nextId.current += 1;
    setToast({ ...input, id: nextId.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), TOAST_DURATION);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const dismiss = useCallback(() => setToast(null), []);
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* 라이브 영역은 내용이 바뀌기 전에 이미 DOM에 있어야 스크린리더가 읽는다.
          토스트와 함께 영역을 끼워 넣으면 대부분의 리더가 읽지 않으므로 늘 띄워둔다.
          이 앱에는 차트 판독값·체결 요약 등 다른 role="status"가 있어서 이름을 준다. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 sm:pb-6">
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="알림"
          // empty:hidden을 걸면 안 된다. display:none이 된 라이브 영역은 접근성 트리에서
          // 빠져 스크린리더가 이후 내용 변화를 읽지 못한다. 비어 있어도 높이는 0이고
          // 부모가 pointer-events-none이라 화면을 막지도 않는다.
          className="w-full max-w-sm"
        >
          {toast && <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export { ToastProvider, useToast, TOAST_DURATION };
