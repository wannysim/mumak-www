import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

// 하이드레이션 완료 여부. 서버 스냅샷은 false, 클라이언트 스냅샷은 항상 true라서
// 하이드레이션 중 동기적으로 재렌더된다. effect 기반 mounted 플래그와 달리
// paint 이후에 바뀌는 게 아니므로 placeholder가 깜빡이지 않는다.
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
