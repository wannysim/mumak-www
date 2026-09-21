import { Info } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@mumak/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@mumak/ui/components/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mumak/ui/components/tooltip';

import type { DashboardFill } from '@/lib/dashboard-schema';

function FillReason({ fill }: { fill: DashboardFill }) {
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  if (!fill.reason) return null;
  const label = `${fill.symbol} ${fill.side === 'buy' ? '매수' : '매도'} 결정 근거`;

  return (
    <TooltipProvider>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip open={!open && tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={label}>
                <Info aria-hidden="true" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent className="max-w-72 whitespace-normal break-words">{fill.reason}</TooltipContent>
        </Tooltip>
        <PopoverContent aria-label={label} className="max-w-[calc(100vw-2rem)] whitespace-normal break-words">
          <p className="font-medium">결정 근거</p>
          <p>{fill.reason}</p>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

export { FillReason };
