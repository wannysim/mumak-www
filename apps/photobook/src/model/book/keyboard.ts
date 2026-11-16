import type { Vec2 } from '@/model/fold';

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

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export type OpenBookKeyAction = 'previous' | 'next';

/** Alt·Ctrl·Meta. macOS는 Meta를 누른 동안 다른 키의 keyup을 보내지 않아, 이때 누르던 화살표는 다 뗀 것으로 본다(use-held-arrows.ts). */
export function hasCommandModifier(input: KeyInput): boolean {
  return input.altKey || input.ctrlKey || input.metaKey;
}

/** 닫힌 책을 돌리는 화살표 → 끄는 방향. →는 오른쪽으로, ↓는 아래로 끈 것과 같은 방향으로 돈다(key-spin.ts). */
const ARROW_DIRECTIONS: Readonly<Record<ArrowKey, Vec2>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

export function isArrowKey(key: string): key is ArrowKey {
  return Object.hasOwn(ARROW_DIRECTIONS, key);
}

/**
 * 닫힌 책 버튼: Enter·Space는 펼침. 화살표 회전은 버튼이 아니라 문서 전체에서 받는다(hooks/use-held-arrows.ts,
 * 누르는 동안 그쪽으로 돈다. 2026-11-16 사용자 결정, tech-research.md 7장 공통 규칙 "키 범위").
 */
export function closedBookKeyAction(input: KeyInput): 'open' | null {
  if (hasCommandModifier(input)) {
    return null;
  }
  return input.key === 'Enter' || input.key === ' ' ? 'open' : null;
}

/** 누르고 있는 화살표들의 방향 합. 성분은 -1·0·1이고 반대 화살표는 서로 지운다. */
export function arrowDirection(keys: Iterable<ArrowKey>): Vec2 {
  let x = 0;
  let y = 0;
  for (const key of keys) {
    x += ARROW_DIRECTIONS[key].x;
    y += ARROW_DIRECTIONS[key].y;
  }
  return { x, y };
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
