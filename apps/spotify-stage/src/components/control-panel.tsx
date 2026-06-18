import { Check, Copy, RotateCcw, Settings, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@mumak/ui/components/button';
import { Label } from '@mumak/ui/components/label';
import { Slider } from '@mumak/ui/components/slider';
import { Switch } from '@mumak/ui/components/switch';

import { type AmbientConfig, type StageSettings, type ThemeChoice, THEME_CHOICES } from '@/lib/settings/config';
import type { SpotifyDeviceType } from '@/lib/spotify/types';

/** 실제 device.type 을 테마 선택지로 환산(어떤 옵션이 "현재 기기"인지 표시용). */
function deviceTypeToChoice(deviceType: SpotifyDeviceType | undefined): ThemeChoice {
  switch (deviceType) {
    case 'Computer':
      return 'computer';
    case 'Smartphone':
      return 'smartphone';
    case 'Automobile':
      return 'automobile';
    case 'TV':
      return 'tv';
    default:
      return 'fallback';
  }
}

interface SliderRow {
  key: keyof AmbientConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  /** 표시용 포맷터. */
  format?: (value: number) => string;
}

const SLIDER_ROWS: SliderRow[] = [
  { key: 'albumLayerOpacity', label: '앨범 배경 강도', min: 0, max: 0.8, step: 0.05 },
  { key: 'blobOpacity', label: '블롭 강도', min: 0, max: 1, step: 0.05 },
  { key: 'blobBlur', label: '블롭 블러', min: 40, max: 140, step: 5, format: v => `${v}px` },
  { key: 'blobCount', label: '블롭 개수', min: 1, max: 5, step: 1, format: v => `${v}개` },
  { key: 'overlayDarkness', label: '어둡기(가독성)', min: 0, max: 0.7, step: 0.05 },
  { key: 'morphMs', label: '색 전환 속도', min: 0, max: 3000, step: 100, format: v => `${v}ms` },
];

export function ControlPanel({
  settings,
  realDeviceType,
  onAmbientChange,
  onThemeChoiceChange,
  onReset,
}: {
  settings: StageSettings;
  realDeviceType: SpotifyDeviceType | undefined;
  onAmbientChange: (patch: Partial<AmbientConfig>) => void;
  onThemeChoiceChange: (choice: ThemeChoice) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const realChoice = deviceTypeToChoice(realDeviceType);

  const copySettings = () => {
    navigator.clipboard
      .writeText(JSON.stringify(settings, null, 2))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };

  return (
    <>
      <button
        onClick={() => setOpen(value => !value)}
        className="fixed right-16 top-4 z-20 flex size-9 items-center justify-center rounded-full bg-black/30 text-white/70 backdrop-blur-md transition hover:bg-black/50 hover:text-white"
        aria-label="설정 패널 열기"
        aria-expanded={open}
        title="설정"
      >
        <Settings className="size-4" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed right-4 top-16 z-30 flex max-h-[80vh] w-80 flex-col gap-5 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/90 p-5 text-zinc-100 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Stage 설정</h2>
            <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white" aria-label="닫기">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <section className="flex flex-col gap-2">
            <Label className="text-xs text-zinc-400">테마</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {THEME_CHOICES.map(choice => {
                const selected = settings.themeChoice === choice.value;
                const isRealDevice = choice.value === realChoice;
                const autoLabel = choice.value === 'auto' ? `${choice.label} (${realChoice})` : choice.label;
                return (
                  <button
                    key={choice.value}
                    onClick={() => onThemeChoiceChange(choice.value)}
                    className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs transition ${
                      selected
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate">{autoLabel}</span>
                    {isRealDevice ? (
                      <span className="ml-1 shrink-0 text-[10px] text-emerald-400" title="현재 기기">
                        ● 현재
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-zinc-400">Ken Burns (앨범 줌/팬)</Label>
              <Switch
                checked={settings.ambient.kenBurns}
                onCheckedChange={checked => onAmbientChange({ kenBurns: checked })}
              />
            </div>

            {SLIDER_ROWS.map(row => {
              const value = settings.ambient[row.key] as number;
              return (
                <div key={row.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <Label className="text-zinc-400">{row.label}</Label>
                    <span className="tabular-nums text-zinc-500">
                      {row.format ? row.format(value) : value.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[value]}
                    min={row.min}
                    max={row.max}
                    step={row.step}
                    onValueChange={values => {
                      const next = values[0];
                      if (next !== undefined) {
                        onAmbientChange({ [row.key]: next } as Partial<AmbientConfig>);
                      }
                    }}
                  />
                </div>
              );
            })}
          </section>

          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={copySettings} className="flex-1 gap-1.5" aria-live="polite">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? '복사됨!' : '설정 JSON 복사'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onReset} className="gap-1.5" title="기본값으로 초기화">
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
