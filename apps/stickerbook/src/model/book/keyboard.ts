/**
 * 키 → 책 동작. tech-research.md 7장 공통 규칙: ←/→는 책 영역 안에 포커스가 있을 때만 받는다.
 * 수정 키(Alt·Ctrl·Meta)를 함께 누르면 브라우저·OS 단축키라 가로채지 않는다. Shift는 무시하지 않는다.
 */
export type KeyInput = {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
};

export type ClosedBookKeyAction = 'open' | 'rotate-left' | 'rotate-right';

export type OpenBookKeyAction = 'previous' | 'next';

function hasCommandModifier(input: KeyInput): boolean {
  return input.altKey || input.ctrlKey || input.metaKey;
}

/** 닫힌 책 버튼: Enter·Space는 펼침, ←/→는 90° 회전(임시, tech-research.md 7장 U1). */
export function closedBookKeyAction(input: KeyInput): ClosedBookKeyAction | null {
  if (hasCommandModifier(input)) {
    return null;
  }
  switch (input.key) {
    case 'Enter':
    case ' ':
      return 'open';
    case 'ArrowLeft':
      return 'rotate-left';
    case 'ArrowRight':
      return 'rotate-right';
    default:
      return null;
  }
}

/** 펼친 책 영역: ←는 이전 쪽, →는 다음 쪽. */
export function openBookKeyAction(input: KeyInput): OpenBookKeyAction | null {
  if (hasCommandModifier(input)) {
    return null;
  }
  if (input.key === 'ArrowLeft') {
    return 'previous';
  }
  if (input.key === 'ArrowRight') {
    return 'next';
  }
  return null;
}
