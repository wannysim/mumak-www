import * as React from 'react';

export function useLocalStorageState<T>(key: string, fallback: T) {
  const fallbackRef = React.useRef(fallback);
  fallbackRef.current = fallback;
  const [value, setValue] = React.useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  });

  React.useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  React.useEffect(() => {
    const syncFromAnotherTab = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== key) return;
      try {
        setValue(event.newValue ? (JSON.parse(event.newValue) as T) : fallbackRef.current);
      } catch {
        // Keep the last valid local value when another tab writes corrupt data.
      }
    };

    window.addEventListener('storage', syncFromAnotherTab);
    return () => window.removeEventListener('storage', syncFromAnotherTab);
  }, [key]);

  return [value, setValue] as const;
}
