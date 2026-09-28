import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Edit2,
  Info,
  Phone,
  Ruler,
  ShieldCheck,
  Truck,
  Whatsapp,
  Sparkles,
  ClipboardCheck,
} from "@/lib/lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type { Product } from "@/lib/types";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import ProductSupportAssistance from "@/components/product/ProductSupportAssistance";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/lib/session";
import { getTelUrl, getWhatsAppUrl, getCustomizerWhatsAppMessage, useCustomerSupport } from "@/lib/support";

type StepNumber = 1 | 2 | 3;

interface CustomRequestResult {
  success: boolean;
  request_id: string;
  request_number: string;
  status: string;
  formatted_date?: string;
}

export default function CustomizerWorkspace() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const support = useCustomerSupport();

  // Load product from authoritative catalog
  const { data: product, isLoading: isProductLoading } = useQuery<Product>({
    queryKey: ["product", slug],
    queryFn: () => apiGet<Product>(`/catalog/products/${slug}`),
    enabled: !!slug,
  });

  // Stepper state: 1 = SIZE, 2 = PREVIEW, 3 = REQUEST (Success)
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);

  // Step 1: Mode ("standard" | "custom")
  const [sizeMode, setSizeMode] = useState<"standard" | "custom">("custom");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

  // Step 1: Custom Dimensions (in INCHES)
  const [dimensions, setDimensions] = useState<{
    length: number | string;
    breadth: number | string;
    thickness: number | string;
  }>({
    length: 78,
    breadth: 60,
    thickness: 8,
  });
  const [dimensionErrors, setDimensionErrors] = useState<Record<string, string>>({});

  // Customer Contact Details for quotation follow-up
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    mobile: "",
    email: "",
    city: "",
    pincode: "",
    remarks: "",
  });
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<CustomRequestResult | null>(null);

  // Active product image
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Prefill authenticated customer details safely
  useEffect(() => {
    if (me) {
      setCustomerDetails((prev) => ({
        ...prev,
        name: prev.name || me.name || "",
        mobile: prev.mobile || me.phone || "",
        email: prev.email || me.email || "",
      }));
    }
  }, [me]);

  // Dimension rules from product config
  const customConfig = product?.customization;
  const dimensionRules = useMemo(() => {
    return (
      customConfig?.dimensions || {
        length: { min: 60, max: 84, step: 1 },
        breadth: { min: 30, max: 78, step: 1 },
        thickness: { min: 4, max: 12, step: 1, allowed_values: [5, 6, 8, 10, 12] },
      }
    );
  }, [customConfig]);

  // Set default variant if standard mode
  useEffect(() => {
    if (product && product.variants && product.variants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(product.variants[0].id);
    }
  }, [product, selectedVariantId]);

  // Restore non-sensitive draft measurements from session storage
  useEffect(() => {
    if (slug) {
      try {
        const saved = sessionStorage.getItem(`kotson_custom_draft_${slug}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.dimensions) setDimensions(parsed.dimensions);
          if (parsed.sizeMode) setSizeMode(parsed.sizeMode);
          if (parsed.selectedVariantId) setSelectedVariantId(parsed.selectedVariantId);
        }
      } catch (err) {
        // Safe ignore
      }
    }
  }, [slug]);

  // Persist draft to session storage
  useEffect(() => {
    if (slug) {
      try {
        sessionStorage.setItem(
          `kotson_custom_draft_${slug}`,
          JSON.stringify({
            dimensions,
            sizeMode,
            selectedVariantId,
          })
        );
      } catch (e) {
        // Safe ignore
      }
    }
  }, [slug, dimensions, sizeMode, selectedVariantId]);

  /* ── Safe Scroll helper respecting user preferences ── */
  const smoothScrollToTop = () => {
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: isReduced ? "auto" : "smooth" });
  };

  /* ── Validation for Step 1 Dimensions ── */
  const validateDimensionsClient = (): boolean => {
    if (sizeMode === "standard") {
      if (!selectedVariantId) {
        toast.error("Please select a standard size");
        return false;
      }
      setDimensionErrors({});
      return true;
    }

    const errors: Record<string, string> = {};
    const len = Number(dimensions.length);
    const brd = Number(dimensions.breadth);
    const thk = Number(dimensions.thickness);

    const lenRule = dimensionRules.length || { min: 60, max: 84, step: 1 };
    if (!len || isNaN(len) || len < lenRule.min || len > lenRule.max) {
      errors.length = `Length must be between ${lenRule.min} and ${lenRule.max} inches.`;
    }

    const brdRule = dimensionRules.breadth || { min: 30, max: 78, step: 1 };
    if (!brd || isNaN(brd) || brd < brdRule.min || brd > brdRule.max) {
      errors.breadth = `Breadth must be between ${brdRule.min} and ${brdRule.max} inches.`;
    }

    const thkRule = dimensionRules.thickness || { min: 4, max: 12, step: 1 };
    if (!thk || isNaN(thk) || thk < thkRule.min || thk > thkRule.max) {
      errors.thickness = `Thickness must be between ${thkRule.min} and ${thkRule.max} inches.`;
    }

    setDimensionErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please enter valid dimensions within manufacturing limits.");
      return false;
    }
    return true;
  };

  /* ── Validation for Customer Contact Details ── */
  const validateContactDetails = (): boolean => {
    const errors: Record<string, string> = {};
    if (!customerDetails.name.trim() || customerDetails.name.trim().length < 2) {
      errors.name = "Full Name is required (minimum 2 characters).";
    }

    const cleanMobile = customerDetails.mobile.replace(/[\s\-\+]/g, "");
    if (!cleanMobile || cleanMobile.length < 10) {
      errors.mobile = "A valid 10-digit mobile number is required.";
    }

    setContactErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please provide your name and mobile number so our team can follow up with your quotation.");
      return false;
    }
    return true;
  };

  /* ── Step Navigation ── */
  const handleProceedToPreview = () => {
    if (!validateDimensionsClient()) return;
    setCurrentStep(2);
    smoothScrollToTop();
  };

  const handleBackToSize = () => {
    setCurrentStep(1);
    smoothScrollToTop();
  };

  /* ── Final Submission: Submit Custom Request / Ticket ── */
  const handleSubmitCustomRequest = async () => {
    if (!product) return;
    if (!validateContactDetails()) return;

    setIsSubmitting(true);
    try {
      const selectedVariant = product.variants?.find((v) => v.id === selectedVariantId);

      const payload = {
        product_id: product.id,
        product_name_snapshot: displayName,
        product_slug: product.slug,
        category: product.category_slug,
        product_image: activeImage,
        size_mode: sizeMode,
        standard_variant_id: sizeMode === "standard" ? selectedVariantId : null,
        standard_size_label: sizeMode === "standard" ? selectedVariant?.size : null,
        length: sizeMode === "standard" && selectedVariant?.length ? String(selectedVariant.length) : String(dimensions.length),
        breadth: sizeMode === "standard" && selectedVariant?.width ? String(selectedVariant.width) : String(dimensions.breadth),
        height_or_thickness: sizeMode === "standard" && selectedVariant?.thickness ? String(selectedVariant.thickness) : String(dimensions.thickness),
        measurement_unit: "inch",
        customer_name: customerDetails.name.trim(),
        mobile: customerDetails.mobile.trim(),
        email: customerDetails.email.trim() || null,
        city: customerDetails.city.trim() || null,
        pincode: customerDetails.pincode.trim() || null,
        customer_remarks: customerDetails.remarks.trim() || null,
      };

      const res = await apiPost<CustomRequestResult>("/custom-requests", payload);

      setSubmissionResult(res);
      setCurrentStep(3);
      smoothScrollToTop();
      toast.success("Custom quotation request submitted successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit custom quotation request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Product Images ── */
  const productImages = useMemo(() => {
    if (!product) return ["/navbar/mattress.png"];
    const imgs = product.images && product.images.length > 0 ? product.images : [];
    if (imgs.length === 0 && product.primary_image) imgs.push(product.primary_image);
    if (imgs.length === 0) imgs.push("/navbar/mattress.png");
    return imgs;
  }, [product]);

  const activeImage = productImages[activeImageIndex] || productImages[0];

  if (isProductLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5]">
        <StorefrontHeader />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="w-12 h-12 border-3 border-[#467065] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-ui text-sm text-[#5C6656]">Loading customizer workspace...</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FAF8F5]">
        <StorefrontHeader />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h2 className="font-serif text-2xl font-bold text-[#2D2D2D]">Product Not Found</h2>
          <p className="text-xs text-[#5C6656] mt-2">
            The requested product is not available for custom configuration.
          </p>
          <Link
            to="/customizable-products"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#467065] text-white text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Customizable Products</span>
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const isOrthoMax = product.slug.includes("ortho-core-max");
  const displayName = isOrthoMax ? "Ortho Core Max Mattress" : product.name;

  const selectedStandardVariant = product.variants?.find((v) => v.id === selectedVariantId);
  const dimensionsSummary =
    sizeMode === "custom"
      ? `${dimensions.length} × ${dimensions.breadth} × ${dimensions.thickness} in`
      : selectedStandardVariant
      ? `${selectedStandardVariant.size} (${selectedStandardVariant.length || "78"} × ${selectedStandardVariant.width || "60"} × ${selectedStandardVariant.thickness || "8"} in)`
      : "Standard Size";

  const waSupportMessage = getCustomizerWhatsAppMessage(displayName);
  const waSupportUrl = getWhatsAppUrl(support.cleanWhatsAppNumber, waSupportMessage);
  const telSupportUrl = getTelUrl(support.canonicalPhone);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2D2D] selection:bg-[#467065]/20">
      <StorefrontHeader />

      {/* ── Breadcrumb Bar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#5C6656] flex-wrap">
          <Link to="/" className="hover:text-[#467065] transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#5C6656]/50" />
          <Link to="/customizable-products" className="hover:text-[#467065] transition-colors">
            Customizable Products
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#5C6656]/50" />
          <Link
            to={`/customizable-products/${product.category_slug}`}
            className="hover:text-[#467065] transition-colors capitalize"
          >
            {product.category_slug}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#5C6656]/50" />
          <span className="font-semibold text-[#2D2D2D] truncate max-w-[220px]">{displayName}</span>
        </nav>
      </div>

      {/* ── Main Workspace ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* ═════════════════════════════════════════════════════════════════
              LEFT: Product Information & Live Specs Summary (40–45%)
             ═════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            {/* Main Product Stage */}
            <div className="bg-white rounded-3xl border border-[#2D2D2D]/10 p-5 sm:p-6 shadow-sm overflow-hidden">
              <div className="relative aspect-[4/3] rounded-2xl bg-[#FAF8F5] p-4 flex items-center justify-center overflow-hidden border border-[#2D2D2D]/5">
                <img
                  src={activeImage}
                  alt={displayName}
                  className="w-full h-full object-contain transition-transform duration-200"
                />

                {/* Dimension Overlay Badge on Image */}
                <div className="absolute bottom-3 left-3 bg-white/95 px-3 py-1.5 rounded-lg border border-[#2D2D2D]/10 text-xs font-bold text-[#2D2D2D] shadow-sm flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#467065]" />
                  <span>{dimensionsSummary}</span>
                </div>
              </div>

              {/* Gallery Thumbnails */}
              {productImages.length > 1 && (
                <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
                  {productImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-14 h-14 rounded-xl border p-1 shrink-0 overflow-hidden transition-all ${
                        activeImageIndex === idx
                          ? "border-[#467065] ring-2 ring-[#467065]/20 bg-white"
                          : "border-[#2D2D2D]/10 bg-[#FAF8F5] opacity-75 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              )}

              {/* Product Title & Botanical Highlights */}
              <div className="mt-5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#467065]/10 text-[#467065]">
                    Custom Tailored
                  </span>
                  <span className="text-xs text-[#5C6656]">GOLS Certified 100% Organic</span>
                </div>

                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2D2D2D] leading-tight">
                  {displayName}
                </h1>

                <p className="text-xs text-[#5C6656] leading-relaxed">
                  {product.short_description ||
                    "Individually hand-sculpted anatomical natural latex mattress tailored to your exact bed frame dimensions."}
                </p>
              </div>

              {/* ── Updated Clean Configuration Snapshot (Actual Customer Selection Only) ── */}
              <div className="mt-5 p-4 rounded-2xl bg-[#FAF8F5] border border-[#2D2D2D]/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#2D2D2D] border-b border-[#2D2D2D]/10 pb-2">
                  <span>CONFIGURATION SNAPSHOT</span>
                  <span className="text-[11px] font-normal text-[#5C6656]">Live Selection</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#5C6656] text-[11px]">Size Mode</span>
                    <span className="font-semibold text-[#2D2D2D]">
                      {sizeMode === "custom" ? "Custom Made-To-Size" : "Standard Size"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#5C6656] text-[11px]">Dimensions</span>
                    <span className="font-bold text-[#467065] text-sm">
                      {dimensionsSummary}
                    </span>
                  </div>
                </div>
              </div>

              {/* Guarantees */}
              <div className="mt-4 pt-4 border-t border-[#2D2D2D]/5 flex items-center justify-between text-[11px] text-[#5C6656]">
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#467065]" />
                  <span>10-Yr Warranty</span>
                </div>
                <div className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-[#467065]" />
                  <span>Doorstep Delivery</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              RIGHT: 3-Step Customizer Workflow (SIZE → PREVIEW → REQUEST)
             ═════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-[#2D2D2D]/10 p-6 sm:p-8 lg:p-10 shadow-sm space-y-8">
            {/* ── Updated 3-Step Progress Indicator (1 SIZE ── 2 PREVIEW ── 3 REQUEST) ── */}
            <div className="pb-6 border-b border-[#2D2D2D]/10">
              <div className="flex items-center justify-between relative max-w-md mx-auto">
                {/* Connecting track line */}
                <div className="absolute top-4 left-6 right-6 h-0.5 bg-[#2D2D2D]/10 -z-0" />
                <div
                  className="absolute top-4 left-6 h-0.5 bg-[#467065] transition-all duration-300 -z-0"
                  style={{
                    width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%",
                  }}
                />

                {/* Step 1: SIZE */}
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep !== 3) setCurrentStep(1);
                  }}
                  className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-none"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      currentStep > 1
                        ? "bg-[#467065] text-white"
                        : currentStep === 1
                        ? "bg-[#467065] text-white ring-4 ring-[#467065]/20"
                        : "bg-white border-2 border-[#2D2D2D]/20 text-[#5C6656]"
                    }`}
                  >
                    {currentStep > 1 ? <Check className="w-4 h-4" /> : "1"}
                  </div>
                  <span
                    className={`text-[11px] font-bold tracking-wider uppercase mt-2 ${
                      currentStep === 1 ? "text-[#467065]" : "text-[#5C6656]"
                    }`}
                  >
                    1 SIZE
                  </span>
                </button>

                {/* Step 2: PREVIEW */}
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 1 && validateDimensionsClient()) setCurrentStep(2);
                  }}
                  className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-none"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      currentStep > 2
                        ? "bg-[#467065] text-white"
                        : currentStep === 2
                        ? "bg-[#467065] text-white ring-4 ring-[#467065]/20"
                        : "bg-white border-2 border-[#2D2D2D]/20 text-[#5C6656]"
                    }`}
                  >
                    {currentStep > 2 ? <Check className="w-4 h-4" /> : "2"}
                  </div>
                  <span
                    className={`text-[11px] font-bold tracking-wider uppercase mt-2 ${
                      currentStep === 2 ? "text-[#467065]" : "text-[#5C6656]"
                    }`}
                  >
                    2 PREVIEW
                  </span>
                </button>

                {/* Step 3: REQUEST */}
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      currentStep === 3
                        ? "bg-[#467065] text-white ring-4 ring-[#467065]/20"
                        : "bg-white border-2 border-[#2D2D2D]/20 text-[#5C6656]"
                    }`}
                  >
                    3
                  </div>
                  <span
                    className={`text-[11px] font-bold tracking-wider uppercase mt-2 ${
                      currentStep === 3 ? "text-[#467065]" : "text-[#5C6656]"
                    }`}
                  >
                    3 REQUEST
                  </span>
                </div>
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                STEP 1: SIZE & DIMENSIONS ONLY
               ═════════════════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#2D2D2D]">1. Enter Your Dimensions</h2>
                  <p className="font-ui text-xs sm:text-sm text-[#5C6656] mt-1">
                    Choose your required size. You can select a standard size or enter custom measurements.
                  </p>
                </div>

                {/* Segmented Control: [ STANDARD SIZE ] [ CUSTOM SIZE ] */}
                <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-[#FAF8F5] border border-[#2D2D2D]/10">
                  <button
                    type="button"
                    onClick={() => setSizeMode("standard")}
                    className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-150 ${
                      sizeMode === "standard"
                        ? "bg-white text-[#467065] shadow-sm border border-[#2D2D2D]/5 ring-1 ring-[#467065]/20"
                        : "text-[#5C6656] hover:text-[#2D2D2D]"
                    }`}
                  >
                    Standard Size
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeMode("custom")}
                    className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-150 ${
                      sizeMode === "custom"
                        ? "bg-[#467065] text-white shadow-sm"
                        : "text-[#5C6656] hover:text-[#2D2D2D]"
                    }`}
                  >
                    Custom Size
                  </button>
                </div>

                {/* ── Mode A: STANDARD SIZE ── */}
                {sizeMode === "standard" && (
                  <div className="space-y-4 pt-2">
                    <p className="text-xs text-[#5C6656]">
                      Choose from standard factory dimensions for {displayName}:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {product.variants?.map((v) => {
                        const isSelected = v.id === selectedVariantId;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedVariantId(v.id)}
                            className={`p-4 rounded-2xl border text-left transition-all ${
                              isSelected
                                ? "border-[#467065] bg-[#467065]/5 ring-1 ring-[#467065]/30 shadow-sm"
                                : "border-[#2D2D2D]/10 bg-white hover:border-[#467065]/30"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-ui font-bold text-sm text-[#2D2D2D]">{v.size}</span>
                              {isSelected && (
                                <span className="w-5 h-5 rounded-full bg-[#467065] text-white flex items-center justify-center">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#5C6656] mt-1">
                              {[v.length && `${v.length}L`, v.width && `${v.width}W`, v.thickness && `${v.thickness}H`]
                                .filter(Boolean)
                                .join(" × ") || "Standard factory size profile"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Mode B: CUSTOM SIZE ── */}
                {sizeMode === "custom" && (
                  <div className="space-y-5 pt-2">
                    <div className="p-3.5 rounded-xl bg-[#467065]/5 border border-[#467065]/20 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#467065] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#2D2D2D] leading-relaxed">
                        Enter your exact dimensions in <strong>INCHES</strong>. Our master craftsmen will sculpt the natural latex core to fit your bed frame perfectly.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Length Input */}
                      <div className="space-y-1.5">
                        <Label htmlFor="custom-length" className="text-xs font-bold text-[#2D2D2D]">
                          Length (in)
                        </Label>
                        <Input
                          id="custom-length"
                          type="number"
                          value={dimensions.length}
                          min={dimensionRules.length?.min || 60}
                          max={dimensionRules.length?.max || 84}
                          step={dimensionRules.length?.step || 1}
                          onChange={(e) => {
                            setDimensions({ ...dimensions, length: e.target.value });
                            setDimensionErrors((prev) => ({ ...prev, length: "" }));
                          }}
                          className={`h-12 text-base font-semibold rounded-xl bg-[#FAF8F5] ${
                            dimensionErrors.length ? "border-red-500 ring-1 ring-red-500" : "border-[#2D2D2D]/15"
                          }`}
                        />
                        <span className="text-[11px] text-[#5C6656] block">
                          Allowed: {dimensionRules.length?.min || 60}″ – {dimensionRules.length?.max || 84}″
                        </span>
                        {dimensionErrors.length && (
                          <p className="text-[11px] text-red-600 font-medium">{dimensionErrors.length}</p>
                        )}
                      </div>

                      {/* Breadth Input */}
                      <div className="space-y-1.5">
                        <Label htmlFor="custom-breadth" className="text-xs font-bold text-[#2D2D2D]">
                          Breadth (in)
                        </Label>
                        <Input
                          id="custom-breadth"
                          type="number"
                          value={dimensions.breadth}
                          min={dimensionRules.breadth?.min || 30}
                          max={dimensionRules.breadth?.max || 78}
                          step={dimensionRules.breadth?.step || 1}
                          onChange={(e) => {
                            setDimensions({ ...dimensions, breadth: e.target.value });
                            setDimensionErrors((prev) => ({ ...prev, breadth: "" }));
                          }}
                          className={`h-12 text-base font-semibold rounded-xl bg-[#FAF8F5] ${
                            dimensionErrors.breadth ? "border-red-500 ring-1 ring-red-500" : "border-[#2D2D2D]/15"
                          }`}
                        />
                        <span className="text-[11px] text-[#5C6656] block">
                          Allowed: {dimensionRules.breadth?.min || 30}″ – {dimensionRules.breadth?.max || 78}″
                        </span>
                        {dimensionErrors.breadth && (
                          <p className="text-[11px] text-red-600 font-medium">{dimensionErrors.breadth}</p>
                        )}
                      </div>

                      {/* Thickness Input */}
                      <div className="space-y-1.5">
                        <Label htmlFor="custom-thickness" className="text-xs font-bold text-[#2D2D2D]">
                          Height / Thickness (in)
                        </Label>
                        {dimensionRules.thickness?.allowed_values &&
                        dimensionRules.thickness.allowed_values.length > 0 ? (
                          <select
                            id="custom-thickness"
                            value={dimensions.thickness}
                            onChange={(e) => {
                              setDimensions({ ...dimensions, thickness: e.target.value });
                              setDimensionErrors((prev) => ({ ...prev, thickness: "" }));
                            }}
                            className="w-full h-12 px-3 text-base font-semibold rounded-xl bg-[#FAF8F5] border border-[#2D2D2D]/15 outline-none focus:ring-2 focus:ring-[#467065]"
                          >
                            {dimensionRules.thickness.allowed_values.map((thk) => (
                              <option key={thk} value={thk}>
                                {thk} inches ({Math.round(thk * 2.54)} cm)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id="custom-thickness"
                            type="number"
                            value={dimensions.thickness}
                            min={dimensionRules.thickness?.min || 4}
                            max={dimensionRules.thickness?.max || 12}
                            step={dimensionRules.thickness?.step || 1}
                            onChange={(e) => {
                              setDimensions({ ...dimensions, thickness: e.target.value });
                              setDimensionErrors((prev) => ({ ...prev, thickness: "" }));
                            }}
                            className="h-12 text-base font-semibold rounded-xl bg-[#FAF8F5] border-[#2D2D2D]/15"
                          />
                        )}
                        <span className="text-[11px] text-[#5C6656] block">
                          Thickness profile in inches
                        </span>
                        {dimensionErrors.thickness && (
                          <p className="text-[11px] text-red-600 font-medium">{dimensionErrors.thickness}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Compact Call & WhatsApp Assistance Block (Placed around measurements) ── */}
                <ProductSupportAssistance
                  mode="customizer"
                  productName={displayName}
                  productId={product?.id}
                  className="mt-4"
                />

                {/* ── First Button: PREVIEW YOUR SIZE → (Replaces Choose Options) ── */}
                <div className="pt-6 border-t border-[#2D2D2D]/10 flex justify-end">
                  <button
                    type="button"
                    onClick={handleProceedToPreview}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#467065] text-white font-bold text-sm tracking-wide shadow-sm hover:bg-[#395c53] transition-all cursor-pointer"
                    data-testid="btn-preview-size"
                  >
                    <span>PREVIEW YOUR SIZE</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════
                STEP 2: PREVIEW YOUR CUSTOM REQUEST & SUBMIT
               ═════════════════════════════════════════════════════════════════ */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#2D2D2D]">
                    2. Preview Your Custom Request
                  </h2>
                  <p className="font-ui text-xs sm:text-sm text-[#5C6656] mt-1">
                    Review your requested dimensions and provide your contact details for quotation confirmation.
                  </p>
                </div>

                {/* Review Card */}
                <div className="rounded-2xl border border-[#2D2D2D]/10 p-5 bg-[#FAF8F5] space-y-4">
                  <div className="flex items-center justify-between border-b border-[#2D2D2D]/10 pb-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={activeImage}
                        alt={displayName}
                        className="w-12 h-12 rounded-xl object-contain bg-white border border-[#2D2D2D]/10 p-1"
                      />
                      <div>
                        <h4 className="font-ui text-base font-bold text-[#2D2D2D]">{displayName}</h4>
                        <p className="text-xs text-[#5C6656]">
                          {sizeMode === "custom" ? "Custom Made-to-Size" : "Standard Size"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleBackToSize}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#467065] hover:underline cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Size</span>
                    </button>
                  </div>

                  {/* Measurements Breakdown */}
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white border border-[#2D2D2D]/10">
                      <span className="text-[11px] text-[#5C6656] block">Length</span>
                      <span className="font-bold text-sm text-[#2D2D2D]">
                        {sizeMode === "custom"
                          ? `${dimensions.length} in`
                          : selectedStandardVariant?.length
                          ? `${selectedStandardVariant.length} in`
                          : "Standard"}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-[#2D2D2D]/10">
                      <span className="text-[11px] text-[#5C6656] block">Breadth</span>
                      <span className="font-bold text-sm text-[#2D2D2D]">
                        {sizeMode === "custom"
                          ? `${dimensions.breadth} in`
                          : selectedStandardVariant?.width
                          ? `${selectedStandardVariant.width} in`
                          : "Standard"}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-[#2D2D2D]/10">
                      <span className="text-[11px] text-[#5C6656] block">Height / Thickness</span>
                      <span className="font-bold text-sm text-[#2D2D2D]">
                        {sizeMode === "custom"
                          ? `${dimensions.thickness} in`
                          : selectedStandardVariant?.thickness
                          ? `${selectedStandardVariant.thickness} in`
                          : "Standard"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Custom Price Section: CUSTOM QUOTE REQUIRED ── */}
                <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold tracking-wider text-amber-900">
                      PRICE
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      Custom Quote Required
                    </span>
                  </div>

                  <p className="text-xs text-amber-900 leading-relaxed pt-1">
                    Pricing for customized sizes is confirmed after our team reviews your measurements.
                  </p>
                </div>

                {/* ── Customer Contact Details Form ── */}
                <div className="p-5 rounded-2xl bg-white border border-[#2D2D2D]/10 space-y-4">
                  <div className="border-b border-[#2D2D2D]/10 pb-2">
                    <h3 className="font-ui font-bold text-sm text-[#2D2D2D]">
                      Your Contact Details for Custom Quote
                    </h3>
                    <p className="text-[11px] text-[#5C6656] mt-0.5">
                      Our sleep specialist will contact you with exact quotation and fabrication schedule.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div className="space-y-1">
                      <Label htmlFor="cust-name" className="text-xs font-semibold text-[#2D2D2D]">
                        Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="cust-name"
                        value={customerDetails.name}
                        onChange={(e) => {
                          setCustomerDetails({ ...customerDetails, name: e.target.value });
                          setContactErrors((prev) => ({ ...prev, name: "" }));
                        }}
                        placeholder="e.g. Kranthi Kumar"
                        className={`h-11 text-sm rounded-xl bg-[#FAF8F5] ${
                          contactErrors.name ? "border-red-500" : "border-[#2D2D2D]/15"
                        }`}
                      />
                      {contactErrors.name && (
                        <p className="text-[11px] text-red-600 font-medium">{contactErrors.name}</p>
                      )}
                    </div>

                    {/* Mobile Number */}
                    <div className="space-y-1">
                      <Label htmlFor="cust-mobile" className="text-xs font-semibold text-[#2D2D2D]">
                        Mobile Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="cust-mobile"
                        type="tel"
                        value={customerDetails.mobile}
                        onChange={(e) => {
                          setCustomerDetails({ ...customerDetails, mobile: e.target.value });
                          setContactErrors((prev) => ({ ...prev, mobile: "" }));
                        }}
                        placeholder="e.g. 9876543210"
                        className={`h-11 text-sm rounded-xl bg-[#FAF8F5] ${
                          contactErrors.mobile ? "border-red-500" : "border-[#2D2D2D]/15"
                        }`}
                      />
                      {contactErrors.mobile && (
                        <p className="text-[11px] text-red-600 font-medium">{contactErrors.mobile}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                      <Label htmlFor="cust-email" className="text-xs font-semibold text-[#2D2D2D]">
                        Email (Optional)
                      </Label>
                      <Input
                        id="cust-email"
                        type="email"
                        value={customerDetails.email}
                        onChange={(e) =>
                          setCustomerDetails({ ...customerDetails, email: e.target.value })
                        }
                        placeholder="e.g. kranthi.kumar@example.com"
                        className="h-11 text-sm rounded-xl bg-[#FAF8F5] border-[#2D2D2D]/15"
                      />
                    </div>

                    {/* City / PIN Code */}
                    <div className="space-y-1">
                      <Label htmlFor="cust-city" className="text-xs font-semibold text-[#2D2D2D]">
                        City / PIN Code (Optional)
                      </Label>
                      <Input
                        id="cust-city"
                        value={customerDetails.city}
                        onChange={(e) =>
                          setCustomerDetails({ ...customerDetails, city: e.target.value })
                        }
                        placeholder="e.g. Bangalore / 560038"
                        className="h-11 text-sm rounded-xl bg-[#FAF8F5] border-[#2D2D2D]/15"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 2 Action Buttons */}
                <div className="pt-4 border-t border-[#2D2D2D]/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={handleBackToSize}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[#2D2D2D]/20 text-[#2D2D2D] font-semibold text-xs sm:text-sm hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Size</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitCustomRequest}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#467065] text-white font-bold text-base tracking-wide shadow-md hover:bg-[#395c53] hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer"
                    data-testid="btn-request-quote"
                  >
                    <span>{isSubmitting ? "Submitting..." : "REQUEST CUSTOM QUOTE"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════
                STEP 3: CUSTOMER SUCCESS SCREEN (CUSTOM REQUEST RECEIVED)
               ═════════════════════════════════════════════════════════════════ */}
            {currentStep === 3 && (
              <div className="space-y-6 text-center py-4">
                <div className="w-16 h-16 rounded-full bg-[#467065]/10 text-[#467065] flex items-center justify-center mx-auto ring-8 ring-[#467065]/5">
                  <ClipboardCheck className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#467065]/10 text-[#467065]">
                    Custom Request Received
                  </span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2D2D2D]">
                    Your Request Has Been Created
                  </h2>
                </div>

                {/* Ticket Reference Card */}
                <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#2D2D2D]/10 max-w-md mx-auto space-y-3">
                  <span className="text-xs uppercase font-bold text-[#5C6656] tracking-wider block">
                    Your Request ID
                  </span>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[#467065] tracking-wide">
                    {submissionResult?.request_number || "KT-CUSTOM-000124"}
                  </p>
                  <div className="pt-2 border-t border-[#2D2D2D]/10 text-xs text-[#5C6656]">
                    <span>Product: <strong>{displayName}</strong></span>
                    <span className="block mt-0.5">Dimensions: <strong>{dimensionsSummary}</strong></span>
                  </div>
                </div>

                <p className="text-sm text-[#2D2D2D] max-w-lg mx-auto leading-relaxed">
                  Thank you. Our team will review your measurements and contact you regarding pricing and availability.
                </p>

                {/* Direct Call & WhatsApp Contact Buttons */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
                  {support.phoneEnabled && (
                    <a
                      href={telSupportUrl}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white border border-[#2D2D2D]/20 text-[#2D2D2D] font-bold text-sm hover:bg-[#FAF8F5] transition-all cursor-pointer"
                    >
                      <Phone className="w-4 h-4 text-[#467065]" />
                      <span>Call Us ({support.phone})</span>
                    </a>
                  )}

                  {support.whatsappEnabled && (
                    <a
                      href={waSupportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#20ba59] transition-all cursor-pointer shadow-xs"
                    >
                      <Whatsapp className="w-4 h-4 fill-white" />
                      <span>WhatsApp Us</span>
                    </a>
                  )}
                </div>

                {/* Navigation Back */}
                <div className="pt-6 border-t border-[#2D2D2D]/10 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    to="/customizable-products"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-[#467065] hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Customizable Products</span>
                  </Link>
                  <span className="hidden sm:inline text-[#2D2D2D]/20">•</span>
                  <Link
                    to="/collections/mattresses"
                    className="text-xs font-semibold text-[#5C6656] hover:text-[#2D2D2D]"
                  >
                    Explore Standard Mattresses
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
