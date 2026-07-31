import * as React from 'react';

export function useLocalStorageState<T>(key: string, fallback: T) {
  const [value, setValue] = React.useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  });

  React.useLayoutEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  const syncFromAnotherTab = React.useEffectEvent((event: StorageEvent) => {
    if (event.storageArea !== localStorage || event.key !== key) return;
    try {
      setValue(event.newValue ? (JSON.parse(event.newValue) as T) : fallback);
    } catch {
      // Keep the last valid local value when another tab writes corrupt data.
    }
  });

  React.useEffect(() => {
    window.addEventListener('storage', syncFromAnotherTab);
    return () => window.removeEventListener('storage', syncFromAnotherTab);
  }, [key]);

  return [value, setValue] as const;
}
