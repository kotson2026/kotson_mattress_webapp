import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterToolbarProps {
  children: ReactNode;
  rightActions?: ReactNode;
  className?: string;
  testId?: string;
}

export default function FilterToolbar({
  children,
  rightActions,
  className = "",
  testId,
}: FilterToolbarProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
        {children}
      </div>
      {rightActions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {rightActions}
        </div>
      )}
    </div>
  );
}
