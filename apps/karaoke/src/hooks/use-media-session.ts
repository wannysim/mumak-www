import * as React from 'react';

/**
 * OS의 재생 컨트롤과 앱을 연결한다.
 *
 * 맥북 F7·F8·F9(그리고 헤드셋 버튼, 잠금화면·Now Playing 위젯, 안드로이드 알림 컨트롤)는
 * 페이지에 `keydown`으로 오지 않는다. OS가 먼저 가로채 브라우저에 미디어 키로 넘기고,
 * 브라우저는 이를 Media Session 액션으로 바꿔 준다. 그래서 키 핸들러가 아니라 이 API가 유일한 경로다.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler
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

  React.useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    // MediaMetadata는 Media Session을 지원해도 노출이 안 된 브라우저가 있다.
    if (typeof MediaMetadata === 'function') session.metadata = new MediaMetadata({ title, artist });
    session.playbackState = isPlaying ? 'playing' : 'paused';
  }, [artist, isPlaying, title]);
}
