import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import LogoMark from "@/components/layout/LogoMark";
import { parseJsonBlock } from "@/lib/format";

interface FooterContact {
  support_email?: string;
  support_phone?: string;
  address?: string;
  contact_status?: string;
}

export default function SiteFooter() {
  const { data: blocks } = useQuery({
    queryKey: ["blocks", "footer"],
    queryFn: () => apiGet<Record<string, string>>("/content/blocks?page=footer"),
  });
  const contact = parseJsonBlock<FooterContact>(blocks?.footer_contact ?? "", {});
  const pending = contact.contact_status === "pending_owner_validation";

  return (
    <footer className="mt-20 bg-brand-charcoal text-brand-sand">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <LogoMark light />
          <p className="mt-3 font-display text-xl sm:text-2xl text-brand-sand/95 font-normal">
            Where better sleep begins.
          </p>
          <p className="mt-2.5 max-w-sm font-ui text-xs leading-relaxed text-brand-sand/65" data-testid="footer-about">
            {blocks?.footer_about ?? "KOTSON NATURALS PRIVATE LIMITED, trading as KOTSON MATTRESS."}
          </p>
        </div>
        <div>
          <h3 className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-brand-leaf">Shop</h3>
          <ul className="mt-4 space-y-2 font-ui text-sm">
            <li><Link className="min-h-11 inline-flex items-center hover:text-brand-sand/70" to="/collections/mattresses" data-testid="footer-link-mattresses">Mattresses</Link></li>
            <li><Link className="min-h-11 inline-flex items-center hover:text-brand-sand/70" to="/collections/pillows" data-testid="footer-link-pillows">Pillows</Link></li>
            <li><Link className="min-h-11 inline-flex items-center hover:text-brand-sand/70" to="/collections/toppers" data-testid="footer-link-toppers">Toppers</Link></li>
            <li><Link className="min-h-11 inline-flex items-center hover:text-brand-sand/70" to="/collections/baby-kids" data-testid="footer-link-baby">Baby + Kids</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-brand-leaf">Company</h3>
          <ul className="mt-4 space-y-2 font-ui text-sm">
            <li><Link className="min-h-11 inline-flex items-center hover:text-brand-sand/70" to="/about">About</Link></li>
            <li><Link className="min-h-11 inline-flex items-center hover:text-brand-sand/70" to="/contact">Contact</Link></li>
            <li><Link className="min-h-11 inline-flex items-center hover:text-brand-sand/70" to="/policies/policy_shipping">Shipping policy</Link></li>
            <li><Link className="min-h-11 inline-flex items-center hover:text-brand-sand/70" to="/policies/policy_returns">Returns &amp; trial</Link></li>
            <li><Link className="min-h-11 inline-flex items-center hover:text-brand-sand/70" to="/policies/policy_privacy">Privacy</Link></li>
            <li><Link className="min-h-11 inline-flex items-center hover:text-brand-sand/70" to="/policies/policy_terms">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-6 text-center text-xs text-brand-sand/60 sm:px-6" data-testid="footer-contact-line">
        {pending
          ? "Official contact details are pending owner validation — they will appear here once approved."
          : `${contact.support_email ?? ""} ${contact.support_phone ?? ""} ${contact.address ?? ""}`}
        {" · "}© {new Date().getFullYear()} KOTSON NATURALS PRIVATE LIMITED
      </div>
    </footer>
  );
}
