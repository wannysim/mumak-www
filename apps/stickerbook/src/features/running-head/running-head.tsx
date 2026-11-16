import type * as React from 'react';

import { PERSON_NAME, RUNNING_HEAD_LINE, RUNNING_HEAD_STATUS, UI_TEXT } from '@/content/temporary';
import { joinClassNames } from '@/lib/class-names';
import type { RunningHeadParts } from '@/model/book/layout';

/** 이름 칸을 눌러 책을 덮는 동작. disabled면 누를 수 없는 순간(펼치는 중·덮는 중·끄는 중)이다. */
type NameAction = {
  readonly disabled: boolean;
  readonly onPress: () => void;
};

/**
 * 러닝 헤드: 책 바깥 위, 배경 없는 글자 한 줄(plan.md 나에 대한 정보, 확정). 문구는 임시(open-decisions G4).
 * 넓은 화면은 이름·한 줄 소개 / 주황 점 + 지금 상태 / 쪽 번호, 세로 휴대폰은 이름과 쪽 번호만 둔다(시안 still.css).
 * 어느 폭에서도 한 줄이다: 이름 줄과 상태 줄은 넘치면 말줄임하고, 상태 줄이 들어가지 않는 폭에서는 뺀다(layout.ts runningHeadParts).
 * 높이(py-4 위아래 + 줄 높이 1.4 = 3.4rem)는 책 윗변 여백의 하한과 맞물린다(geometry.ts RUNNING_HEAD_CLEARANCE_REM).
 * 쪽 번호는 live region이 아니다. 착지 알림은 상태 영역 하나가 맡는다(tech-research.md 7장 러닝 헤드 행).
 * 닫힌 책·여닫는 중에는 쪽 번호 자리를 비운다(잡지 표지에는 쪽 번호가 없다, 2026-11-16 사용자 결정).
 *
 * 이름 칸(2026-11-16 사용자 결정 A.2): 책이 펼쳐져 있으면 네이티브 button이고 누르면 앞표지로 덮는다. 보이는 모습은 글자 그대로이고
 * 포커스 표시만 더한다. 버튼은 글자 폭만큼만 차지한다(justify-self-start, 넘치면 칸 폭에서 말줄임). 칸 전체로 늘리면
 * 보이지 않는 빈 머리 공간을 눌러도 덮이고 포커스 표시가 칸 끝까지 그려진다.
 * 닫힌 책에서는 할 일이 없어 버튼이 아닌 글자다(탭 정지도 없다). 버튼 이름은 보이는 글자로 시작하고
 * 읽기용 문구를 뒤에 붙인다(WCAG 2.5.3 Label in Name).
 * 닫힌 책에서는 머리 전체가 포인터를 통과시켜 화면 전체가 회전 영역이 된다(결정 B.1). 조작 요소(button·a)는 늘 포인터를 받는다.
 *
 * 배치 값은 임시, open-decisions G4 "러닝 헤드 항목·문구"·G0 georgehatton 차용 후보:
 * 두 칸 50:50(grid-cols-2), 칸 사이 1rem, 가장자리 여백 1.5rem(550px 이하 1rem), 위아래 1rem, 상태 점 0.4em을 왼쪽 여백에 내어 건다.
 */
function RunningHead({
  parts,
  folio,
  folioReading,
  nameAction,
  className,
  ...props
}: React.ComponentProps<'header'> & {
  parts: RunningHeadParts;
  /** 보이는 쪽 표시. 예: "03–04/08". 닫힌 책·여닫는 중이면 null(그리지 않는다). */
  folio: string | null;
  /** 숫자 표기의 읽기용 문구. null이면 보이는 글자를 그대로 읽는다. */
  folioReading: string | null;
  /** 닫힌 책이면 null(이름은 글자). */
  nameAction: NameAction | null;
}) {
  const name = (
    <>
      {PERSON_NAME}
      {parts.line ? <span>, {RUNNING_HEAD_LINE}</span> : null}
    </>
  );
  return (
    <header
      className={joinClassNames(
        'fixed inset-x-0 top-0 z-20 grid grid-cols-2 gap-x-4 px-6 py-4 whitespace-nowrap max-[550px]:px-4 [&_a]:pointer-events-auto [&_button]:pointer-events-auto',
        nameAction === null ? 'pointer-events-none' : null,
        className
      )}
      {...props}
    >
      {nameAction === null ? (
        <p className="min-w-0 truncate">{name}</p>
      ) : (
        <button
          type="button"
          className="max-w-full min-w-0 justify-self-start text-left"
          aria-disabled={nameAction.disabled ? true : undefined}
          data-name-button
          onClick={() => {
            if (!nameAction.disabled) {
              nameAction.onPress();
            }
          }}
        >
          <span className="block truncate">{name}</span>
          <span className="sr-only">, {UI_TEXT.closeByName}</span>
        </button>
      )}
      <div className="flex min-w-0 justify-between gap-4">
        {parts.status ? (
          <p
            className="-ml-[1em] min-w-0 truncate before:mr-[0.6em] before:inline-block before:size-[0.4em] before:rounded-full before:bg-primary before:align-[0.15em] before:content-['']"
            data-status
          >
            {RUNNING_HEAD_STATUS}
          </p>
        ) : null}
        {folio === null ? null : (
          <p className="ml-auto tabular-nums" data-folio>
            {folioReading === null ? (
              folio
            ) : (
              <>
                <span aria-hidden="true">{folio}</span>
                <span className="sr-only">{folioReading}</span>
              </>
            )}
          </p>
        )}
      </div>
    </header>
  );
}

export { RunningHead };
