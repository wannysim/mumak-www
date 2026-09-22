import { Info } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@mumak/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@mumak/ui/components/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mumak/ui/components/tooltip';

import { useTimeZone } from '@/components/time-zone-provider';
import type { DashboardFill } from '@/lib/dashboard-schema';
import { formatDecimal, formatMoney } from '@/lib/format';

function FillDetails({ fill, currency }: { fill: DashboardFill; currency: string }) {
  const { formatDateTime } = useTimeZone();
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const label = `${fill.symbol} ${fill.side === 'buy' ? '매수' : '매도'} 체결 상세`;

  return (
    <TooltipProvider>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip open={!open && tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={fill.side === 'buy' ? 'destructive' : 'default'}
                size="xs"
                className="h-6 w-14 shrink-0 rounded-sm md:h-8 md:w-16"
                aria-label={label}
              >
                <span className="text-xs md:text-[0.8rem]">{fill.side === 'buy' ? '매수' : '매도'}</span>
                <Info data-icon="inline-end" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent className="max-w-72 whitespace-normal break-words">
            {fill.reason ?? '체결 금액과 수수료 보기'}
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          collisionPadding={16}
          aria-label={label}
          className="max-w-[calc(100vw-2rem)] whitespace-normal break-words"
        >
          <p className="font-semibold">
            {fill.symbol} {fill.side === 'buy' ? '매수' : '매도'} 체결
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(fill.at)}</p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs">
            <dt className="text-muted-foreground">수량</dt>
            <dd className="text-right tabular-nums">{formatDecimal(fill.quantity)}주</dd>
            <dt className="text-muted-foreground">체결 단가</dt>
            <dd className="text-right tabular-nums">{formatMoney(fill.price, currency)}</dd>
            <dt className="text-muted-foreground">체결 금액</dt>
            <dd className="text-right tabular-nums">
              {formatMoney(String(Number(fill.quantity) * Number(fill.price)), currency)}
            </dd>
            <dt className="text-muted-foreground">수수료</dt>
            <dd className="text-right tabular-nums">{formatMoney(fill.commission, currency)}</dd>
            <dt className="text-muted-foreground">{fill.side === 'buy' ? '총 매수 지출' : '순매도 수령액'}</dt>
            <dd className="text-right font-medium tabular-nums">
              {formatMoney(
                String(
                  Number(fill.quantity) * Number(fill.price) + (fill.side === 'buy' ? 1 : -1) * Number(fill.commission)
                ),
                currency
              )}
            </dd>
          </dl>
          <div className="border-t border-border pt-3">
            <p className="mb-1 text-xs font-medium">결정 근거</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {fill.reason ?? '기록된 결정 근거가 없습니다.'}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

export { FillDetails };
