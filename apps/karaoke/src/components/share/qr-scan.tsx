import { Camera } from 'lucide-react';

import { Button } from '@mumak/ui/components/button';
import { Progress } from '@mumak/ui/components/progress';
import { cn } from '@mumak/ui/lib/utils';

import { useShareScanner } from '@/hooks/use-share-scanner';
import type { KaraokeShareBundle } from '@/lib/share/bundle';
import { SHARE_PROFILES } from '@/lib/share/frames';

/**
 * 섬광 경고(WCAG 2.3.1)는 보내는 화면에도 있지만 받는 사람은 다른 기기의 다른 사람이라 그것을 못 본다.
 * 카메라를 켜기 전에 상대 화면이 얼마나 빨리 바뀔 수 있는지 여기서 한 번 더 알린다.
 */
const MAX_CHANGES_PER_SECOND = Math.max(...SHARE_PROFILES.map(profile => profile.targetSymbolsPerSecond));

function kilobytes(bytesPerSecond: number): string {
  return (bytesPerSecond / 1024).toFixed(1);
}

export function QrScan({
  active,
  onComplete,
  onError,
}: {
  active: boolean;
  onComplete: (bundle: KaraokeShareBundle) => void;
  onError: (message: string) => void;
}) {
  const { videoRef, starting, scanning, decoding, stats, start, reset } = useShareScanner({
    active,
    onComplete,
    onError,
  });
  const collecting = stats.blockCount > 0;

  return (
    <div className="flex-1 space-y-4 p-4">
      <div
        className={cn(
          'border-border bg-muted relative flex aspect-square max-h-[20rem] w-full items-center justify-center overflow-hidden border',
          scanning && 'bg-black'
        )}
      >
        <video ref={videoRef} aria-label="QR 스캔 카메라" className="size-full object-cover" muted playsInline />
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Camera className="text-muted-foreground size-7 stroke-[1.25]" />
            <p className="text-muted-foreground text-xs leading-relaxed">
              버튼을 누른 뒤에만 카메라 권한을 요청합니다. 보내는 화면은 초당 최대 {MAX_CHANGES_PER_SECOND}회 흑백으로
              바뀝니다.
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-none"
              disabled={starting || decoding}
              onClick={() => void start()}
            >
              {decoding ? '데이터 복원 중…' : starting ? '카메라 여는 중…' : '카메라 켜기'}
            </Button>
          </div>
        )}
      </div>
      {collecting && (
        <div className="space-y-2">
          <p className="font-utility text-center text-sm tabular-nums">
            {stats.rank} / {stats.blockCount} 조각 모으는 중
          </p>
          <Progress
            value={(stats.rank / stats.blockCount) * 100}
            aria-label="QR 수신 진행률"
            className="rounded-none"
          />
          <p className="font-utility text-muted-foreground text-center text-xs tabular-nums">
            실측 {kilobytes(stats.bytesPerSecond)} KB/s · 초당 {stats.scansPerSecond.toFixed(1)}장 · 버린 조각{' '}
            {stats.droppedSymbols}
          </p>
          {stats.etaSeconds !== null && (
            <p className="font-utility text-muted-foreground text-center text-xs tabular-nums">
              남은 시간 약 {Math.ceil(stats.etaSeconds)}초
            </p>
          )}
        </div>
      )}
      {scanning && !collecting && (
        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          QR을 찾는 중입니다. 화면 전체가 사각형 안에 들어오게 맞춰 주세요.
        </p>
      )}
      {scanning && (
        // 스캔 중에는 카메라 위 오버레이가 사라져 아무 조작도 남지 않는다. 멈춤이 유일한 복구 수단이다.
        <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={reset}>
          멈추고 다시 시도
        </Button>
      )}
      <p className="text-muted-foreground text-center text-xs">
        카메라 영상은 이 기기 안에서만 읽고 저장하지 않습니다.
      </p>
    </div>
  );
}
