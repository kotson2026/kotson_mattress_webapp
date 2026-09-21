// Full-width YouTube hero directly below the navbar.
//
// Rules honoured here:
//  * Only a server-extracted video id is embedded — never raw iframe HTML.
//  * Muted + inline + loop (loop=1 & playlist=<id>) is ATTEMPTED, never promised: a visible
//    play action is always available because browsers may block autoplay.
//  * 16:9 aspect box keeps the whole frame visible at every width — no stretching, no cropping.
//  * Reduced-motion visitors get the poster first and choose to play.
//  * No logo or text is drawn over the footage.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { HeroVideo } from "@/lib/crmTypes";

export default function VideoHero() {
  const { data } = useQuery({
    queryKey: ["hero-video"],
    queryFn: () => apiGet<HeroVideo>("/content/hero-video"),
    staleTime: 60_000,
  });

  const [prefersReduced, setPrefersReduced] = useState(false);
  const [started, setStarted] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  if (!data?.configured) {
    // Honest empty state — no invented media.
    return (
      <section className="w-full bg-brand-sand" aria-label="Kotson video">
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <div className="absolute inset-0 flex items-center justify-center" data-testid="hero-video-unconfigured">
            <p className="px-6 text-center text-sm text-muted-foreground">
              No hero video is configured yet. Add a YouTube URL in Website Studio.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Reduced motion: poster first, explicit opt-in. Otherwise attempt muted autoplay.
  const autoplayAttempted = !prefersReduced;
  const showFrame = started || autoplayAttempted;
  const src = started ? `${data.embed_url}&autoplay=1` : data.embed_url;

  return (
    <section className="w-full bg-black" aria-label="Kotson video">
      {/* Edge-to-edge, full frame preserved via a 16:9 box (never cropped or stretched). */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }} data-testid="hero-video">
        {/* Poster: shown while loading, when playback is unavailable, and first for reduced motion.
            Owner poster wins; until one is uploaded we fall back to the video's own YouTube thumbnail. */}
        {data.poster_url || data.poster_fallback_url ? (
          <img
            src={data.poster_url ?? data.poster_fallback_url ?? ""}
            alt={data.poster_alt ?? "Kotson mattress video"}
            className="absolute inset-0 h-full w-full object-contain"
            data-testid={data.poster_url ? "hero-video-poster" : "hero-video-poster-fallback"}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center bg-brand-charcoal"
            data-testid="hero-video-poster-pending"
          >
            <p className="px-6 text-center text-[11px] uppercase tracking-[0.25em] text-brand-sand/70">
              Poster image pending owner upload
            </p>
          </div>
        )}

        {showFrame && (
          <iframe
            ref={frameRef}
            src={src}
            title="Kotson Mattress"
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            data-testid="hero-video-iframe"
          />
        )}

        {/* Always-available play action: autoplay is never guaranteed. */}
        {!started && (
          <button
            type="button"
            onClick={() => setStarted(true)}
            aria-label="Play Kotson video with sound controls"
            data-testid="hero-video-play-button"
            className="absolute bottom-4 left-4 z-10 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/90 px-5 text-sm font-semibold text-brand-charcoal shadow-lg outline-none backdrop-blur transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-white"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {prefersReduced ? "Play video" : "Tap to play with controls"}
          </button>
        )}
      </div>
    </section>
  );
}
