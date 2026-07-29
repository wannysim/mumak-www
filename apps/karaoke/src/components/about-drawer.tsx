import { CircleHelp, Mail, RotateCcw } from 'lucide-react';

import { Button } from '@mumak/ui/components/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@mumak/ui/components/drawer';

import { LyricsLibrary } from '@/components/lyrics-library';

const CONTACT = 'wannysim@gmail.com';

export function AboutDrawer({
  open,
  onOpenChange,
  onStartGuide,
  onResetPlaylists,
  songSlugs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartGuide: () => void;
  onResetPlaylists: () => void;
  songSlugs: readonly string[];
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>이 앱에 대해</DrawerTitle>
          <DrawerDescription>가사를 기기에만 보관하며 YouTube 영상으로 연습하는 노래방</DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[68svh] space-y-6 overflow-y-auto px-4 pb-8 text-sm leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">무엇을 위한 앱인가</h3>
            <p className="text-muted-foreground">
              좋아하는 노래를 직접 재생목록에 모아 따라 부르는 개인 연습 도구입니다. 원문 · 한글 발음 · 번역 중 필요한
              정보만 켜고 노래에 맞춰 볼 수 있습니다.
            </p>
            <p className="text-muted-foreground text-xs">
              이 앱은 각 아티스트, YouTube, Google, 음반사 또는 권리자와 제휴·후원·승인 관계가 없는 비공식 도구입니다.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-foreground font-semibold">내 가사</h3>
            <LyricsLibrary songSlugs={songSlugs} />
          </section>

          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">어떻게 쓰나</h3>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              <li>상단 곡 제목을 눌러 재생목록과 YouTube 영상을 직접 추가합니다.</li>
              <li>JSON을 불러오거나 가사 편집 버튼에서 직접 입력합니다.</li>
              <li>어느 방식으로 저장했든 가사 편집 버튼에서 문장과 시작 시간을 다시 고칠 수 있습니다.</li>
              <li>가사 줄을 누르면 그 구간부터 재생되고, 반복 버튼으로 재생 방식을 바꿀 수 있습니다.</li>
            </ul>
            <Button type="button" variant="outline" size="sm" onClick={onStartGuide}>
              <CircleHelp />
              처음 사용 가이드 다시 보기
            </Button>
          </section>

          <section className="border-border space-y-2 border-t pt-5">
            <h3 className="text-foreground font-semibold">데이터 관리</h3>
            <p className="text-muted-foreground text-xs">
              추가한 재생목록과 곡 정보, 순서를 Vaundy와 Fujii Kaze 기본 목록으로 되돌립니다. 저장된 가사와 화면 설정은
              유지됩니다.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => {
                if (
                  !window.confirm(
                    '재생목록을 초기화할까요?\n추가한 재생목록과 곡 정보는 사라지지만 저장된 가사는 유지됩니다.'
                  )
                ) {
                  return;
                }
                onResetPlaylists();
              }}
            >
              <RotateCcw />
              재생목록 초기화…
            </Button>
          </section>

          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">저작권과 이용 책임</h3>
            <p className="text-muted-foreground">
              앱 배포물에는 가사 원문·발음·번역이나 음원 파일이 포함되지 않습니다. 영상은 YouTube가 허용한 공식 임베드
              플레이어에서 제공되며, 각 가사·번역·음원·영상·상표의 권리는 해당 권리자에게 있습니다.
            </p>
            <p className="text-muted-foreground">
              사용자는 적법하게 이용할 수 있는 자료만 불러오고, 관련 법령과 권리자가 허용하는 범위에서 가사 파일과 앱
              화면을 이용해야 합니다. 이 안내는 권리자의 권리를 제한하지 않습니다.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">개인정보와 외부 서비스</h3>
            <p className="text-muted-foreground">
              앱 코드는 계정·광고·분석 기능을 사용하지 않으며, 사용자가 불러오거나 작성한 가사를 운영자 서버 또는 외부
              가사 서비스로 전송하지 않습니다. 가사는 이 브라우저의 기기 내 저장 공간에 남고, 브라우저 데이터를 지우면
              함께 삭제됩니다.
            </p>
            <p className="text-muted-foreground text-xs">
              외부 AI 요청문은 사용자가 직접 복사할 때만 클립보드에 기록됩니다. 다른 서비스에 붙여 넣으면 해당 서비스의
              약관과 정책이 적용되므로, 제출 권한이 있는 내용에만 사용하세요.
            </p>
            <p className="text-muted-foreground">
              영상 재생에는 YouTube IFrame Player API가 사용됩니다. 이 앱의 YouTube 재생 기능을 이용하면{' '}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                YouTube 이용약관
              </a>
              에 동의한 것으로 봅니다. YouTube·Google과 호스팅 사업자는 각자의 정책에 따라 접속 정보를 처리할 수
              있습니다. 자세한 내용은{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                Google 개인정보처리방침
              </a>
              에서 확인할 수 있습니다.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-foreground font-semibold">문의 및 권리 침해 신고</h3>
            <p className="text-muted-foreground">권리 침해 우려나 삭제 요청이 있으면 아래 주소로 알려 주세요.</p>
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
