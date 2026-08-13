import { FileDown, Gauge, Library, ListMusic, QrCode, Share2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import { Label } from '@mumak/ui/components/label';
import { RadioGroup, RadioGroupItem } from '@mumak/ui/components/radio-group';
import { Switch } from '@mumak/ui/components/switch';

import type { ShareScopeKind } from '@/lib/share/bundle';
import {
  profileBytesPerSecond,
  SHARE_PROFILES,
  shareProfile,
  type ShareProfile,
  type ShareProfileId,
} from '@/lib/share/frames';
import type { Playlist, SongLibrary } from '@/lib/song-library';
import type { Song } from '@/songs';

function OptionCard({
  id,
  value,
  title,
  description,
  note,
  disabled,
  icon: Icon,
}: {
  id: string;
  value: string;
  title: string;
  description: string;
  note?: string;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Label
      htmlFor={id}
      className="border-border has-data-[state=checked]:border-primary flex min-h-16 items-center gap-3 border px-3 py-2 has-data-[disabled]:cursor-not-allowed has-data-[disabled]:opacity-60 not-has-data-[disabled]:cursor-pointer"
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} />
      <Icon className="text-muted-foreground size-4 shrink-0 stroke-[1.5]" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-muted-foreground block truncate text-xs">{description}</span>
        {note && <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">{note}</span>}
      </span>
    </Label>
  );
}

/** 이론값과 실측값을 절대 섞지 않는다. 여기 숫자는 전부 계산된 상한이고 실측은 전송 화면에만 있다. */
function profileDescription(profile: ShareProfile): string {
  const perSecond = (profileBytesPerSecond(profile) / 1024).toFixed(1);
  return `이론 최대 ${perSecond} KB/s · 초당 ${profile.targetSymbolsPerSecond}장`;
}

/**
 * 갱신 속도를 여기서 미리 알린다. qr-stream의 시작 전 안내와 중복돼도 좋다 — 보내는 사람과 받는
 * 사람은 다른 기기의 다른 사람이라 서로의 화면을 보지 못한다.
 * `turbo`·`max`가 네이티브 디코더에서만 빠르다는 사실은 숨기지 않는다. jsQR 경로 실측에서 turbo는
 * `fast`와 사실상 같았고 max는 더 느렸다(README 프로파일 표). 감추면 사용자가 더 느린 선택지를
 * 빠른 줄 알고 고르게 된다. 문구는 실측이 지지하는 만큼만 말한다 — turbo는 "느리다"가 아니라
 * "빠르지 않다"가 맞다.
 */
const PROFILE_NOTES: Partial<Record<ShareProfileId, string>> = {
  turbo: '초당 30회 갱신. 네이티브 QR 디코더가 있는 기기에서만 빠르고, 그렇지 않으면 빠르게보다 빠르지 않습니다.',
  max: 'QR 2장을 위아래로 함께 보여 주며 장당 초당 30회 갱신. 폰 화면에는 2장이 함께 들어가지 않아 한 장만 보이고 합산 속도가 절반이 됩니다 — 태블릿이나 데스크톱에서 보낼 때를 위한 설정입니다. 네이티브 QR 디코더가 없는 받는 기기에서는 빠르게보다 느립니다.',
};

/** WCAG 2.3.1은 초당 3회를 넘는 섬광을 위험으로 본다. 이 앱은 20회까지만 기본 선택지로 남긴다. */
const REDUCED_MOTION_LIMIT_PER_SECOND = 20;
const REDUCED_MOTION_BLOCKED = '모션 줄이기를 켠 기기에서는 선택할 수 없습니다.';

/**
 * 라디오의 `disabled`와 `createQr`의 클램프가 **같은 판정**을 써야 한다. 렌더 시점에 한 번 읽고
 * 마는 스냅샷이면, 고른 뒤에 모션 줄이기를 켠 사용자에게 비활성인데 체크된 항목이 남고
 * 'QR 만들기'는 그대로 초당 60장을 시작한다. 매번 다시 읽으면 그 문이 없다.
 */
export function isBlockedByReducedMotion(profile: ShareProfile): boolean {
  return (
    profile.targetSymbolsPerSecond > REDUCED_MOTION_LIMIT_PER_SECOND &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function SendPanel({
  library,
  currentPlaylist,
  currentSong,
  scope,
  onScopeChange,
  includeLyrics,
  onIncludeLyricsChange,
  lyricsLoading,
  includedLyricsCount,
  profileId,
  onProfileChange,
  building,
  sharing,
  canShareToDevice,
  onCreateQr,
  onShareToDevice,
  onSaveFile,
}: {
  library: SongLibrary;
  currentPlaylist: Playlist;
  currentSong: Song;
  scope: ShareScopeKind;
  onScopeChange: (scope: ShareScopeKind) => void;
  includeLyrics: boolean;
  onIncludeLyricsChange: (include: boolean) => void;
  lyricsLoading: boolean;
  includedLyricsCount: number;
  profileId: ShareProfileId;
  onProfileChange: (id: ShareProfileId) => void;
  building: boolean;
  sharing: boolean;
  canShareToDevice: boolean;
  onCreateQr: () => void;
  onShareToDevice: () => void;
  onSaveFile: () => void;
}) {
  // 기본값 강등(share-drawer)만으로는 부족하다. 선택 자체를 막아야 함정이 남지 않는다.
  const selected = shareProfile(profileId);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 p-4">
        <RadioGroup value={scope} onValueChange={value => onScopeChange(value as ShareScopeKind)}>
          <OptionCard
            id="share-song"
            value="song"
            title="현재 곡"
            description={`${currentSong.titleJa} · ${currentSong.titleKo}`}
            icon={ListMusic}
          />
          <OptionCard
            id="share-playlist"
            value="playlist"
            title="현재 재생목록"
            description={`${currentPlaylist.name} · ${currentPlaylist.songSlugs.length}곡`}
            icon={Library}
          />
          <OptionCard
            id="share-library"
            value="library"
            title="전체 보관함"
            description={`${library.playlists.length}개 재생목록 · ${library.songs.length}곡`}
            icon={QrCode}
          />
        </RadioGroup>

        <div className="border-border flex items-center justify-between gap-4 border-y py-4">
          <div>
            <Label htmlFor="share-lyrics" className="font-medium">
              저장된 가사도 포함
            </Label>
            <p className="text-muted-foreground mt-1 text-xs">
              {lyricsLoading ? '가사 확인 중' : includeLyrics ? `${includedLyricsCount}곡 포함` : '포함하지 않음'}
            </p>
          </div>
          {/* 이 앱의 컨트롤은 전부 각지다. Switch만 shadcn 기본 pill이라 각을 맞춘다. */}
          <Switch
            id="share-lyrics"
            checked={includeLyrics}
            disabled={lyricsLoading}
            onCheckedChange={onIncludeLyricsChange}
            className="rounded-none [&_[data-slot=switch-thumb]]:rounded-none"
          />
        </div>
        {includeLyrics && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            직접 작성했거나 공유할 권한이 있는 가사만 포함해 주세요. 가사가 많으면 QR 표시 시간이 길어집니다.
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">보내는 속도</p>
          <RadioGroup value={profileId} onValueChange={value => onProfileChange(value as ShareProfileId)}>
            {SHARE_PROFILES.map(profile => {
              const blocked = isBlockedByReducedMotion(profile);
              return (
                <OptionCard
                  key={profile.id}
                  id={`share-speed-${profile.id}`}
                  value={profile.id}
                  title={profile.label}
                  description={profileDescription(profile)}
                  note={blocked ? REDUCED_MOTION_BLOCKED : PROFILE_NOTES[profile.id]}
                  disabled={blocked}
                  icon={Gauge}
                />
              );
            })}
          </RadioGroup>
          <p className="text-muted-foreground text-xs leading-relaxed">
            선택한 속도에서 QR 한 장이 초당 {selected.targetSymbolsPerSecond / selected.lanes}회 바뀝니다. 빛 번쩍임에
            민감하다면 &lsquo;안정&rsquo;을 선택해 주세요.
          </p>
        </div>
      </div>
      <div className="border-border space-y-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button type="button" className="min-h-11 w-full rounded-none" disabled={building} onClick={onCreateQr}>
          <QrCode />
          {building ? 'QR 만드는 중…' : 'QR 만들기'}
        </Button>
        {canShareToDevice && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full rounded-none"
            disabled={sharing}
            onClick={onShareToDevice}
          >
            <Share2 />
            {sharing ? '공유하는 중…' : '기기로 바로 공유'}
          </Button>
        )}
        <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={onSaveFile}>
          <FileDown />
          공유 파일 저장
        </Button>
      </div>
    </div>
  );
}
