import * as React from 'react';

export type YouTubePlayer = {
  loadVideoById(videoId: string): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
};

export type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
      };
    }
  ) => YouTubePlayer;
  PlayerState: { PLAYING: number; ENDED: number };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  apiPromise ??= new Promise(resolve => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiPromise;
}

// 폴링 간격만큼 줄 전환이 늦어 보이므로, 체감 지연이 무시할 수준이 되는 값으로 유지한다.
const POLL_INTERVAL_MS = 100;

/**
 * YouTube IFrame Player를 마운트하고 재생 시간을 폴링하는 훅.
 * 모바일 자동재생 제한 때문에 최초 재생은 항상 사용자 탭으로 시작된다.
 */
export function useYouTubePlayer(videoId: string, onEnded?: () => void) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const playerRef = React.useRef<YouTubePlayer | null>(null);
  const loadedVideoIdRef = React.useRef(videoId);
  const [isReady, setIsReady] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  // 플레이어는 한 번만 만들기 때문에 콜백을 그대로 가두면 낡은 클로저가 남는다.
  // 갱신은 렌더가 아니라 커밋 후에 한다. 렌더는 버려질 수 있어서 그 안의 변경은 새면 안 된다.
  const onEndedRef = React.useRef(onEnded);
  React.useEffect(() => {
    onEndedRef.current = onEnded;
  });

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let player: YouTubePlayer | null = null;

    loadYouTubeApi().then(YT => {
      if (cancelled) return;
      const mount = document.createElement('div');
      container.appendChild(mount);
      player = new YT.Player(mount, {
        videoId: loadedVideoIdRef.current,
        // 재생/일시정지와 탐색은 우리 오버레이와 가사 탭이 담당한다. YouTube 컨트롤을 끄면
        // 시크 직후 컨트롤 바가 깜빡이지 않고, 앨범 아트만 깔끔하게 남는다.
        playerVars: { playsinline: 1, rel: 0, controls: 0, iv_load_policy: 3 },
        events: {
          onReady: () => {
            if (!cancelled) setIsReady(true);
          },
          onStateChange: event => {
            if (cancelled) return;
            setIsPlaying(event.data === YT.PlayerState.PLAYING);
            // 길이는 메타데이터가 도착해야 나온다. 상태가 바뀔 때마다 다시 읽어 둔다.
            setDuration(player?.getDuration() ?? 0);
            if (event.data === YT.PlayerState.ENDED) onEndedRef.current?.();
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      playerRef.current = null;
      player?.destroy();
      container.replaceChildren();
    };
  }, []);

  React.useEffect(() => {
    if (!isReady || loadedVideoIdRef.current === videoId) return;
    loadedVideoIdRef.current = videoId;
    setTime(0);
    setDuration(0);
    playerRef.current?.loadVideoById(videoId);
  }, [isReady, videoId]);

  React.useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setTime(player.getCurrentTime());
      setDuration(player.getDuration());
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  const seekTo = React.useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
    playerRef.current?.playVideo();
    setTime(seconds);
  }, []);

  // 모바일 자동재생 제한 때문에 반드시 사용자 탭 핸들러 안에서 호출되어야 한다.
  const togglePlay = React.useCallback(() => {
    if (isPlaying) playerRef.current?.pauseVideo();
    else playerRef.current?.playVideo();
  }, [isPlaying]);

  return { containerRef, time, duration, isPlaying, seekTo, togglePlay };
}
