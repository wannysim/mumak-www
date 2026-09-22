import { createContext, useContext, useMemo, useState } from 'react';

import { createDateFormatters } from '@/lib/format';
import { clientTimeZone, DEFAULT_TIME_ZONE, TIME_ZONES } from '@/lib/time-zone';

const TimeZoneContext = createContext({
  timeZone: DEFAULT_TIME_ZONE,
  zones: TIME_ZONES,
  setTimeZone: (_timeZone: string): void => undefined,
  ...createDateFormatters(DEFAULT_TIME_ZONE),
});

function TimeZoneProvider({ children }: { children: React.ReactNode }) {
  const [deviceTimeZone] = useState(clientTimeZone);
  const [timeZone, setTimeZone] = useState(deviceTimeZone);
  const value = useMemo(
    () => ({
      timeZone,
      setTimeZone,
      zones: TIME_ZONES.some(zone => zone.value === deviceTimeZone)
        ? TIME_ZONES
        : [{ value: deviceTimeZone, label: '현지' }, ...TIME_ZONES],
      ...createDateFormatters(timeZone),
    }),
    [deviceTimeZone, timeZone]
  );
  return <TimeZoneContext.Provider value={value}>{children}</TimeZoneContext.Provider>;
}

function useTimeZone() {
  return useContext(TimeZoneContext);
}

export { TimeZoneProvider, useTimeZone };
