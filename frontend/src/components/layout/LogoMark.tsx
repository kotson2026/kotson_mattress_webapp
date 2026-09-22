// Official Kotson wordmark — a transparent crop of the supplied brand file.
// Letter shapes, the integrated leaf and the original colours are untouched; the TM symbol,
// "NATURALS", the green dot and the tagline are excluded per brand direction.
// Never recreate this mark with a font.
// Served from frontend/public/brand/ — a plain URL keeps this out of the TS module graph.
const WORDMARK = "/brand/kotson-wordmark.png";

interface Props {
  /** Footer/dark surfaces: renders the mark on a light plaque so the green stays legible. */
  light?: boolean;
  className?: string;
}

export default function LogoMark({ light = false, className = "" }: Props) {
  const img = (
    <img
      src={WORDMARK}
      alt="Kotson"
      width={1601}
      height={184}
      decoding="async"
      className={`block w-auto shrink-0 object-contain ${light ? "h-5 sm:h-6" : "h-3 sm:h-3.5 lg:h-[18px]"} ${className}`}
      data-testid="brand-wordmark"
    />
  );
  // The mark keeps its own colours on every surface; the dark footer gets a light backing plate
  // rather than any recolouring of the artwork.
  return light ? <span className="inline-flex rounded-xl bg-brand-sand px-3 py-2">{img}</span> : img;
}
