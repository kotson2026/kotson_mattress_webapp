import { Link } from "react-router-dom";
import LogoMark from "@/components/layout/LogoMark";

interface AuthBrandPanelProps {
  heading?: string;
  subheading?: React.ReactNode;
}

/**
 * Shared AuthBrandPanel for Sign In & Sign Up screens.
 * Renders the transparent Kotson logo directly over Kotson signature green (bg-brand-deep)
 * with zero white/cream pill wrappers, borders, or shadows.
 */
export default function AuthBrandPanel({
  heading = "Organic latex, made in India.",
  subheading = "Sign in to see your orders, addresses and your Refer & Earn link.",
}: AuthBrandPanelProps) {
  return (
    <div className="hidden flex-col justify-between bg-brand-deep p-12 text-white lg:flex">
      <Link
        to="/"
        className="inline-block self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-sm"
        aria-label="Kotson Home"
      >
        <LogoMark className="w-[190px] xl:w-[210px]" />
      </Link>

      <div className="my-auto py-12">
        <h2 className="font-heading text-4xl font-black leading-tight tracking-tight">
          {heading}
        </h2>
        <p className="mt-4 max-w-sm text-white/80 text-base leading-relaxed">
          {subheading}
        </p>
      </div>

      <p className="text-xs text-white/50 tracking-wider">
        KOTSON NATURALS PRIVATE LIMITED
      </p>
    </div>
  );
}
