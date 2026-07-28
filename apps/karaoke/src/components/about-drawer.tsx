import { Mail } from 'lucide-react';

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@mumak/ui/components/drawer';

const CONTACT = 'wannysim@gmail.com';

export function AboutDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>이 앱에 대해</DrawerTitle>
          <DrawerDescription>Vaundy를 따라 부르기 위한 모바일 노래방</DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[60svh] space-y-5 overflow-y-auto px-4 pb-8 text-sm leading-relaxed">
          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">왜 만들었나</h3>
            <p className="text-muted-foreground">
              Vaundy 콘서트에 가는데 가사를 따라 부르고 싶었습니다. 그런데 일본어 원문만 봐서는 입이 안 떨어지고, 발음만
              봐서는 무슨 말을 하는지 몰라 감정이 안 실리더군요.
            </p>
            <p className="text-muted-foreground">
              그래서 한 줄마다 <strong className="text-foreground">일본어 · 한글 발음 · 번역</strong>을 한꺼번에
              보여주는 노래방을 만들었습니다. 셋 중 필요한 것만 켜 두고 부를 수 있습니다.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">어떻게 쓰나</h3>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              <li>헤더의 좌우 화살표로 곡을 넘기고, 가운데 제목을 누르면 곡 목록이 열립니다.</li>
              <li>가사 줄을 누르면 그 구간부터 다시 재생되고 화면 가운데로 맞춰집니다.</li>
              <li>반복 버튼으로 한 곡 반복이나 다음 곡 자동재생을 켤 수 있습니다.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">곡을 추가하고 싶다면</h3>
            <p className="text-muted-foreground">듣고 싶은 곡이 있으면 편하게 알려주세요. 넣을 수 있으면 넣겠습니다.</p>
            <a
              href={`mailto:${CONTACT}?subject=${encodeURIComponent('[노래방] 곡 추가 요청')}`}
              className="bg-muted hover:bg-muted/70 text-foreground inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-medium"
            >
              <Mail className="size-4" />
              {CONTACT}
            </a>
          </section>

          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">가사와 음원에 대해</h3>
            <p className="text-muted-foreground">
              음원은 재생하지 않고 아티스트의 공식 YouTube 채널에 올라온 것을 그대로 임베드합니다. 가사 원문은
              저작물이라 앱에 담아 배포하지 않고, 타임스탬프는 공개 가사 데이터베이스{' '}
              <a
                href="https://lrclib.net"
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline underline-offset-4"
              >
                lrclib
              </a>
              을 참고했습니다. 발음과 번역은 따라 부르기 위한 보조 표기입니다.
            </p>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
