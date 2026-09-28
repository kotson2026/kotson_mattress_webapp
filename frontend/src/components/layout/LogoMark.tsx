// Official Kotson transparent wordmark asset.
// Letter shapes, the integrated leaf and the original colours are untouched.
// Never recreate this mark with a font.
// Served from frontend/public/brand/ — a plain URL keeps this out of the TS module graph.
const TRANSPARENT_LOGO = "/brand/kotson-logo-transparent.png";

interface Props {
  /** Optional backward-compatible flag (no-op: white/cream backing bar removed per brand regression fix) */
  light?: boolean;
  className?: string;
}

export default function LogoMark({ className = "" }: Props) {
  return (
    <img
      src={TRANSPARENT_LOGO}
      alt="Kotson"
      width={1024}
      height={342}
      decoding="async"
      className={`block h-auto object-contain shrink-0 ${className || "w-[160px] sm:w-[180px] lg:w-[200px]"}`}
      data-testid="brand-wordmark"
    />
  );
}
