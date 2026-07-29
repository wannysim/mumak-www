export type DisplaySettings = {
  jp: boolean;
  pron: boolean;
  ko: boolean;
};

export const DEFAULT_DISPLAY: DisplaySettings = { jp: true, pron: true, ko: true };

export const DISPLAY_FIELDS = [
  { key: 'jp', label: '日本語', shortLabel: 'JP' },
  { key: 'pron', label: '발음', shortLabel: 'PRON' },
  { key: 'ko', label: '번역', shortLabel: 'KO' },
] as const satisfies ReadonlyArray<{ key: keyof DisplaySettings; label: string; shortLabel: string }>;
