import type { CSSProperties } from "react";

interface MattressLayersCardProps {
  style?: CSSProperties;
  className?: string;
}

export default function MattressLayersCard({ style, className = "" }: MattressLayersCardProps) {
  return (
    <div
      style={style}
      className={`relative aspect-square rounded-2xl sm:rounded-3xl overflow-hidden border border-[#E8E3D8] shadow-xs select-none bg-[#FAF9F5] ${className}`}
    >
      <picture className="w-full h-full block">
        <source srcSet="/mattress-layers/mattress-construction.webp" type="image/webp" />
        <img
          src="/mattress-layers/mattress-construction.png"
          alt="Kotson 3-Layer Mattress Construction: 100% Pure Bamboo Cover, Thin Cotton Zip Cover, and GOLS-Certified 100% Organic Latex Core"
          width={1920}
          height={1920}
          className="w-full h-full object-cover block select-none"
          loading="eager"
        />
      </picture>
    </div>
  );
}
