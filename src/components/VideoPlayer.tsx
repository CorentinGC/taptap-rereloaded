"use client";

import { forwardRef, useImperativeHandle, useRef, useEffect, useCallback } from "react";

export interface VideoPlayerRef {
  getCurrentTime: () => number;
  play: () => void;
  pause: () => void;
}

interface VideoPlayerProps {
  videoId: string;
  playing: boolean;
  onReady?: () => void;
  onEnded?: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  function VideoPlayer({ videoId, playing, onReady, onEnded }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const iframeIdRef = useRef<string | null>(null);
    const playerReady = useRef(false);
    const playingRef = useRef(playing);
    const onReadyRef = useRef(onReady);
    const onEndedRef = useRef(onEnded);

    useEffect(() => {
      onReadyRef.current = onReady;
      onEndedRef.current = onEnded;
      playingRef.current = playing;
    });

    // Helper to get the actual YT player with all methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function getPlayer(): any {
      if (!iframeIdRef.current) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT;
      if (!YT?.get) return null;
      return YT.get(iframeIdRef.current) ?? null;
    }

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => {
        if (!playerReady.current) return 0;
        const player = getPlayer();
        return player?.getCurrentTime?.() ?? 0;
      },
      play: () => {
        if (!playerReady.current) return;
        getPlayer()?.playVideo?.();
      },
      pause: () => {
        if (!playerReady.current) return;
        getPlayer()?.pauseVideo?.();
      },
    }));

    const initPlayer = useCallback(() => {
      if (!containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT;
      if (!YT?.Player) return;

      const player = new YT.Player(containerRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          disablekb: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            // Get the iframe ID for YT.get() usage
            const iframe = player.getIframe?.();
            if (iframe) iframeIdRef.current = iframe.id;
            playerReady.current = true;
            onReadyRef.current?.();
            if (playingRef.current) {
              getPlayer()?.playVideo?.();
            }
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            if (e.data === YT.PlayerState.ENDED) {
              onEndedRef.current?.();
            }
          },
        },
      });
    }, [videoId]);

    useEffect(() => {
      if (typeof window === "undefined") return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT;

      if (YT?.Player) {
        initPlayer();
      } else {
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(tag);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prevCallback = (window as any).onYouTubeIframeAPIReady;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).onYouTubeIframeAPIReady = () => {
          prevCallback?.();
          initPlayer();
        };
      }

      return () => {
        playerReady.current = false;
        const player = getPlayer();
        player?.destroy?.();
        iframeIdRef.current = null;
      };
    }, [initPlayer]);

    // Control playback when playing prop changes
    useEffect(() => {
      if (!playerReady.current) return;
      if (playing) {
        getPlayer()?.playVideo?.();
      } else {
        getPlayer()?.pauseVideo?.();
      }
    }, [playing]);

    return (
      <div className="absolute top-4 right-4 w-64 h-36 rounded-lg overflow-hidden shadow-2xl border border-zinc-700 z-10">
        <div ref={containerRef} />
      </div>
    );
  }
);
