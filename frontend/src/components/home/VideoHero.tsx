// Full-width native HTML5 video hero directly below the navbar.
//
// Features:
//  * Native HTML5 <video> element with direct MP4 URL playing continuously in a loop.
//  * Edge-to-edge full width without side margins; object-cover preserves the subject without stretching.
//  * Autoplay muted, loop, and playsInline (no pause button, no PiP overlay).
//  * Optional poster image for loading and fallback.
//  * Reduced motion (prefers-reduced-motion: reduce) visitors see the poster first.
//  * Explicit error handling: reports exact host or media playback errors (never silently reverts to YouTube).
//  * Preserves clean aesthetic: no headlines, 3D mattress, labels, or statistic cards.

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { HeroVideo } from "@/lib/crmTypes";

const DEFAULT_HERO_MP4 =
  "https://videotourl.com/videos/1790000883825-6f099fbc-0ae3-4af8-8859-7bb8331633ba.mp4";

export default function VideoHero() {
  const { data } = useQuery({
    queryKey: ["hero-video"],
    queryFn: () => apiGet<HeroVideo>("/content/hero-video"),
    staleTime: 60_000,
  });

  const [prefersReduced, setPrefersReduced] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Detect prefers-reduced-motion preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const videoUrl =
    data?.video_url && data.video_url.trim().length > 0
      ? data.video_url.trim()
      : DEFAULT_HERO_MP4;

  const posterUrl = data?.poster_url || data?.poster_fallback_url || undefined;
  const posterAlt = data?.poster_alt || "Kotson mattress hero video";

  // Handle autoplay when reduced motion is not requested
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (prefersReduced) {
      v.pause();
      return;
    }

    v.muted = true;
    const playPromise = v.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setPlaybackError(null);
        })
        .catch((err) => {
          console.warn("Autoplay muted prevented by browser policy:", err);
        });
    }
  }, [prefersReduced, videoUrl]);

  const handleVideoError = () => {
    const v = videoRef.current;
    const mediaErr = v?.error;
    let detail = "Video host blocked or could not load video stream.";
    if (mediaErr) {
      switch (mediaErr.code) {
        case 1: // MEDIA_ERR_ABORTED
          detail = "Video loading was aborted.";
          break;
        case 2: // MEDIA_ERR_NETWORK
          detail = "Network error: video host could not be reached.";
          break;
        case 3: // MEDIA_ERR_DECODE
          detail = "Video decoding error: media stream corrupted.";
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          detail = `Host blocked playback or media format not supported (${videoUrl}).`;
          break;
        default:
          if (mediaErr.message) detail = mediaErr.message;
      }
    }
    setPlaybackError(detail);
  };

  if (data && data.configured === false) {
    return (
      <section className="relative w-full min-h-svh bg-brand-sand" aria-label="Kotson video">
        <div
          className="absolute inset-0 flex items-center justify-center"
          data-testid="hero-video-unconfigured"
        >
          <p className="px-6 text-center text-sm text-muted-foreground">
            No hero video is configured yet. Add an MP4 video URL in Website Studio.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="hero relative w-full h-[100svh] min-h-[100svh] overflow-hidden m-0 p-0 bg-black"
      aria-label="Kotson hero video"
      data-testid="hero-video"
    >
      {/* Native HTML5 Video Player playing in loop, full bleed from y=0 behind the floating dock */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={posterUrl}
        autoPlay={!prefersReduced}
        muted
        loop
        playsInline
        disablePictureInPicture
        controls={false}
        preload="auto"
        onError={handleVideoError}
        className="hero-video absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
        data-testid="hero-video-element"
      />

      {/* Poster fallback when playback has an error or reduced motion before play */}
      {(playbackError || prefersReduced) && posterUrl && (
        <img
          src={posterUrl}
          alt={posterAlt}
          className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
          data-testid="hero-video-poster"
        />
      )}

      {/* Exact playback error overlay (never silently revert to YouTube) */}
      {playbackError && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 p-6 text-center text-white"
          data-testid="hero-video-error"
        >
          <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
          <h3 className="text-lg font-semibold text-white">Video Playback Failed</h3>
          <p className="mt-2 max-w-lg text-sm text-red-200">
            {playbackError}
          </p>
          <p className="mt-1 text-xs text-brand-sand/60 break-all max-w-xl">
            Source: {videoUrl}
          </p>
          <button
            type="button"
            onClick={() => {
              setPlaybackError(null);
              videoRef.current?.load();
              videoRef.current?.play().catch(() => {});
            }}
            className="mt-5 rounded-full bg-white/20 hover:bg-white/30 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white transition backdrop-blur"
          >
            Retry Video Playback
          </button>
        </div>
      )}
    </section>
  );
}
