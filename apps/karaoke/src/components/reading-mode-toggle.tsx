import { Button } from '@mumak/ui/components/button';

export function ReadingModeToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  const description = enabled ? '일본어 타이포그래피 중심으로 돌아가기' : '발음과 해석을 크게 보기';

  return (
    <Button
      variant="ghost"
      aria-label="READ — 발음·해석 확대 모드"
      aria-pressed={enabled}
      title={description}
      onClick={() => onChange(!enabled)}
      className="display-toggle-item font-utility text-muted-foreground aria-pressed:text-foreground relative h-11 min-w-11 rounded-none px-1 text-[0.625rem] tracking-[0.08em] hover:bg-transparent aria-pressed:font-semibold"
    >
      READ
    </Button>
  );
}
