"use client";

import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";

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
    const readyCalled = useRef(false);

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => {
        if (playerRef.current) {
          return playerRef.current.getCurrentTime?.() ?? 0;
        }
        return 0;
      },
      play: () => playerRef.current?.playVideo?.(),
      pause: () => playerRef.current?.pauseVideo?.(),
    }));

    useEffect(() => {
      // Load YouTube IFrame API
      if (typeof window === "undefined") return;

      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).onYouTubeIframeAPIReady = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        playerRef.current = new (window as any).YT.Player(
          containerRef.current!,
          {
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
                if (!readyCalled.current) {
                  readyCalled.current = true;
                  onReady?.();
                }
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onStateChange: (e: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (e.data === (window as any).YT.PlayerState.ENDED) {
                  onEnded?.();
                }
              },
            },
          }
        );
      };

      return () => {
        playerRef.current?.destroy?.();
      };
    }, [videoId, onReady, onEnded]);

    useEffect(() => {
      if (!playerRef.current) return;
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
