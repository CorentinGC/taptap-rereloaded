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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerRef = useRef<any>(null);
    const playerReady = useRef(false);
    const playingRef = useRef(playing);
    const onReadyRef = useRef(onReady);
    const onEndedRef = useRef(onEnded);

    useEffect(() => {
      onReadyRef.current = onReady;
      onEndedRef.current = onEnded;
      playingRef.current = playing;
    });

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => {
        if (playerReady.current && playerRef.current) {
          return playerRef.current.getCurrentTime?.() ?? 0;
        }
        return 0;
      },
      play: () => {
        if (playerReady.current) playerRef.current?.playVideo?.();
      },
      pause: () => {
        if (playerReady.current) playerRef.current?.pauseVideo?.();
      },
    }));

    const initPlayer = useCallback(() => {
      if (!containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT;
      if (!YT?.Player) return;

      playerRef.current = new YT.Player(containerRef.current, {
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
            playerReady.current = true;
            onReadyRef.current?.();
            // If playing was already requested, start now
            if (playingRef.current) {
              playerRef.current?.playVideo?.();
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
        playerRef.current?.destroy?.();
        playerRef.current = null;
      };
    }, [initPlayer]);

    // Control playback when playing prop changes
    useEffect(() => {
      if (!playerReady.current || !playerRef.current) return;
      if (playing) {
        playerRef.current.playVideo?.();
      } else {
        playerRef.current.pauseVideo?.();
      }
    }, [playing]);

    return (
      <div className="absolute top-4 right-4 w-64 h-36 rounded-lg overflow-hidden shadow-2xl border border-zinc-700 z-10">
        <div ref={containerRef} />
      </div>
    );
  }
);
