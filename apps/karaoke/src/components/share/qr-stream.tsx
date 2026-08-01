import * as React from 'react';

import { Progress } from '@mumak/ui/components/progress';
import { cn } from '@mumak/ui/lib/utils';

import { useShareFrameStream } from '@/hooks/use-share-frame-stream';
import type { ShareFrameStream } from '@/lib/share/frames';
import { blitQrMatrix, QR_QUIET_MODULES } from '@/lib/share/qr-blit';
import type { QrMatrix } from '@/lib/share/qr-matrix';

/** e2e(home·mobile)와 share-drawer 테스트가 이 이름으로 찾는다. 2레인일 때만 번호를 붙인다. */
const CANVAS_LABEL = '노래 데이터 공유 QR';

function kilobytes(bytesPerSecond: number): string {
  return (bytesPerSecond / 1024).toFixed(1);
}

/**
 * 단일 레인은 표시 영역을 화면의 큰 비율로 키우지 않는다(WCAG 2.3.1). 2레인은 클램프를 푼다 —
 * 185모듈짜리 V40 두 장을 320 CSS px에 밀어 넣으면 모듈당 1.7px이 되어 "큰 화면이 필요하다"고
 * 안내하면서 정작 쓸 수 없는 함정이 된다. 섬광 위험은 프로파일 선택 단계에서 막는다(send-panel).
 */
function SymbolCanvas({ matrix, label, clamp }: { matrix: QrMatrix | null; label: string; clamp: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (canvasRef.current && matrix) blitQrMatrix(canvasRef.current, matrix, QR_QUIET_MODULES);
  }, [matrix]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={cn('block aspect-square w-full bg-white', clamp && 'max-w-80')}
    />
  );
}

export function QrStream({ stream }: { stream: ShareFrameStream }) {
  const { lanes, preparedRatio, ready, error, stats } = useShareFrameStream(stream);
  const { lanes: laneCount, targetSymbolsPerSecond } = stream.profile;
  const changesPerSecond = targetSymbolsPerSecond / laneCount;

  if (error) {
    return (
      <p role="alert" className="text-destructive p-6 text-center text-xs leading-relaxed">
        {error}
      </p>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-utility text-sm tabular-nums">QR 미리 만드는 중 {Math.round(preparedRatio * 100)}%</p>
        <Progress
          value={preparedRatio * 100}
          aria-label="QR 준비 진행률"
          className="h-1 w-full max-w-80 rounded-none"
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          {stream.poolSize}장을 미리 만듭니다. 준비가 끝나면 QR이 초당 {changesPerSecond}회 바뀝니다.
        </p>
      </div>
    );
  }

  return (
    // justify-center는 넘칠 때 시작 모서리를 스크롤 밖으로 밀어낸다. 2레인 캔버스 두 장은 폰 드로어
    // 높이를 넘기므로 그러면 레인 1로 되돌아갈 방법이 없다. safe 정렬은 들어갈 때만 가운데로 둔다.
    <div className="flex min-h-full flex-col items-center justify-center-safe gap-4 p-4">
      {/* 좌우로 놓으면 레인당 폭이 반으로 줄어 모듈이 카메라에서 뭉갠다. 항상 위아래로 쌓는다. */}
      <div className="flex w-full flex-col items-center gap-2">
        {lanes.map((matrix, index) => (
          <SymbolCanvas
            key={index}
            matrix={matrix}
            label={laneCount > 1 ? `${CANVAS_LABEL} ${index + 1}` : CANVAS_LABEL}
            clamp={laneCount === 1}
          />
        ))}
      </div>
      <div className="w-full max-w-80 space-y-2 text-center">
        {/* 진행률 막대를 두지 않는다. 풀을 도는 순서는 완료를 향해 가지 않고, 보내는 쪽은 받는 쪽 랭크를 모른다. */}
        <p className="font-utility text-sm tabular-nums">
          {stats.symbolIndex + 1} / {stream.poolSize} 반복 표시
        </p>
        {/*
          '실측'은 받는 화면 전용이다. 여기 숫자는 표시 쪽 수치라 구조상 이론 상한으로 수렴한다
          (표시 심볼/초 × blockBytes). 같은 낱말을 쓰면 받는 쪽이 그 1/10을 받고 있는 동안에도
          보내는 사람은 전송이 이론값대로 돌고 있다고 읽는다.
        */}
        <p className="font-utility text-muted-foreground text-xs tabular-nums">
          표시 {kilobytes(stats.bytesPerSecond)} KB/s · 초당 {stats.symbolsPerSecond.toFixed(1)}장 · 화면{' '}
          {Math.round(stats.displayFps)}Hz
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          QR이 초당 {changesPerSecond}회 바뀝니다. 받는 기기가 다 모을 때까지 화면을 유지해 주세요.
        </p>
      </div>
    </div>
  );
}
