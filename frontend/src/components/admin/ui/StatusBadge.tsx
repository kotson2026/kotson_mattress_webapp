import { cn } from "@/lib/utils";

export type StatusVariant = "success" | "warning" | "danger" | "neutral" | "info" | "brand";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
  showDot?: boolean;
}

export function getSemanticStatusVariant(status: string): StatusVariant {
  const s = status.toLowerCase().replace(/[-_]/g, " ");

  if (
    s.includes("success") ||
    s.includes("complete") ||
    s.includes("approved") ||
    s.includes("paid") ||
    s.includes("active") ||
    s.includes("delivered") ||
    s.includes("converted") ||
    s.includes("verified") ||
    s.includes("settled")
  ) {
    return "success";
  }

  if (
    s.includes("pending") ||
    s.includes("review") ||
    s.includes("hold") ||
    s.includes("progress") ||
    s.includes("waiting") ||
    s.includes("transit") ||
    s.includes("processing") ||
    s.includes("due") ||
    s.includes("low") ||
    s.includes("expiring")
  ) {
    return "warning";
  }

  if (
    s.includes("fail") ||
    s.includes("reject") ||
    s.includes("error") ||
    s.includes("cancel") ||
    s.includes("disqualified") ||
    s.includes("expired") ||
    s.includes("critical") ||
    s.includes("out of stock") ||
    s.includes("lost") ||
    s.includes("exception")
  ) {
    return "danger";
  }

  if (s.includes("info") || s.includes("shipped") || s.includes("packed")) {
    return "info";
  }

  return "neutral";
}

const variantStyles: Record<StatusVariant, { badge: string; dot: string }> = {
  success: {
    badge: "bg-emerald-50 text-emerald-900 border-emerald-300/80 font-semibold",
    dot: "bg-emerald-500",
  },
  warning: {
    badge: "bg-amber-50 text-amber-900 border-amber-300/80 font-semibold",
    dot: "bg-amber-500",
  },
  danger: {
    badge: "bg-rose-50 text-rose-900 border-rose-300/80 font-semibold",
    dot: "bg-rose-500",
  },
  info: {
    badge: "bg-sky-50 text-sky-900 border-sky-300/80 font-semibold",
    dot: "bg-sky-500",
  },
  brand: {
    badge: "bg-brand-leaf/15 text-brand-charcoal border-brand-leaf/30 font-semibold",
    dot: "bg-brand-leaf",
  },
  neutral: {
    badge: "bg-muted/80 text-foreground/80 border-border font-medium",
    dot: "bg-muted-foreground",
  },
};

export default function StatusBadge({
  status,
  variant,
  className = "",
  showDot = true,
}: StatusBadgeProps) {
  const chosenVariant = variant || getSemanticStatusVariant(status);
  const styles = variantStyles[chosenVariant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] tracking-wide shrink-0 transition-colors",
        styles.badge,
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", styles.dot)} />
      )}
      <span className="capitalize">{status.replace(/_/g, " ")}</span>
    </span>
  );
}
