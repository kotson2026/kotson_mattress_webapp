import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { ShieldCheck, ExternalLink } from "lucide-react";

interface ProductCertificationsProps {
  certificationIds?: string[];
  productName: string;
}

export default function ProductCertifications({
  certificationIds = [],
  productName,
}: ProductCertificationsProps) {
  // Graceful collapse if no certifications assigned
  if (!certificationIds || certificationIds.length === 0) {
    return null;
  }

  // Fetch authoritative certifications from central Website Edit CMS
  const { data: allCmsCerts = [] } = useQuery<any[]>({
    queryKey: ["cms-certifications"],
    queryFn: () => apiGet<any[]>("/cms/certifications"),
    staleTime: 60_000,
  });

  // Filter only certifications assigned to this product and visible
  const activeProductCerts = allCmsCerts.filter(
    (c: any) =>
      certificationIds.includes(c.id) ||
      certificationIds.includes(c.id?.toLowerCase())
  );

  // If none found in CMS yet, gracefully collapse
  if (activeProductCerts.length === 0) {
    return null;
  }

  return (
    <section
      className="my-16 md:my-28 rounded-3xl bg-brand-sand/15 border border-brand-sand/40 p-8 sm:p-12 lg:p-16"
      aria-labelledby="product-certifications-heading"
      data-testid="product-certifications-section"
    >
      <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-14">
        <span className="text-xs sm:text-sm font-bold tracking-widest uppercase text-brand-leaf mb-2 inline-block">
          GLOBAL SAFETY & INTEGRITY STANDARDS
        </span>
        <h2
          id="product-certifications-heading"
          className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground"
        >
          CERTIFIED & TRUSTED
        </h2>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed text-balance">
          Every component in {productName} is tested and verified by independent, world-renowned certifying bodies.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {activeProductCerts.map((cert: any) => {
          const certImg = cert.certificationImage?.url;
          const bgIsWhite = cert.certificationImage?.background === "white";

          return (
            <div
              key={cert.id}
              className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-brand-leaf/40 transition-all"
            >
              <div>
                {/* Certification Logo / Seal */}
                <div className="h-20 w-full flex items-center justify-center mb-6">
                  {certImg ? (
                    <div className={`p-2.5 rounded-xl border border-border/60 ${bgIsWhite ? "bg-white" : "bg-card"} flex items-center justify-center max-w-[200px] h-full`}>
                      <img
                        src={certImg}
                        alt={cert.certificationImage?.alt || cert.title}
                        loading="lazy"
                        className="max-h-14 max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-leaf/10 border border-brand-leaf/20 text-brand-leaf font-bold text-sm">
                      <ShieldCheck className="w-5 h-5 text-brand-leaf" />
                      <span>{cert.badge || cert.selectorName || "GOLS CERTIFIED"}</span>
                    </div>
                  )}
                </div>

                <div className="text-xs font-bold uppercase tracking-wider text-brand-leaf mb-1">
                  {cert.selectorCategory || cert.category || "Independent Verification"}
                </div>
                <h3 className="font-heading text-xl font-bold text-foreground mb-2">
                  {cert.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {cert.subtitle || cert.whyItMatters}
                </p>

                {/* Audit points summary */}
                {Array.isArray(cert.checks) && cert.checks.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground block mb-1.5">
                      {cert.checksHeader || "Independent Testing Covers"}
                    </span>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside marker:text-brand-leaf">
                      {cert.checks.slice(0, 3).map((chk: string, i: number) => (
                        <li key={i}>{chk}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
