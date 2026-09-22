import { Link } from "react-router-dom";
import type { DockState } from "./types";

const WORDMARK = "/brand/kotson-wordmark.png";

interface Props {
  state: DockState;
}

export default function SleepDockLogo({ state }: Props) {
  const isMinimal = state === "minimal";
  const isCompact = state === "compact";

  return (
    <Link
      to="/"
      aria-label="Kotson Homepage"
      data-testid="sleep-dock-logo-link"
      className="group relative flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf focus-visible:ring-offset-2"
    >
      <img
        src={WORDMARK}
        alt="KOTSON"
        width={1601}
        height={184}
        decoding="async"
        className={`block w-auto shrink-0 object-contain transition-all duration-300 ease-out ${
          isCompact
            ? "h-3.5 sm:h-[15px] lg:h-[15.5px]"
            : "h-3.5 sm:h-4 lg:h-[17px]"
        }`}
        data-testid="sleep-dock-wordmark"
      />
    </Link>
  );
}
