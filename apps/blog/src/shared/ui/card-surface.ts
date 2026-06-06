// 공유 "인터랙티브 카드 표면" recipe.
// ContentCard와 GardenOverview 타일이 동일한 border/elevation/hover/active 거동을
// 갖도록 단일 소스로 둔다. padding은 사용처마다 달라서 포함하지 않는다.
export const cardSurfaceClass =
  'rounded-lg border border-border bg-card transition-all duration-150 hover:border-foreground/20 hover:bg-muted/40 hover:shadow-sm active:scale-[0.99]';
