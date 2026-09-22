import { useState } from "react";
import { cn } from "@/lib/utils";

export interface Zone {
  id: string;
  name: string;
  pressure: string;
  firmness: string;
  description: string;
}

export const DEFAULT_ZONES: Zone[] = [
  { id: "zone-1", name: "Head & Neck", pressure: "Gentle Cradle", firmness: "Medium-Soft", description: "Micro-pin core channels alleviate cervical pressure and align the upper spine naturally." },
  { id: "zone-2", name: "Back & Shoulders", pressure: "Pressure Relief", firmness: "Contoured Soft", description: "Expanded ventilation cavities allow broad shoulder blades to sink without pinch points." },
  { id: "zone-3", name: "Lower Back & Lumbar", pressure: "Targeted Support", firmness: "Firm Adaptive", description: "Reinforced latex density bridges the lumbar gap to eliminate morning back stiffness." },
  { id: "zone-4", name: "Hips & Thighs", pressure: "Even Displacement", firmness: "Dynamic Medium", description: "Progressive compression distributes pelvic weight evenly across sleep transitions." },
  { id: "zone-5", name: "Knees", pressure: "Ergonomic Balance", firmness: "Medium-Firm", description: "Zero-rebound resilience preserves a neutral knee joint angle in side and back sleeping." },
  { id: "zone-6", name: "Lower Legs", pressure: "Circulation Flow", firmness: "Soft Airy", description: "Aerated cellular grid prevents pressure constriction for unhindered blood flow." },
  { id: "zone-7", name: "Feet", pressure: "Weightless Finish", firmness: "Gentle Float", description: "Soft terminal cushion suspends heels and feet in a buoyant, gravity-free state." },
];

// Interactive seven body support zones: hover/click/keyboard; single-column selector on mobile.
export default function SevenZones({ zones }: { zones?: Zone[] }) {
  // Never trust an empty/partial CMS payload: blocks load async and may parse to [].
  const list = zones && zones.length > 0 ? zones : DEFAULT_ZONES;
  const [active, setActive] = useState<string>(list[2]?.id ?? list[0].id);
  const zone = list.find((z) => z.id === active) ?? list[0];

  return (
    <div className="grid gap-8 md:grid-cols-2 md:items-center">
      <div
        className="mx-auto flex w-full max-w-xs flex-col items-center gap-1 rounded-2xl bg-brand-deep/5 p-6"
        role="listbox"
        aria-label="Body support zones"
        data-testid="zones-diagram"
      >
        <div className="h-10 w-10 rounded-full bg-brand-deep/20" aria-hidden="true" />
        {list.map((z) => (
          <button
            key={z.id}
            role="option"
            aria-selected={z.id === active}
            data-testid={`zone-select-${z.id}`}
            onMouseEnter={() => setActive(z.id)}
            onFocus={() => setActive(z.id)}
            onClick={() => setActive(z.id)}
            className={cn(
              "min-h-11 w-full rounded-lg border px-4 text-left text-sm font-medium transition-all",
              z.id === active
                ? "border-brand-leaf bg-brand-leaf/15 text-brand-charcoal shadow-[0_0_0_3px_rgba(124,156,89,0.25)]"
                : "border-transparent bg-white/60 text-foreground/70 hover:border-brand-leaf/40"
            )}
          >
            {z.name}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-8" data-testid="zone-detail-card" aria-live="polite">
        <p className="text-xs uppercase tracking-[0.25em] text-brand-leaf">{zone.pressure}</p>
        <h3 className="mt-2 font-heading text-2xl font-bold" data-testid="zone-detail-name">{zone.name}</h3>
        <p className="mt-1 text-sm font-medium text-brand-deep">Firmness profile: {zone.firmness}</p>
        <p className="mt-4 leading-relaxed text-muted-foreground" data-testid="zone-detail-description">{zone.description}</p>
        <p className="mt-6 text-xs text-muted-foreground">
          Zone graphics (zone-overview, zone-01…07) drop into these slots once the owner uploads them — interactions stay identical.
        </p>
      </div>
    </div>
  );
}
