import type { KeyRotation } from './rotation';

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

export type ClosedBookKeyAction =
  | { readonly type: 'open' }
  | { readonly type: 'rotate'; readonly rotation: KeyRotation };

export type OpenBookKeyAction = 'previous' | 'next';

function hasCommandModifier(input: KeyInput): boolean {
  return input.altKey || input.ctrlKey || input.metaKey;
}

const OPEN_ACTION: ClosedBookKeyAction = { type: 'open' };

/** 화살표 → 키보드 회전. →는 오른쪽으로, ↓는 아래로 끈 것과 같은 방향이다(rotation.ts rotateByKeyStep). */
const ARROW_ROTATIONS: Readonly<Record<string, KeyRotation>> = {
  ArrowLeft: { axis: 'horizontal', step: -1 },
  ArrowRight: { axis: 'horizontal', step: 1 },
  ArrowUp: { axis: 'vertical', step: -1 },
  ArrowDown: { axis: 'vertical', step: 1 },
};

/** 닫힌 책 버튼: Enter·Space는 펼침, ←/→는 좌우, ↑/↓는 위아래 90° 회전(임시, tech-research.md 7장 U1·2026-11-16 결정 B.5). */
export function closedBookKeyAction(input: KeyInput): ClosedBookKeyAction | null {
  if (hasCommandModifier(input)) {
    return null;
  }
  if (input.key === 'Enter' || input.key === ' ') {
    return OPEN_ACTION;
  }
  const rotation = Object.hasOwn(ARROW_ROTATIONS, input.key) ? ARROW_ROTATIONS[input.key] : undefined;
  return rotation === undefined ? null : { type: 'rotate', rotation };
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

/**
 * 앱 전체(문서) 키: Esc는 앞표지로 덮기(2026-11-16 사용자 결정 A.3). 포커스가 어디 있든 받는다.
 * 한글 입력 조합 중의 Esc는 조합을 취소하는 키라 가로채지 않는다.
 */
export function documentKeyAction(input: KeyInput & { readonly isComposing?: boolean }): 'close' | null {
  if (hasCommandModifier(input) || input.isComposing === true) {
    return null;
  }
  return input.key === 'Escape' ? 'close' : null;
}
