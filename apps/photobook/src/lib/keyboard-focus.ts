/**
 * 문서 단위 키와 포커스 이동 판단(2026-11-16 사용자 결정: 책에 포커스가 없어도 키보드로 쓴다. 닫힌 책은 Enter로 펼치고
 * 화살표로 돌리며, 펼친 책은 ←/→로 넘기고 Esc로 덮는다. tech-research.md 7장 공통 규칙 "키 범위").
 */

/** 화살표가 글자 커서를 옮기는 곳(입력칸·편집 영역). 여기서 누른 화살표는 책 키로 받지 않는다. */
export function isTextEntry(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'));
}

/** Enter·Space가 자기 동작을 하는 컨트롤. 여기서 누른 Enter·Space는 그 컨트롤 몫이라 책 키로 받지 않는다. */
export function isActivationTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('a[href], button, input, select, textarea, summary, [role="button"], [role="link"]') !== null
  );
}

/**
 * 앱 안 요소에 포커스가 있는가(body면 아니다). 포커스는 그 요소가 사라질 때만 옮긴다(tech-research.md 7장 공통 규칙
 * "포커스된 노드가 사라지기 전에 옮긴다"). 첫 화면처럼 포커스가 body면 문서 단위 키로 쓰는 중이라 옮기지 않고,
 * 그래서 책에 포커스 표시가 생기지 않는다.
 */
export function hasFocusedElement(): boolean {
  const active = document.activeElement;
  return active !== null && active !== document.body;
}
