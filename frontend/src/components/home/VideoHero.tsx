// Full-width native HTML5 video hero directly below the navbar.
//
// Desktop: 100svh full-bleed background video hero with object-cover.
// Mobile: Clean 16:9 controlled viewport that clips the blank portrait canvas
//         and Kapwing watermark, displaying the full-width actual video content.

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { HeroVideo } from "@/lib/crmTypes";

const DEFAULT_HERO_MP4 =
  "https://videotourl.com/videos/1790000883825-6f099fbc-0ae3-4af8-8859-7bb8331633ba.mp4";
const MOBILE_HERO_MP4 =
  "https://videotourl.com/videos/1790429244131-10a323e5-3454-4ca4-b356-dc938d876587.mp4";

export default function VideoHero() {
  const { data } = useQuery({
    queryKey: ["hero-video"],
    queryFn: () => apiGet<HeroVideo>("/content/hero-video"),
    staleTime: 60_000,
  });

  const [prefersReduced, setPrefersReduced] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const desktopVideoRef = useRef<HTMLVideoElement | null>(null);
  const mobileVideoRef = useRef<HTMLVideoElement | null>(null);

  // Detect prefers-reduced-motion preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const desktopVideoUrl =
    data?.video_url && data.video_url.trim().length > 0
      ? data.video_url.trim()
      : DEFAULT_HERO_MP4;

  const posterUrl = data?.poster_url || data?.poster_fallback_url || undefined;
  const posterAlt = data?.poster_alt || "Kotson mattress hero video";

  // Handle autoplay for active player
  useEffect(() => {
    if (prefersReduced) {
      desktopVideoRef.current?.pause();
      mobileVideoRef.current?.pause();
      return;
    }

    const tryPlay = (v: HTMLVideoElement | null) => {
      if (!v) return;
      v.muted = true;
      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setPlaybackError(null))
          .catch((err) => {
            console.warn("Autoplay muted prevented by browser policy:", err);
          });
      }
    };

    tryPlay(desktopVideoRef.current);
    tryPlay(mobileVideoRef.current);
  }, [prefersReduced, desktopVideoUrl]);

  const handleVideoError = (src: string) => {
    return () => {
      const v = mobileVideoRef.current || desktopVideoRef.current;
      const mediaErr = v?.error;
      let detail = "Video host blocked or could not load video stream.";
      if (mediaErr) {
        switch (mediaErr.code) {
          case 1:
            return; // ignore abort
          case 2:
            detail = "Network error: video host could not be reached.";
            break;
          case 3:
            detail = "Video decoding error: media stream corrupted.";
            break;
          case 4:
            detail = `Host blocked playback or media format not supported (${src}).`;
            break;
          default:
            if (mediaErr.message) detail = mediaErr.message;
        }
        setPlaybackError(detail);
      }
    };
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
    <>
      {/* ══════════════════════════════════════════════════════════════
          DESKTOP & TABLET HERO (>= 768px) — 100% UNCHANGED
          Preserves approved 100svh desktop full bleed & 450px tablet
          ══════════════════════════════════════════════════════════════ */}
      <section
        className="hidden md:block relative w-full md:h-[450px] lg:h-[100svh] min-h-0 lg:min-h-[100svh] overflow-hidden m-0 p-0 bg-black"
        aria-label="Kotson hero video"
        data-testid="hero-video"
      >
        <video
          ref={desktopVideoRef}
          src={desktopVideoUrl}
          poster={posterUrl}
          autoPlay={!prefersReduced}
          muted
          loop
          playsInline
          disablePictureInPicture
          controls={false}
          preload="metadata"
          onError={handleVideoError(desktopVideoUrl)}
          className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
          data-testid="hero-video-element"
        >
          <source src={desktopVideoUrl} type="video/mp4" />
        </video>

        {/* Poster fallback */}
        {(playbackError || prefersReduced) && posterUrl && (
          <img
            src={posterUrl}
            alt={posterAlt}
            className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
          />
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════
          MOBILE HERO (< 768px) — CLEAN RESPONSIVE MEDIA ELEMENT
          width: 100%; height: auto; natural aspect ratio; no crop
          ══════════════════════════════════════════════════════════════ */}
      <section
        className="mobile-hero kotson-mobile-hero block md:hidden"
        aria-label="Kotson mobile hero video"
        data-testid="hero-video-mobile"
      >
        <video
          ref={mobileVideoRef}
          src={desktopVideoUrl}
          poster={posterUrl}
          autoPlay={!prefersReduced}
          muted
          loop
          playsInline
          disablePictureInPicture
          controls={false}
          preload="metadata"
          aria-hidden="true"
          onError={handleVideoError(desktopVideoUrl)}
          className="mobile-hero-video kotson-mobile-hero__video"
          data-testid="hero-video-mobile-element"
        >
          <source src={desktopVideoUrl} type="video/mp4" />
        </video>
      </section>

      {/* Authoritative Single Mobile Hero CSS */}
      <style>{`
        @media (max-width: 767px) {
          .mobile-hero,
          .kotson-mobile-hero {
            position: relative;
            width: 100%;
            aspect-ratio: 1920 / 1010;
            margin: 0;
            padding: 0;
            overflow: hidden;
            line-height: 0;
            background: #F7F4EE;
          }

          .mobile-hero video,
          .mobile-hero-video,
          .kotson-mobile-hero__video {
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 100%;
            height: auto;
            max-width: none;
            margin: 0;
            padding: 0;
            display: block;
            object-fit: initial;
          }
        }
      `}</style>
    </>
  );
}
