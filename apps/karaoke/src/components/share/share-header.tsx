import { ArrowLeft, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import { DrawerClose, DrawerDescription, DrawerTitle } from '@mumak/ui/components/drawer';

export function ShareHeader({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack?: () => void;
}) {
  const firstControlRef = React.useRef<HTMLButtonElement>(null);

  /**
   * 뷰가 통째로 교체되므로 focus를 첫 컨트롤로 옮겨 준다. 컨테이너가 아니라 컨트롤에 두는 이유는
   * 다이얼로그 컨테이너는 `tabindex="-1"`이라 스크린리더 사용자가 Tab을 한 번 더 눌러야 하기 때문이다.
   *
   * 한 번 `focus()`하는 것으로는 부족하다. 이전 뷰에서 focus를 갖고 있던 요소가 DOM에서 사라지면
   * focus가 body로 떨어지고, vaul/radix의 focus scope가 그것을 감지해 컨테이너로 되돌린다.
   * 그 되돌림이 이 effect보다 늦게 오면 우리 focus가 덮인다 — 어느 쪽이 늦는지는 뷰 전환을 트리거한
   * 비동기 작업의 타이밍에 달려 있어 간헐적이었다(CI에서 재현, 로컬 90회에서는 안 잡혔다).
   *
   * 그래서 순서를 이기려 하지 않고 경합 자체를 없앤다. 컨테이너가 focus를 받는 유일한 경로는
   * 프로그램적 focus(`tabindex="-1"`)이므로, 컨테이너에 focus가 들어오면 항상 첫 컨트롤로 넘긴다.
   * effect와 focus scope의 실행 순서와 무관하게 결과가 같다.
   */
  React.useEffect(() => {
    const control = firstControlRef.current;
    const dialog = control?.closest<HTMLElement>('[role="dialog"]');
    if (!control || !dialog) return;
    control.focus();
    const bounceToControl = (event: FocusEvent) => {
      // 대상이 컨트롤일 때는 아무것도 하지 않으므로 focus 루프가 생기지 않는다.
      if (event.target === dialog) control.focus();
    };
    dialog.addEventListener('focusin', bounceToControl);
    return () => dialog.removeEventListener('focusin', bounceToControl);
  }, [title]);

  return (
    <header className="border-border grid min-h-16 shrink-0 grid-cols-[3rem_1fr_3rem] items-center border-b px-1">
      {onBack ? (
        <Button
          ref={firstControlRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="이전 화면"
          onClick={onBack}
          className="size-12"
        >
          <ArrowLeft className="size-4 stroke-[1.5]" />
        </Button>
      ) : (
        <DrawerClose asChild>
          <Button
            ref={firstControlRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label="공유 닫기"
            className="size-12"
          >
            <X className="size-4 stroke-[1.5]" />
          </Button>
        </DrawerClose>
      )}
      <div className="min-w-0 text-center">
        <DrawerTitle className="truncate">{title}</DrawerTitle>
        <DrawerDescription className="truncate text-xs">{description}</DrawerDescription>
      </div>
      <span aria-hidden="true" />
    </header>
  );
}
