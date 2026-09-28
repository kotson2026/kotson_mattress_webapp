import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  testId?: string;
}

export default function SectionCard({
  title,
  description,
  headerAction,
  children,
  className = "",
  bodyClassName = "",
  testId,
}: SectionCardProps) {
  return (
    <section
      data-testid={testId}
      className={cn(
        "rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs transition-shadow",
        className
      )}
    >
      {(title || description || headerAction) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
          <div>
            {typeof title === "string" ? (
              <h2 className="font-heading text-base sm:text-lg font-bold text-foreground">
                {title}
              </h2>
            ) : (
              title
            )}
            {description && (
              <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
