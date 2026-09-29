// Official Kotson transparent wordmark asset.
// Letter shapes, the integrated leaf and the original colours are untouched.
// Never recreate this mark with a font.
// Served from frontend/public/brand/ — a plain URL keeps this out of the TS module graph.
const TRANSPARENT_LOGO = "/brand/kotson-logo-transparent.png";
const LIGHT_LOGO = "/brand/kotson-logo-light.png";

interface Props {
  /** When true, renders the light/white version for dark surfaces (e.g. brand-deep green) */
  light?: boolean;
  className?: string;
}

export default function LogoMark({ light = false, className = "" }: Props) {
  return (
    <img
      src={light ? LIGHT_LOGO : TRANSPARENT_LOGO}
      alt="Kotson"
      width={1024}
      height={342}
      decoding="async"
      className={`block h-auto object-contain shrink-0 ${className || "w-[150px] sm:w-[165px] lg:w-[175px]"}`}
      data-testid="brand-wordmark"
    />
  );
}
