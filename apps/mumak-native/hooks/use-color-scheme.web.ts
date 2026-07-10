import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

/**
 * 정적 렌더링(웹)에서는 서버 스냅샷을 'light'로 고정해 hydration 불일치를 막고,
 * 클라이언트에서는 실제 컬러 스킴을 따라간다. useSyncExternalStore의 getServerSnapshot이
 * "하이드레이션 전 light" 의미를 표현하므로 effect 안 setState 없이 같은 동작을 얻는다.
 */
function subscribe(onStoreChange: () => void): () => void {
  const subscription = Appearance.addChangeListener(onStoreChange);
  return () => subscription.remove();
}

function getSnapshot(): 'light' | 'dark' {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

function getServerSnapshot(): 'light' | 'dark' {
  return 'light';
}

export function useColorScheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
