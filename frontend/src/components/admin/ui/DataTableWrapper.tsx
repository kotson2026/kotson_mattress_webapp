import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataTableWrapperProps {
  children: ReactNode;
  className?: string;
  tableClassName?: string;
  footer?: ReactNode;
  testId?: string;
}

export default function DataTableWrapper({
  children,
  className = "",
  tableClassName = "",
  footer,
  testId,
}: DataTableWrapperProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "rounded-2xl border border-border bg-card shadow-xs overflow-hidden flex flex-col",
        className
      )}
    >
      <div className={cn("overflow-x-auto w-full", tableClassName)}>
        {children}
      </div>
      {footer && (
        <div className="border-t border-border/70 bg-card p-3 sm:p-4 shrink-0">
          {footer}
        </div>
      )}
    </div>
  );
}
