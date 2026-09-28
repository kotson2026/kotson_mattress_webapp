import { type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  icon?: ReactNode;
  trend?: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
  testId?: string;
}

export default function MetricCard({
  label,
  value,
  subtext,
  icon,
  trend,
  badge,
  footer,
  onClick,
  className = "",
  testId,
}: MetricCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-200",
        isClickable && "group cursor-pointer hover:-translate-y-0.5 hover:border-brand-leaf/50 hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          {trend}
          {icon}
          {isClickable && (
            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-deep" />
          )}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {value}
        </span>
        {subtext && typeof subtext === "string" ? (
          <span className="text-xs font-medium text-muted-foreground">{subtext}</span>
        ) : (
          subtext
        )}
      </div>

      {footer && (
        <div className="mt-2.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
