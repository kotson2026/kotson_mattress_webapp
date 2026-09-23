import { useState, useRef, useEffect } from "react";
import { ArrowRight, Check, FileCheck, ShieldCheck, ChevronRight, X } from "lucide-react";

interface CertificationItem {
  id: "gols" | "eco-institut" | "fsc" | "lga" | "oeko-tex";
  number: string;
  selectorName: string;
  selectorCategory: string;
  badge: string;
  category: string;
  title: string;
  subtitle: string;
  body?: string;
  checksHeader: string;
  checks: string[];
  verifiesHeader?: string;
  verifies?: string[];
  whyItMatters: string;
  hasVideo: boolean;
}

const CERTIFICATIONS: CertificationItem[] = [
  {
    id: "gols",
    number: "01",
    selectorName: "GOLS",
    selectorCategory: "Raw Material & Process",
    badge: "GOLS CERTIFIED",
    category: "Raw Material & Process",
    title: "GOLS — Global Organic Latex Standard",
    subtitle: "The standard for certified organic latex.",
    body: "GOLS verifies organic latex content and covers requirements across sourcing, processing and manufacturing.",
    checksHeader: "IT AUDITS",
    checks: [
      "Rubber plantation",
      "Processing unit",
      "Manufacturing facility",
      "Final product",
    ],
    verifiesHeader: "IT HELPS VERIFY",
    verifies: [
      "Certified organic latex content",
      "Controlled processing requirements",
      "Traceability through the supply chain",
      "Requirements governing additional materials and substances",
    ],
    whyItMatters:
      "The latex core is a major component of the mattress. GOLS provides independent certification behind the organic latex claim.",
    hasVideo: true,
  },
  {
    id: "eco-institut",
    number: "02",
    selectorName: "eco-INSTITUT",
    selectorCategory: "Emissions & Chemical Safety",
    badge: "eco-INSTITUT",
    category: "Emissions & Chemical Safety",
    title: "eco-INSTITUT",
    subtitle: "Independent testing for emissions and harmful substances.",
    checksHeader: "IT TESTS FOR",
    checks: [
      "VOC emissions",
      "Formaldehyde",
      "Heavy metals",
      "Pesticides",
      "Phthalates",
      "Other specified chemical residues",
    ],
    whyItMatters:
      "Mattresses spend years inside the sleeping environment. Independent emissions testing provides additional evidence about the materials used in that environment.",
    hasVideo: false,
  },
  {
    id: "fsc",
    number: "03",
    selectorName: "FSC",
    selectorCategory: "Sustainable Sourcing",
    badge: "FSC",
    category: "Sustainable Sourcing",
    title: "FSC — Forest Stewardship Council",
    subtitle: "Responsible sourcing and forest management.",
    checksHeader: "IT ADDRESSES",
    checks: [
      "Responsible forest management",
      "Traceable sourcing",
      "Environmental considerations",
      "Social and worker considerations within applicable standards",
    ],
    whyItMatters:
      "Certification provides traceability behind responsibly sourced forest-based materials.",
    hasVideo: false,
  },
  {
    id: "lga",
    number: "04",
    selectorName: "LGA",
    selectorCategory: "Durability & Performance",
    badge: "LGA TESTED",
    category: "Durability & Performance",
    title: "LGA Quality Testing",
    subtitle: "Independent physical and durability testing.",
    checksHeader: "IT MAY EVALUATE (SUBJECT TO CERTIFICATE)",
    checks: [
      "Durability",
      "Compression resistance",
      "Structural stability",
      "Shape retention",
    ],
    whyItMatters:
      "Performance testing helps demonstrate how the tested product behaves under repeated physical use.",
    hasVideo: false,
  },
  {
    id: "oeko-tex",
    number: "05",
    selectorName: "OEKO-TEX®",
    selectorCategory: "Human Contact Safety",
    badge: "OEKO-TEX® STANDARD 100",
    category: "Human Contact Safety",
    title: "OEKO-TEX® STANDARD 100",
    subtitle: "Testing for harmful substances in textiles and components.",
    checksHeader: "TESTING CAN COVER",
    checks: [
      "Formaldehyde",
      "Heavy metals",
      "Restricted dyes",
      "Other regulated or harmful substances",
    ],
    whyItMatters:
      "STANDARD 100 testing provides independent verification against specified harmful-substance requirements for tested components.",
    hasVideo: false,
  },
];

const GOLS_VIDEO_URL =
  "https://videotourl.com/videos/1790071320217-f57e96c0-9918-440c-8c8e-a0b7ddf8178d.mp4";

