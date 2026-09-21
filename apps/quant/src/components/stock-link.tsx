import { ExternalLink } from 'lucide-react';

function StockLink({ symbol }: { symbol: string }) {
  if (!/^[A-Z0-9][A-Z0-9.-]{0,15}$/.test(symbol)) return <span>{symbol}</span>;
  // Toss resolves US tickers to its own instrument IDs; never guess an ID.
  return (
    <a
      href={`https://www.tossinvest.com/stocks/${encodeURIComponent(symbol)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${symbol} 토스증권에서 보기 (새 탭)`}
      className="inline-flex min-h-11 items-center gap-1 underline decoration-muted-foreground/50 underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {symbol}
      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

export { StockLink };
