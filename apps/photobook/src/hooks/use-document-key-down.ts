import { useEffect, useEffectEvent } from 'react';

/**
 * 문서 전체의 keydown을 받는다. 포커스가 앱 어디에 있든(body 포함) 받아야 하는 키(Esc로 덮기, 2026-11-16 결정 A.3)에만 쓴다.
 * 펼친 책 영역 안에서만 받아야 하는 ←/→는 여기서 받지 않는다(tech-research.md 7장 공통 규칙 "키 범위").
 * 닫힌 책의 화살표 회전은 누르고 떼는 것을 함께 보는 use-held-arrows.ts가 받는다.
 */
export function useDocumentKeyDown(onKeyDown: (event: KeyboardEvent) => void): void {
  const handleKeyDown = useEffectEvent(onKeyDown);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKeyDown(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
}
