// Static, accessible fallback for the 3D hero: same real layer structure, no WebGL required.
interface Props {
  highlightId: string | null;
  onHighlight: (id: string | null) => void;
}

const FALLBACK_LAYERS = [
  { id: "pillow", name: "Organic latex pillows", color: "#FBFAF6", h: 26 },
  { id: "cover", name: "Bamboo knit cover", color: "#EDF2E4", h: 18 },
  { id: "casing", name: "Organic cotton casing", color: "#F3EDE0", h: 28 },
  { id: "core", name: "Organic latex core — 7 zones", color: "#E6DEC9", h: 62 },
  { id: "support", name: "Support base (high-density latex)", color: "#C9BBA4", h: 42 },
  { id: "frame", name: "Teak slatted platform", color: "#785338", h: 34 },
];

export default function HeroFallback({ highlightId, onHighlight }: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-b from-brand-sand to-white p-6" data-testid="hero-3d-fallback">
      <p className="mb-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">Static layer view</p>
      <div className="flex w-full max-w-sm flex-col items-stretch gap-1.5">
        {FALLBACK_LAYERS.map((l) => (
          <button
            key={l.id}
            onMouseEnter={() => onHighlight(l.id)}
            onFocus={() => onHighlight(l.id)}
            onMouseLeave={() => onHighlight(null)}
            onBlur={() => onHighlight(null)}
            onClick={() => onHighlight(highlightId === l.id ? null : l.id)}
            style={{ backgroundColor: l.color, minHeight: l.h }}
            className={`flex min-h-11 items-center justify-between rounded-lg border px-4 text-left text-xs font-medium transition-all ${
              highlightId === l.id ? "border-brand-leaf ring-2 ring-brand-leaf/60" : "border-black/10"
            } text-brand-charcoal`}
            data-testid={`hero-layer-${l.id}`}
          >
            <span>{l.name}</span>
            {highlightId === l.id && <span className="text-brand-deep">●</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
