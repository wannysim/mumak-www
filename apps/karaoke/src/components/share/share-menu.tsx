import { ScanLine, Send } from 'lucide-react';

import { Button } from '@mumak/ui/components/button';

function MenuButton({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto min-h-20 justify-start rounded-none p-4 text-left"
      onClick={onClick}
    >
      <Icon className="size-5 stroke-[1.5]" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-muted-foreground block text-xs font-normal">{description}</span>
      </span>
    </Button>
  );
}

export function ShareMenu({ onSend, onReceive }: { onSend: () => void; onReceive: () => void }) {
  return (
    <div className="space-y-5 p-4">
      <div className="grid gap-2">
        <MenuButton title="보내기" description="이 기기의 곡과 재생목록을 QR로 표시" icon={Send} onClick={onSend} />
        <MenuButton title="받기" description="다른 기기의 QR을 카메라로 스캔" icon={ScanLine} onClick={onReceive} />
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        QR 데이터와 카메라 영상은 운영자 서버로 보내지 않습니다. 테마와 재생 위치 같은 기기 설정도 공유하지 않습니다.
      </p>
    </div>
  );
}