export default function CertificationExperience() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCertId, setActiveCertId] = useState<CertificationItem["id"]>("gols");
  const [isSwitching, setIsSwitching] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const initialVideoRef = useRef<HTMLVideoElement | null>(null);
  const explorerVideoRef = useRef<HTMLVideoElement | null>(null);

  const activeCert = CERTIFICATIONS.find((c) => c.id === activeCertId) ?? CERTIFICATIONS[0];
  const activeIndex = CERTIFICATIONS.findIndex((c) => c.id === activeCertId);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Control initial video play/pause on intersection
  useEffect(() => {
    if (isExpanded) {
      initialVideoRef.current?.pause();
      return;
    }

    const videoEl = initialVideoRef.current;
    if (!videoEl || prefersReduced) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            videoEl.play().catch(() => {});
          } else {
            videoEl.pause();
          }
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(videoEl);
    return () => observer.disconnect();
  }, [isExpanded, prefersReduced]);

  // Control explorer video play/pause based on activeCertId
  useEffect(() => {
    if (!isExpanded) return;

    const v = explorerVideoRef.current;
    if (!v) return;

    if (activeCertId === "gols" && !prefersReduced) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isExpanded, activeCertId, prefersReduced]);

  // Smooth switch animation with translateY and opacity
  const handleSelectCert = (id: CertificationItem["id"]) => {
    if (id === activeCertId) return;
    setIsSwitching(true);
    setTimeout(() => {
      setActiveCertId(id);
      setIsSwitching(false);
    }, 150);
  };

  const handleExpand = () => {
    setIsExpanded(true);
    // Smoothly ensure section header is comfortably in view
    setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <section
      ref={sectionRef}
      id="certifications"
      aria-label="Certified Organic Experience"
      className="relative w-full bg-[#FAF8F5] border-t border-border/50 py-16 sm:py-20 lg:py-24 scroll-mt-16 transition-all duration-500 select-none"
    >
      {/* Ambient subtle blur glow */}
      <div
        className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-brand-leaf/[0.03] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full bg-brand-leaf/[0.03] blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1360px] w-full px-4 sm:px-6 lg:px-10">
        {!isExpanded ? (
          /* =========================================================================
             1. MAIN INITIAL STATE (Clean, minimal, high-impact)
             ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* LEFT COLUMN: Clean Brand Narrative */}
            <div className="lg:col-span-6 flex flex-col items-start justify-center">
              <p className="font-ui text-xs sm:text-[13px] lg:text-[14px] font-bold uppercase tracking-[0.14em] text-brand-deep">
                CERTIFIED ORGANIC
              </p>

              <h2 className="mt-3 font-display text-[34px] sm:text-[46px] lg:text-[54px] font-normal text-brand-charcoal tracking-tight leading-[1.08]">
                Proof in Every Layer.
              </h2>

              <p className="mt-4 font-ui text-[15px] sm:text-[16px] lg:text-[17px] text-brand-charcoal/75 leading-relaxed font-normal max-w-xl">
                Every Kotson mattress is built around independently tested materials and recognized
                certification standards.
              </p>

              <div className="mt-8 sm:mt-10 flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleExpand}
                  className="group inline-flex items-center gap-2.5 rounded-full bg-brand-deep px-7 py-3.5 text-sm font-semibold text-white shadow-xs transition-all duration-300 hover:bg-brand-deep/90 hover:gap-3.5 focus-visible:ring-2 focus-visible:ring-brand-leaf focus-visible:outline-none cursor-pointer"
                  data-testid="know-more-certifications"
                >
                  <span className="font-ui">Know More</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: GOLS Mattress Assembly Video */}
            <div className="lg:col-span-6 w-full">
              <div className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-[#E8E3D8] bg-[#0E1511] shadow-xs aspect-[16/10] sm:aspect-[16/10]">
                <video
                  ref={initialVideoRef}
                  src={GOLS_VIDEO_URL}
                  muted
                  playsInline
                  loop
                  autoPlay={!prefersReduced}
                  controls={false}
                  preload="metadata"
                  className="w-full h-full object-cover object-center pointer-events-none"
                  aria-label="GOLS certified organic mattress assembly video"
                />

                {/* Subtle GOLS Badge Overlay */}
                <div className="absolute top-4 left-4 sm:top-5 sm:left-5 pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-[11px] font-ui font-semibold uppercase tracking-wider text-white">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    GOLS Certified Organic
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             2. EXPANDED CERTIFICATION EXPLORER (Split-Screen scannable experience)
             ========================================================================= */
          <div className="w-full">
            {/* Header with Return / Collapse Button */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 sm:pb-12 border-b border-[#E8E3D8]">
              <div>
                <p className="font-ui text-xs sm:text-[13px] lg:text-[14px] font-bold uppercase tracking-[0.14em] text-brand-deep">
                  CERTIFIED, NOT JUST CLAIMED
                </p>
                <h2 className="mt-1.5 font-display text-[32px] sm:text-[42px] lg:text-[48px] font-normal text-brand-charcoal tracking-tight leading-tight">
                  Our Certifications
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full px-4 py-2 text-xs font-ui font-medium text-brand-charcoal/70 hover:text-brand-deep hover:bg-black/[0.04] transition-colors cursor-pointer border border-[#E8E3D8]/80"
                aria-label="Back to overview"
              >
                <X className="h-3.5 w-3.5" />
                <span>Overview</span>
              </button>
            </div>

            {/* ─── MOBILE SELECTOR TABS (Horizontal Scroll) ─── */}
            <div className="lg:hidden mt-6 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2 flex items-center gap-2">
              {CERTIFICATIONS.map((cert) => {
                const isActive = cert.id === activeCertId;
                return (
                  <button
                    key={cert.id}
                    type="button"
                    onClick={() => handleSelectCert(cert.id)}
                    className={`shrink-0 px-4 py-2 rounded-full font-ui text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-brand-deep text-white shadow-xs"
                        : "bg-white/80 text-brand-charcoal/60 border border-[#E8E3D8] hover:text-brand-deep"
                    }`}
                  >
                    {cert.selectorName}
                  </button>
                );
              })}
            </div>

            {/* ─── DESKTOP SPLIT-SCREEN EXPLORER (3-Column Layout) & MOBILE EXPERIENCE ─── */}
            <div className="mt-8 lg:mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              {/* LEFT SIDE: Vertical Certification Navigation (Desktop Only) */}
              <div className="hidden lg:block lg:order-1 lg:col-span-4 relative border-r border-[#E8E3D8] pr-6 py-2">
                {/* Thin Kotson-Green Verification Progress Line (350-500ms) */}
                <div
                  className="absolute right-0 w-[3px] bg-brand-deep rounded-full transition-all duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    top: `${activeIndex * 20}%`,
                    height: "20%",
                  }}
                  aria-hidden="true"
                />

                <div className="flex flex-col divide-y divide-[#E8E3D8]/60">
                  {CERTIFICATIONS.map((cert) => {
                    const isActive = cert.id === activeCertId;
                    return (
                      <button
                        key={cert.id}
                        type="button"
                        onClick={() => handleSelectCert(cert.id)}
                        className={`w-full text-left py-4 px-3 rounded-xl transition-all duration-300 flex items-start gap-4 group cursor-pointer ${
                          isActive
                            ? "bg-white/70 text-brand-deep shadow-2xs"
                            : "text-brand-charcoal/50 hover:text-brand-charcoal hover:bg-white/30"
                        }`}
                      >
                        <span
                          className={`font-ui text-xs font-bold tracking-widest pt-0.5 transition-colors ${
                            isActive ? "text-brand-deep" : "text-brand-charcoal/40"
                          }`}
                        >
                          {cert.number}
                        </span>
                        <div className="flex-1">
                          <p
                            className={`font-ui text-[15px] font-bold tracking-wide transition-colors ${
                              isActive ? "text-brand-deep font-semibold" : "text-brand-charcoal/70"
                            }`}
                          >
                            {cert.selectorName}
                          </p>
                          <p className="font-ui text-xs text-brand-charcoal/60 mt-0.5 font-normal">
                            {cert.selectorCategory}
                          </p>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 mt-1 transition-transform duration-300 ${
                            isActive
                              ? "translate-x-0 opacity-100 text-brand-deep"
                              : "-translate-x-1 opacity-0 group-hover:opacity-40"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* VISUAL AREA: On mobile order-1 (shows before details); on desktop order-3 (right side) */}
              <div
                className={`order-1 lg:order-3 lg:col-span-4 w-full transition-all duration-300 ease-out ${
                  isSwitching ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                }`}
              >
                {activeCert.id === "gols" ? (
                  /* GOLS Video Area */
                  <div className="relative w-full rounded-2xl overflow-hidden border border-[#E8E3D8] bg-[#0E1511] shadow-xs aspect-[4/3]">
                    <video
                      ref={explorerVideoRef}
                      src={GOLS_VIDEO_URL}
                      muted
                      playsInline
                      loop
                      autoPlay={!prefersReduced}
                      controls={false}
                      preload="auto"
                      className="w-full h-full object-cover object-center pointer-events-none"
                      aria-label="GOLS mattress assembly layer-by-layer video"
                    />
                    <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-ui">
                      <p className="font-semibold flex items-center gap-1.5 text-[12px]">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        GOLS Mattress Assembly
                      </p>
                      <p className="text-[11px] text-white/70 mt-0.5">
                        Organic Dunlop latex core, cotton zip casing & bamboo cover.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Official Certification Asset Placeholder Card */
                  <div className="w-full rounded-2xl border border-[#E8E3D8] bg-white p-6 sm:p-7 shadow-xs flex flex-col justify-between aspect-[4/3]">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-sand text-[10.5px] font-ui font-semibold uppercase tracking-wider text-brand-charcoal/70 border border-[#E8E3D8]">
                          <FileCheck className="h-3 w-3 text-brand-deep" />
                          Independent Audit
                        </span>
                        <span className="font-ui text-[11px] text-muted-foreground font-mono">
                          {activeCert.number} / 05
                        </span>
                      </div>

                      <div className="mt-6 text-center py-4">
                        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-brand-sand/70 text-brand-deep border border-[#E8E3D8] mb-3">
                          <ShieldCheck className="h-8 w-8 text-brand-leaf" />
                        </div>
                        <h4 className="font-ui text-lg sm:text-xl font-bold text-brand-charcoal">
                          {activeCert.badge}
                        </h4>
                        <p className="font-ui text-xs text-brand-charcoal/60 mt-1">
                          {activeCert.category}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#E8E3D8]/60 text-center">
                      <p className="font-ui text-[10.5px] uppercase tracking-wider text-muted-foreground">
                        Official Certification Documentation
                      </p>
                      <p className="font-ui text-[11px] text-brand-deep/80 font-medium mt-0.5">
                        Verification protocol on file
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* CENTER: Hierarchical Scannable Details (Order-2 on mobile & desktop) */}
              <div
                className={`order-2 lg:order-2 lg:col-span-4 transition-all duration-300 ease-out flex flex-col justify-start ${
                  isSwitching ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                }`}
              >
                {/* Category & Badge */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-ui font-bold uppercase tracking-wider bg-brand-deep/10 text-brand-deep">
                    {activeCert.badge}
                  </span>
                  <span className="font-ui text-xs text-brand-charcoal/60 font-medium">
                    {activeCert.category}
                  </span>
                </div>

                {/* Title & Subtitle */}
                <h3 className="mt-3 font-ui text-xl sm:text-2xl font-bold text-brand-charcoal tracking-tight leading-snug">
                  {activeCert.title}
                </h3>
                <p className="mt-1 font-ui text-sm text-brand-charcoal/75 leading-relaxed">
                  {activeCert.subtitle}
                </p>

                {activeCert.body && (
                  <p className="mt-3 font-ui text-[13.5px] text-brand-charcoal/80 leading-relaxed">
                    {activeCert.body}
                  </p>
                )}

                {/* WHAT IT CHECKS / AUDITS */}
                <div className="mt-6 pt-5 border-t border-[#E8E3D8]">
                  <p className="font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-brand-deep">
                    {activeCert.checksHeader}
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    {activeCert.checks.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[13.5px] font-ui text-brand-charcoal/85">
                        <Check className="h-3.5 w-3.5 text-brand-leaf mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* WHAT IT VERIFIES (if available) */}
                {activeCert.verifies && (
                  <div className="mt-5 pt-4 border-t border-[#E8E3D8]/70">
                    <p className="font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-brand-deep">
                      {activeCert.verifiesHeader}
                    </p>
                    <ul className="mt-2.5 space-y-1.5">
                      {activeCert.verifies.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[13.5px] font-ui text-brand-charcoal/85">
                          <Check className="h-3.5 w-3.5 text-brand-leaf mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* WHY IT MATTERS (2–3 lines) */}
                <div className="mt-6 p-4 rounded-xl bg-white/70 border border-[#E8E3D8] shadow-2xs">
                  <p className="font-ui text-[11px] font-bold uppercase tracking-[0.12em] text-brand-charcoal/70">
                    WHY IT MATTERS
                  </p>
                  <p className="mt-1.5 font-ui text-xs sm:text-[13px] text-brand-charcoal/85 leading-relaxed">
                    {activeCert.whyItMatters}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
