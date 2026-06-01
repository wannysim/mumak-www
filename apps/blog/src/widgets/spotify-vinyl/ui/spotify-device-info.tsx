import {
  Car,
  Cast,
  Gamepad2,
  Laptop,
  MonitorPlay,
  Smartphone,
  Speaker,
  Tablet,
  Usb,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@mumak/ui/lib/utils';

import type { SpotifyDeviceInfo, SpotifyDeviceType } from '@/src/entities/spotify';

interface SpotifyDeviceInfoProps {
  device: SpotifyDeviceInfo;
  className?: string;
}

const DEVICE_ICON_BY_TYPE: Record<SpotifyDeviceType, LucideIcon> = {
  Computer: Laptop,
  Smartphone: Smartphone,
  Tablet: Tablet,
  Speaker: Speaker,
  TV: MonitorPlay,
  AVR: Speaker,
  STB: MonitorPlay,
  AudioDongle: Usb,
  GameConsole: Gamepad2,
  CastVideo: Cast,
  CastAudio: Cast,
  Automobile: Car,
  Unknown: Speaker,
};

export function SpotifyDeviceInfoBadge({ device, className }: SpotifyDeviceInfoProps) {
  const Icon = DEVICE_ICON_BY_TYPE[device.type] ?? Speaker;
  return (
    <span
      className={cn('inline-flex items-center text-muted-foreground', className)}
      aria-label={`Playing on ${device.name}`}
      title={device.name}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
    </span>
  );
}
