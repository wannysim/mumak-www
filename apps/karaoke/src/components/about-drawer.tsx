import { Mail } from 'lucide-react';

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@mumak/ui/components/drawer';

import { LyricsLibrary } from '@/components/lyrics-library';

const CONTACT = 'wannysim@gmail.com';

export function AboutDrawer({
  open,
  onOpenChange,
  songSlugs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songSlugs: readonly string[];
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>이 앱에 대해</DrawerTitle>
          <DrawerDescription>가사를 담지 않고 로컬 파일로 연습하는 모바일 노래방</DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[68svh] space-y-6 overflow-y-auto px-4 pb-8 text-sm leading-relaxed">
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

          <section className="space-y-3">
            <h3 className="text-foreground font-semibold">내 가사</h3>
            <LyricsLibrary songSlugs={songSlugs} />
          </section>

          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">어떻게 쓰나</h3>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              <li>JSON 파일을 선택하면 가사가 이 브라우저의 기기 저장소에 들어갑니다.</li>
              <li>헤더의 좌우 화살표로 곡을 넘기고, 가운데 제목을 누르면 곡 목록이 열립니다.</li>
              <li>가사 줄을 누르면 그 구간부터 다시 재생되고 화면 가운데로 맞춰집니다.</li>
              <li>반복 버튼으로 한 곡 반복이나 다음 곡 자동재생을 켤 수 있습니다.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">가사와 음원에 대해</h3>
            <p className="text-muted-foreground">
              음원은 아티스트의 공식 YouTube 영상을 그대로 임베드합니다. 앱에는 가사 원문·발음·번역이 포함되지 않으며,
              앱의 가사 기능은 사용자가 선택한 파일을 별도 서버나 운영자에게 업로드하지 않습니다. YouTube 재생에는
              YouTube의 iframe API가 사용됩니다.
            </p>
            <p className="text-muted-foreground">
              불러온 자료는 개인적인 연습 범위에서 사용하고, 파일이나 화면을 공개적으로 다시 공유하지 마세요.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">문의</h3>
            <a
              href={`mailto:${CONTACT}?subject=${encodeURIComponent('[노래방] 문의')}`}
              className="bg-muted hover:bg-muted/70 text-foreground inline-flex min-h-11 items-center gap-2 rounded-none px-3 font-medium"
            >
              <Mail className="size-4" />
              {CONTACT}
            </a>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
