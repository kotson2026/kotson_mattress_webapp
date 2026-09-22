// Slim scrolling announcement bar. Sits ABOVE the navbar.
// Seamless loop: the message list is rendered twice and translated by exactly -50%,
// so the second copy is in the first copy's place when the animation restarts — no jump.
// Height is fixed (h-9) so the navbar and video hero never shift while data loads.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { Announcement } from "@/lib/crmTypes";

function Item({ a }: { a: Announcement }) {
  const label = (
    <span className="whitespace-nowrap text-xs font-medium tracking-wide text-white sm:text-sm">{a.label}</span>
  );
  if (!a.href) {
    return (
      <span className="flex items-center px-6 sm:px-10" data-testid={`announcement-item-${a.id}`}>
        {label}
      </span>
    );
  }
  const cls =
    "flex min-h-9 items-center px-6 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-brand-leaf sm:px-10";
  return a.href.startsWith("/") ? (
    <Link to={a.href} className={cls} data-testid={`announcement-item-${a.id}`}>
      {label}
    </Link>
  ) : (
    <a href={a.href} target="_blank" rel="noreferrer noopener" className={cls} data-testid={`announcement-item-${a.id}`}>
      {label}
    </a>
  );
}

export default function AnnouncementBar() {
  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => apiGet<Announcement[]>("/content/announcements"),
    staleTime: 60_000,
  });
  const items = data ?? [];

  // Reserve the height even before data arrives, so nothing below it shifts.
  if (items.length === 0) {
    return <div className="h-9 w-full bg-brand-leaf" aria-hidden="true" data-testid="announcement-bar-placeholder" />;
  }

  // Enough repetitions that the track always overflows the widest viewport.
  const loop = items.length < 4 ? [...items, ...items, ...items] : [...items, ...items];

  return (
    <div
      className="group h-9 w-full overflow-hidden bg-brand-leaf"
      role="region"
      aria-label="Store announcements"
      data-testid="announcement-bar"
    >
      {/* Static, non-moving list for reduced-motion visitors (CSS-driven, see index.css). */}
      <div className="marquee-track flex h-9 w-max items-center motion-reduce:animate-none">
        {loop.map((a, i) => (
          <Item key={`${a.id}-${i}`} a={a} />
        ))}
        {/* duplicate copy makes the -50% translate seamless */}
        {loop.map((a, i) => (
          <span key={`dup-${a.id}-${i}`} aria-hidden="true">
            <Item a={a} />
          </span>
        ))}
      </div>
    </div>
  );
}
