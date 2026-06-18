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

import type { SpotifyDeviceInfo, SpotifyDeviceType } from '@/lib/spotify/types';

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

export function DeviceBadge({
  device,
  className,
  showName = true,
}: {
  device: SpotifyDeviceInfo;
  className?: string;
  showName?: boolean;
}) {
  const Icon = DEVICE_ICON_BY_TYPE[device.type] ?? Speaker;
  return (
    <span
      className={cn('inline-flex items-center gap-2 text-sm', className)}
      title={device.name}
      aria-label={`재생 중인 기기: ${device.name}`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {showName ? <span className="truncate">{device.name}</span> : null}
    </span>
  );
}
