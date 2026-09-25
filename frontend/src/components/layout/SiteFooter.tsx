import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { apiGet } from "@/lib/api";
import { parseJsonBlock } from "@/lib/format";

/* ─────────────────────────────────────────────────────────────────────────
   KOTSON MATTRESS-LAYER FOOTER DESIGN
   - Top: 3 curved mattress layers (Ivory fabric -> Pale latex-sage -> Deep sage)
   - Background: Deep charcoal (#2D2D2D)
   - Left: Transparent Kotson wordmark, Tagline, Company overview
   - Right: 4 navigation columns (SHOP, HELP, KNOW KOTSON, LEGAL)
   - Mobile: Accessible single-expand accordion
   - Bottom: Dynamic legal copyright row
   ───────────────────────────────────────────────────────────────────────── */

interface FooterContact {
  support_email?: string;
  support_phone?: string;
  address?: string;
  contact_status?: string;
}

interface NavLinkItem {
  label: string;
  href: string;
  testId: string;
}

interface NavGroup {
  id: string;
  title: string;
  links: NavLinkItem[];
}

const FOOTER_GROUPS: NavGroup[] = [
  {
    id: "shop",
    title: "SHOP",
    links: [
      { label: "Mattresses", href: "/collections/mattresses", testId: "footer-link-mattresses" },
      { label: "Pillows", href: "/collections/pillows", testId: "footer-link-pillows" },
      { label: "Toppers", href: "/collections/toppers", testId: "footer-link-toppers" },
      { label: "Baby + Kids", href: "/collections/baby-kids", testId: "footer-link-baby" },
    ],
  },
  {
    id: "help",
    title: "HELP",
    links: [
      { label: "Contact Us", href: "/contact", testId: "footer-link-contact" },
      { label: "Track Order", href: "/track-order", testId: "footer-link-track" },
      { label: "Shipping Policy", href: "/policies/policy_shipping", testId: "footer-link-shipping" },
      { label: "Returns & Trial", href: "/policies/policy_returns", testId: "footer-link-returns" },
      { label: "Warranty & Care", href: "/policies/policy_warranty", testId: "footer-link-warranty" },
      { label: "FAQs", href: "/faq", testId: "footer-link-faq" },
    ],
  },
  {
    id: "know-kotson",
    title: "KNOW KOTSON",
    links: [
      { label: "About Us", href: "/about", testId: "footer-link-about" },
      { label: "Certifications", href: "/#certifications", testId: "footer-link-certifications" },
      { label: "Stores", href: "/#explore-stores", testId: "footer-link-stores" },
      { label: "Shark Tank India", href: "/#shark-tank", testId: "footer-link-shark-tank" },
    ],
  },
  {
    id: "legal",
    title: "LEGAL",
    links: [
      { label: "Privacy Policy", href: "/policies/policy_privacy", testId: "footer-link-privacy" },
      { label: "Terms & Conditions", href: "/policies/policy_terms", testId: "footer-link-terms" },
      { label: "Refund & Cancellation Policy", href: "/policies/policy_returns", testId: "footer-link-refund" },
    ],
  },
];

