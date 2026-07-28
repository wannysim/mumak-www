import { ToggleGroup, ToggleGroupItem } from '@mumak/ui/components/toggle-group';

import { DISPLAY_FIELDS, type DisplaySettings } from '@/lib/display-settings';

export function DisplayToggle({
  value,
  onChange,
}: {
  value: DisplaySettings;
  onChange: (next: DisplaySettings) => void;
}) {
  const selected = DISPLAY_FIELDS.filter(field => value[field.key]).map(field => field.key);

  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      size="lg"
      value={selected}
      onValueChange={(keys: string[]) => {
        if (keys.length === 0) return; // 최소 한 줄은 남긴다
        onChange({ jp: keys.includes('jp'), pron: keys.includes('pron'), ko: keys.includes('ko') });
      }}
      aria-label="가사 표시 설정"
    >
      {/* 320px 화면에서는 컨트롤 줄이 넘치므로 좁을 때만 좌우 여백을 줄인다. 높이(44px)는 유지. */}
      {DISPLAY_FIELDS.map(field => (
        <ToggleGroupItem key={field.key} value={field.key} className="h-11 px-2 text-sm min-[360px]:px-3.5">
          {field.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
