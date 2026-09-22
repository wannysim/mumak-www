import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mumak/ui/components/select';

import { useTimeZone } from '@/components/time-zone-provider';
import { timeZoneLabel } from '@/lib/time-zone';

function TimeZoneSelect() {
  const { timeZone, setTimeZone, zones } = useTimeZone();
  return (
    <Select value={timeZone} onValueChange={setTimeZone}>
      <SelectTrigger aria-label="표시 시간대" title={timeZoneLabel(timeZone)} className="w-32 rounded-none">
        <SelectValue>
          <span className="text-xs">{timeZoneLabel(timeZone)}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="end" className="max-w-[calc(100vw-2rem)]">
        <SelectGroup>
          {zones.map(zone => (
            <SelectItem key={zone.value} value={zone.value}>
              {timeZoneLabel(zone.value)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export { TimeZoneSelect };
