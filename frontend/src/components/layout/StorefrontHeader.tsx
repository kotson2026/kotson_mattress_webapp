import { useLocation } from "react-router-dom";
import FloatingSleepDock from "@/components/layout/FloatingSleepDock";

export { default as LogoMark } from "@/components/layout/LogoMark";

export default function StorefrontHeader() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <>
      {/* Kotson Floating Sleep Dock Navigation */}
      <FloatingSleepDock />

      {/* Non-home pages safe-area spacer so content starts below the floating dock */}
      {!isHome && <div className="h-24 sm:h-28 lg:h-32 w-full" aria-hidden="true" />}
    </>
  );
}