export default function SiteFooter() {
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);

  const { data: blocks } = useQuery({
    queryKey: ["blocks", "footer"],
    queryFn: () => apiGet<Record<string, string>>("/content/blocks?page=footer"),
  });

  const contact = parseJsonBlock<FooterContact>(blocks?.footer_contact ?? "", {});
  const pending = !contact.support_email && !contact.support_phone && (!contact.contact_status || contact.contact_status === "pending_owner_validation");

  const toggleGroup = (groupId: string) => {
    setOpenMobileGroup((current) => (current === groupId ? null : groupId));
  };

  return (
    <footer
      className="relative w-full bg-[#2D2D2D] text-brand-sand overflow-hidden mt-16 sm:mt-20 select-none"
      role="contentinfo"
      aria-label="Site Footer"
    >
      {/* ── 1. MATTRESS LAYERS DECORATIVE HEADER ───────────────────────── */}
      <div
        className="w-full overflow-hidden leading-none select-none pointer-events-none"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 1440 38"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-7 sm:h-9 md:h-10 block"
          preserveAspectRatio="none"
        >
          {/* Layer 1: Warm Ivory Fabric Layer (Quilted Cover Highlight) */}
          <path
            d="M0,0 L1440,0 L1440,9 C1080,5 480,13 0,7 Z"
            fill="#FAF7F0"
          />
          {/* Layer 2: Pale Latex-Sage Layer (Natural Comfort Layer) */}
          <path
            d="M0,7 C480,13 1080,5 1440,9 L1440,21 C1020,15 420,23 0,17 Z"
            fill="#9BB584"
          />
          {/* Layer 3: Darker Sage Support Layer (7-Zone Anatomical Core) */}
          <path
            d="M0,17 C420,23 1020,15 1440,21 L1440,38 L0,38 Z"
            fill="#467065"
          />
        </svg>
      </div>

      {/* ── 2. MAIN FOOTER CONTENT CONTAINER ───────────────────────────── */}
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 pt-8 sm:pt-10 lg:pt-12 pb-10 sm:pb-12 lg:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* ════ LEFT: BRAND IDENTITY ════ */}
          <div className="lg:col-span-4 flex flex-col items-start">
            {/* Transparent Official Kotson Wordmark (No white pill, capsule or box) */}
            <Link to="/" aria-label="Kotson Mattress Home" className="block outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D2D2D] rounded">
              <img
                src="/brand/kotson-wordmark.png"
                alt="Kotson Mattress"
                width={1601}
                height={184}
                className="h-auto w-[150px] sm:w-[170px] lg:w-[185px] max-w-full object-contain block"
                data-testid="footer-logo"
              />
            </Link>

            {/* Tagline */}
            <p className="mt-3.5 font-display text-[18px] sm:text-[20px] lg:text-[22px] text-brand-sand/95 font-normal tracking-tight">
              Where better sleep begins.
            </p>

            {/* Company Mission Paragraph */}
            <p
              className="mt-2.5 max-w-[420px] font-ui text-[12px] sm:text-[13px] leading-[1.6] text-brand-sand/65"
              data-testid="footer-about"
            >
              {blocks?.footer_about ??
                "KOTSON NATURALS PRIVATE LIMITED, trading as KOTSON MATTRESS. Natural latex sleep products thoughtfully made in India."}
            </p>
          </div>

          {/* ════ RIGHT: NAVIGATION COLUMNS (DESKTOP & TABLET) ════ */}
          <nav
            aria-label="Footer Navigation"
            className="hidden sm:grid sm:grid-cols-2 md:grid-cols-4 lg:col-span-8 gap-8 w-full"
          >
            {FOOTER_GROUPS.map((group) => (
              <div key={group.id} className="flex flex-col">
                <h3 className="font-ui text-[12px] sm:text-[13px] font-bold uppercase tracking-[0.14em] text-brand-leaf mb-3">
                  {group.title}
                </h3>
                <ul className="space-y-2 font-ui text-[13px] sm:text-[14px]">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="inline-flex items-center min-h-[36px] text-brand-sand/80 hover:text-white hover:underline focus-visible:text-brand-leaf focus-visible:underline focus-visible:outline-none transition-colors duration-150"
                        data-testid={link.testId}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* ════ MOBILE ACCORDION NAVIGATION ════ */}
          <nav
            aria-label="Footer Navigation Mobile"
            className="sm:hidden w-full divide-y divide-white/10 border-y border-white/10"
          >
            {FOOTER_GROUPS.map((group) => {
              const isOpen = openMobileGroup === group.id;
              const accordionId = `footer-accordion-${group.id}`;

              return (
                <div key={group.id} className="py-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                    aria-controls={accordionId}
                    className="w-full flex items-center justify-between min-h-[48px] py-2 text-left outline-none focus-visible:text-brand-leaf"
                  >
                    <span className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-brand-leaf">
                      {group.title}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-brand-sand/60 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-brand-leaf" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen && (
                    <div
                      id={accordionId}
                      role="region"
                      aria-labelledby={group.id}
                      className="pb-3 pt-1"
                    >
                      <ul className="space-y-1 font-ui text-sm">
                        {group.links.map((link) => (
                          <li key={link.href}>
                            <Link
                              to={link.href}
                              className="flex items-center min-h-[44px] text-brand-sand/80 hover:text-white active:text-brand-leaf transition-colors"
                              data-testid={`${link.testId}-mobile`}
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── 3. BOTTOM LEGAL ROW ────────────────────────────────────────── */}
      <div
        className="border-t border-white/10 px-5 sm:px-8 lg:px-12 py-5 text-center font-ui text-[11px] sm:text-[12px] text-brand-sand/60"
        data-testid="footer-bottom-row"
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2">
          {pending ? (
            <span data-testid="footer-contact-pending">
              Official contact details are pending owner validation — they will appear here once approved.
            </span>
          ) : (
            <span>
              {contact.support_email ?? ""} {contact.support_phone ?? ""} {contact.address ?? ""}
            </span>
          )}
          <span className="hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span data-testid="footer-copyright">
            © {new Date().getFullYear()} KOTSON NATURALS PRIVATE LIMITED. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
