import * as React from 'react';

// 무음 트랙 사양. 5초 이하 미디어는 Chromium이 transient로 분류해 세션을 붙잡지 못하므로
// 여유를 둬 6초로 만든다. 8kHz·8bit·모노면 6초가 48KB고, 같은 바이트가 반복돼 gzip에서 사라진다.
// @see https://source.chromium.org/chromium/chromium/src/+/main:media/base/media_content_type.cc
const SILENT_TRACK_SECONDS = 6;
const SILENT_TRACK_SAMPLE_RATE = 8_000;

/** 최상위 프레임에서 재생할 무음 WAV를 만든다. 파일을 배포에 얹지 않으려고 런타임에 조립한다. */
function createSilentTrack(): Blob {
  const sampleCount = SILENT_TRACK_SAMPLE_RATE * SILENT_TRACK_SECONDS;
  const buffer = new ArrayBuffer(44 + sampleCount);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount, true);
  writeText(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); // fmt 청크 길이
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 모노
  view.setUint32(24, SILENT_TRACK_SAMPLE_RATE, true);
  view.setUint32(28, SILENT_TRACK_SAMPLE_RATE, true); // byte rate = rate x 1채널 x 1바이트
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bit depth
  writeText(36, 'data');
  view.setUint32(40, sampleCount, true);
  // 8bit PCM의 무음은 0이 아니라 중간값 128이다. 0으로 채우면 최대 음량의 DC 오프셋이 된다.
  new Uint8Array(buffer, 44).fill(128);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * OS의 재생 컨트롤과 앱을 연결한다.
 *
 * 맥북 F7·F8·F9(그리고 헤드셋 버튼, 잠금화면·Now Playing 위젯, 안드로이드 알림 컨트롤)는
 * 페이지에 `keydown`으로 오지 않는다. OS가 먼저 가로채 브라우저에 미디어 키로 넘기고,
 * 브라우저는 이를 Media Session 액션으로 바꿔 준다. 그래서 키 핸들러가 아니라 이 API가 유일한 경로다.
 *
 * 다만 액션은 등록한 프레임이 아니라 "플레이어를 가진 프레임 중 가장 얕은 프레임"으로만 간다.
 * 이 앱의 소리는 전부 YouTube iframe이 내므로 최상위 프레임에 플레이어가 없으면 세션 주인이 iframe이 되고,
 * 여기 등록한 핸들러는 하나도 호출되지 않는다. 이전/다음이 죽고 일시정지만 되는 것처럼 보이는 이유는
 * 그 pause를 YouTube가 자기 핸들러로 처리하기 때문이다.
 * 그래서 최상위 프레임에 무음 트랙을 하나 두고 곡과 같이 재생·정지시켜 세션 주인을 이쪽으로 되돌린다.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler
 * @see https://source.chromium.org/chromium/chromium/src/+/main:content/browser/media/session/media_session_impl.cc
 *
 * ponytail: 재생/일시정지와 이전/다음 네 액션만 붙인다. artwork는 ytimg 외부 요청이 늘고,
 * seekto·seekbackward는 앱 안 progress로 이미 되므로 실제로 아쉬울 때 추가한다.
 */
export function useMediaSession({
  title,
  artist,
  isPlaying,
  onPlay,
  onPause,
  onPreviousTrack,
  onNextTrack,
}: {
  title: string;
  artist: string;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
}) {
  // 핸들러는 곡이 바뀔 때마다 새로 만들어진다. 등록은 한 번만 하고 최신 함수는 ref로 읽는다.
  // 갱신은 렌더가 아니라 커밋 후에 한다. 렌더는 버려질 수 있어서 그 안의 변경은 새면 안 된다.
  const latest = React.useRef({ onPlay, onPause, onPreviousTrack, onNextTrack });
  React.useEffect(() => {
    latest.current = { onPlay, onPause, onPreviousTrack, onNextTrack };
  });

  React.useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;

    const handlers: [MediaSessionAction, () => void][] = [
      ['play', () => latest.current.onPlay()],
      ['pause', () => latest.current.onPause()],
      ['previoustrack', () => latest.current.onPreviousTrack()],
      ['nexttrack', () => latest.current.onNextTrack()],
    ];

    // 브라우저가 모르는 액션에 setActionHandler를 부르면 TypeError가 난다.
    // 하나가 없다고 나머지까지 등록을 포기하면 안 되므로 액션별로 격리한다.
    const registered = handlers.filter(([action, handler]) => {
      try {
        session.setActionHandler(action, handler);
        return true;
      } catch {
        return false;
      }
    });

    return () => {
      for (const [action] of registered) session.setActionHandler(action, null);
      session.playbackState = 'none';
    };
  }, []);

  const trackRef = React.useRef<HTMLAudioElement>(null);
  React.useEffect(() => {
    if (!navigator.mediaSession) return;

    const trackUrl = URL.createObjectURL(createSilentTrack());
    const track = new Audio(trackUrl);
    track.loop = true;
    trackRef.current = track;

    return () => {
      trackRef.current = null;
      track.pause();
      URL.revokeObjectURL(trackUrl);
    };
  }, []);

  // 무음 트랙은 곡과 정확히 같이 돌고 같이 멈춰야 한다.
  //
  // 브라우저가 OS에 알리는 재생 상태는 탭에 재생 중인 플레이어가 있는지로 정해지고,
  // 페이지가 `playbackState`로 "재생 중"을 덮을 수는 있어도 "일시정지"로는 못 덮는다
  // (사이트가 강제 일시정지를 회피하지 못하게 막아 둔 규칙이다).
  // 그래서 곡을 멈춘 뒤에도 무음 트랙이 돌면 OS는 계속 "재생 중"으로 보고, F8 같은 토글 키는
  // 매번 pause로만 해석된다 — 일시정지는 되는데 다시 누르면 재생이 안 되는 상태가 된다.
  //
  // 트랙을 멈추면 남는 플레이어가 이것 하나뿐이라 세션에서 빠지지 않고 suspend만 되므로,
  // 액션을 받을 자격(= 최상위 프레임이 세션 주인)은 그대로 유지된다.
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (isPlaying) track.play().catch(() => {});
    else track.pause();
  }, [isPlaying]);

  React.useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    // MediaMetadata는 Media Session을 지원해도 노출이 안 된 브라우저가 있다.
    if (typeof MediaMetadata === 'function') session.metadata = new MediaMetadata({ title, artist });
    session.playbackState = isPlaying ? 'playing' : 'paused';
  }, [artist, isPlaying, title]);
}
