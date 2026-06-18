import { useCallback, useEffect, useState } from 'react';

import {
  type AmbientConfig,
  DEFAULT_AMBIENT_CONFIG,
  DEFAULT_SETTINGS,
  type StageSettings,
  type ThemeChoice,
} from '@/lib/settings/config';

const STORAGE_KEY = 'spotify-stage:settings';

function loadSettings(): StageSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<StageSettings>;
    // 기본값과 병합해 새 키가 추가돼도 깨지지 않게 한다.
    return {
      ambient: { ...DEFAULT_AMBIENT_CONFIG, ...parsed.ambient },
      themeChoice: parsed.themeChoice ?? DEFAULT_SETTINGS.themeChoice,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface UseStageSettingsReturn {
  settings: StageSettings;
  setAmbient: (patch: Partial<AmbientConfig>) => void;
  setThemeChoice: (choice: ThemeChoice) => void;
  reset: () => void;
}

/** 컨트롤 패널 설정을 localStorage 와 동기화하며 관리한다. */
export function useStageSettings(): UseStageSettingsReturn {
  const [settings, setSettings] = useState<StageSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setAmbient = useCallback((patch: Partial<AmbientConfig>) => {
    setSettings(prev => ({ ...prev, ambient: { ...prev.ambient, ...patch } }));
  }, []);

  const setThemeChoice = useCallback((choice: ThemeChoice) => {
    setSettings(prev => ({ ...prev, themeChoice: choice }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  return { settings, setAmbient, setThemeChoice, reset };
}
