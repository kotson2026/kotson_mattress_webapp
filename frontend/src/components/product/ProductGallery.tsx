import { useState, useRef } from "react";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({});
  const [isZooming, setIsZooming] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const activeImage = images[activeIndex] || "";

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;

    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: "scale(1.5)",
    });
    setIsZooming(true);
  };

  const handleMouseLeave = () => {
    setZoomStyle({
      transformOrigin: "center",
      transform: "scale(1)",
    });
    setIsZooming(false);
  };

  if (!images || images.length === 0) {
    return (
      <div className="flex aspect-[4/3] lg:aspect-square w-full items-center justify-center rounded-3xl bg-brand-sand/60 p-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-deep/60">
          Product Image Coming Soon
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative flex aspect-[4/3] lg:aspect-square w-full items-center justify-center overflow-hidden rounded-3xl bg-brand-sand/40 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={() => setIsZooming(true)}
      >
        {!imageError ? (
          <img
            ref={imgRef}
            src={activeImage}
            alt={productName}
            className={cn(
              "h-full w-full object-contain object-center transition-transform duration-300 ease-out will-change-transform",
              isZooming ? "scale-150" : "scale-100"
            )}
            style={isZooming ? zoomStyle : undefined}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-deep/60">
              Image Unavailable
            </span>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveIndex(idx);
                setImageError(false);
              }}
              className={cn(
                "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200",
                activeIndex === idx
                  ? "border-brand-deep shadow-sm"
                  : "border-transparent bg-brand-sand/40 hover:border-brand-deep/30"
              )}
              aria-label={`View image ${idx + 1}`}
              aria-current={activeIndex === idx ? "true" : "false"}
            >
              <img
                src={img}
                alt={`${productName} thumbnail ${idx + 1}`}
                className="h-full w-full object-contain p-2"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
