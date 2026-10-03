import React from "react";
import { Link } from "react-router-dom";
import LogoMark from "@/components/layout/LogoMark";

interface AuthBrandPanelProps {
  eyebrow?: string;
  heading?: string;
  description?: React.ReactNode;
  /** Backward-compatible alias for description */
  subheading?: React.ReactNode;
}

/**
 * Shared AuthBrandPanel for Sign In & Sign Up screens.
 * Renders the official Kotson light logo directly over Kotson signature deep green (bg-[#467065])
 * with editorial typography, restrained accent line, and subtle legal footer.
 */
export default function AuthBrandPanel({
  eyebrow = "WELCOME BACK",
  heading = "Better sleep starts naturally.",
  description,
  subheading,
}: AuthBrandPanelProps) {
  const contentDescription = description ?? subheading ?? null;

  return (
    <div
      className="hidden flex-col justify-between bg-[#467065] p-9 sm:p-11 lg:p-12 xl:p-14 text-white lg:flex relative select-none"
      data-testid="auth-brand-panel"
    >
      {/* Top Left: Official Kotson Logo (White & Green transparent variant for dark backgrounds) */}
      <Link
        to="/"
        className="inline-block self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-sm"
        aria-label="Kotson Home"
      >
        <LogoMark
          light
          className="w-[150px] sm:w-[165px] lg:w-[175px] h-auto object-contain opacity-100"
        />
      </Link>

      {/* Main Messaging Center */}
      <div className="my-auto py-10">
        {/* Eyebrow */}
        {eyebrow && (
          <span className="block text-xs sm:text-[13px] font-medium uppercase tracking-[0.15em] text-[#C4D9A9] mb-3">
            {eyebrow}
          </span>
        )}

        {/* Main Heading: Editorial Serif */}
        <h2 className="font-serif text-[38px] sm:text-[44px] lg:text-[48px] font-normal leading-[1.08] tracking-tight text-white max-w-[460px]">
          {heading}
        </h2>

        {/* Restrained Kotson Accent Line */}
        <div
          className="w-11 h-[2px] bg-[#7C9C59] my-6"
          aria-hidden="true"
        />

        {/* Supporting Copy */}
        {contentDescription && (
          <p className="max-w-[460px] text-white/85 text-base sm:text-[17px] leading-[1.6] font-normal">
            {contentDescription}
          </p>
        )}
      </div>

      {/* Subtle Legal Company Name */}
      <p className="text-[11px] sm:text-xs text-white/65 tracking-[0.14em] uppercase font-medium">
        KOTSON NATURALS PRIVATE LIMITED
      </p>
    </div>
  );
}
