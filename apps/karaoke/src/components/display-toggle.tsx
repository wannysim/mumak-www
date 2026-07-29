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
      size="lg"
      spacing={0}
      value={selected}
      onValueChange={(keys: string[]) => {
        if (keys.length === 0) return; // 최소 한 줄은 남긴다
        onChange({ jp: keys.includes('jp'), pron: keys.includes('pron'), ko: keys.includes('ko') });
      }}
      aria-label="가사 표시 설정"
      className="rounded-none"
    >
      {DISPLAY_FIELDS.map(field => (
        <ToggleGroupItem
          key={field.key}
          value={field.key}
          aria-label={`${field.shortLabel}, ${field.label}`}
          className="display-toggle-item font-utility text-muted-foreground hover:text-foreground relative h-11 min-w-11 rounded-none border-0 bg-transparent px-1 text-[0.625rem] tracking-[0.12em] data-[state=on]:bg-transparent data-[state=on]:font-semibold data-[state=on]:text-foreground min-[360px]:min-w-12"
        >
          {field.shortLabel}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
