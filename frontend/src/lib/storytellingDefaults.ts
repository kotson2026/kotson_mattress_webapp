import type { ProductStorytellingConfig } from "./types";

export const CANONICAL_CERTIFICATIONS = [
  {
    id: "gols",
    number: "01",
    selectorName: "GOLS",
    selectorCategory: "Raw Material & Process",
    badge: "GOLS CERTIFIED",
    category: "Raw Material & Process",
    title: "GOLS — Global Organic Latex Standard",
    subtitle: "The standard for certified organic latex.",
    checksHeader: "IT AUDITS",
    checks: [
      "Rubber plantation certified organic",
      "Centrifuging and vulcanization facility",
      "Zero petrochemical synthetic fillers",
      "Traceability throughout the entire supply chain",
    ],
    whyItMatters:
      "The latex core is the heart of the mattress. GOLS provides independent verification that your mattress is made from authentic organic tree sap.",
    certificationImage: {
      url: "",
      alt: "GOLS — Global Organic Latex Standard Certification",
    },
  },
  {
    id: "oeko-tex",
    number: "02",
    selectorName: "OEKO-TEX®",
    selectorCategory: "Human Contact Safety",
    badge: "OEKO-TEX® STANDARD 100",
    category: "Human Contact Safety",
    title: "OEKO-TEX® STANDARD 100",
    subtitle: "Class 1 baby-safe certification for harmful substances.",
    checksHeader: "TESTING CAN COVER",
    checks: [
      "Formaldehyde & heavy metals",
      "Pesticides & chlorinated phenols",
      "Restricted azo dyes & phthalates",
      "All skin-contact textiles and latex cores",
    ],
    whyItMatters:
      "Class 1 is the strictest category, certified safe for direct contact with infants and sensitive skin.",
    certificationImage: {
      url: "/certifications/oeko-tex.png",
      alt: "OEKO-TEX STANDARD 100 Certification",
    },
  },
  {
    id: "eco-institut",
    number: "03",
    selectorName: "eco-INSTITUT",
    selectorCategory: "Emissions & Chemical Safety",
    badge: "eco-INSTITUT",
    category: "Emissions & Chemical Safety",
    title: "eco-INSTITUT Tested Product",
    subtitle: "Independent laboratory testing for emissions and toxic off-gassing.",
    checksHeader: "IT TESTS FOR",
    checks: [
      "VOC (Volatile Organic Compound) emissions",
      "Formaldehyde and toxic plasticizers",
      "Heavy metals and biocides",
      "Synthetic chemical residues",
    ],
    whyItMatters:
      "Mattresses spend years inside your bedroom air envelope. eco-INSTITUT proves clean, pure indoor air quality.",
    certificationImage: {
      url: "/certifications/eco-institut.png",
      alt: "eco-INSTITUT Tested Product certification",
    },
  },
  {
    id: "lga",
    number: "04",
    selectorName: "LGA",
    selectorCategory: "Durability & Performance",
    badge: "LGA TESTED",
    category: "Durability & Performance",
    title: "LGA Quality Testing",
    subtitle: "Independent physical endurance and compression testing.",
    checksHeader: "IT MAY EVALUATE",
    checks: [
      "Durability under 60,000 dynamic cycles",
      "Compression resistance and body indentation",
      "Structural stability and resilience (Score: 100/100)",
      "Long-term shape retention",
    ],
    whyItMatters:
      "Demonstrates that natural Dunlop latex maintains its original elasticity and support without sagging over decades of nightly use.",
    certificationImage: {
      url: "/certifications/lga.png",
      alt: "LGA Quality Certificate — Tested Quality",
    },
  },
  {
    id: "fsc",
    number: "05",
    selectorName: "FSC",
    selectorCategory: "Sustainable Sourcing",
    badge: "FSC CERTIFIED",
    category: "Sustainable Sourcing",
    title: "FSC — Forest Stewardship Council",
    subtitle: "Responsible rubber tree forestry and sustainable management.",
    checksHeader: "IT ADDRESSES",
    checks: [
      "Responsible forest plantation management",
      "Biodiversity preservation and zero deforestation",
      "Fair worker conditions and local community protection",
      "Sustainable tree tapping practices",
    ],
    whyItMatters:
      "Ensures the natural rubber tree plantations from which sap is harvested are sustainably cared for and ethically operated.",
    certificationImage: {
      url: "/certifications/fsc.png",
      alt: "Forest Stewardship Council (FSC) Certification",
    },
  },
];

export function getCanonicalStorytelling(categorySlug: string = "mattresses", productName: string = "Product"): ProductStorytellingConfig {
  const normCat = categorySlug.toLowerCase().trim();

  if (normCat.includes("pillow")) {
    return {
      story: {
        enabled: true,
        eyebrow: "CERVICAL ERGONOMIC CONTOUR",
        heading: "Natural Alignment Starts at Your Neck",
        description: `Moulded from pure natural Dunlop latex to cradle your head and neck, preventing morning stiffness and restoring spinal alignment.`,
        features: [
          { icon: "sparkles", title: "Natural Dunlop Foam", description: "Springy, buoyant feel that never clumps or sags like fiber or memory foam." },
          { icon: "shield-check", title: "Ergonomic Cervical Support", description: "Maintains optimal neck curvature throughout the entire sleep cycle." },
          { icon: "wind", title: "Ventilated Pin-Cores", description: "Hundreds of microscopic airways channel excess body heat away from your face." },
        ],
      },
      lifestyle: {
        enabled: true,
        eyebrow: "NECK & SHOULDER RELIEF",
        heading: "Wake Up Pain-Free & Refreshed",
        description: `Engineered to eliminate cervical strain for all sleeping styles with pressure-free buoyancy.`,
        suitability_items: [
          { label: "Side Sleepers", value: "Fills the shoulder-to-ear gap with gentle bounce", icon: "activity" },
          { label: "Back Sleepers", value: "Cradles the occipital curve gently and naturally", icon: "shield-check" },
          { label: "Allergy Sufferers", value: "Inherently dust-mite, fungus & microbe resistant", icon: "wind" },
        ],
        bullet_features: [
          "Retains its height and resilience for over 5 years of daily use",
          "Removable, washable GOTS-certified organic cotton zippered cover",
          "Zero chemical off-gassing, zero synthetic foams, zero unpleasant odors",
        ],
      },
      construction: {
        enabled: true,
        eyebrow: "WHAT'S INSIDE?",
        heading: "100% Organic Dunlop Craftsmanship",
        description: `Pure single-pour organic latex encased in soft, breathable organic cotton.`,
        layers: [
          { order: 1, name: "Breathable Organic Cotton Cover", description: "Ultra-soft zippered casing that breathes freely and washes effortlessly." },
          { order: 2, name: "100% Organic Dunlop Latex Core", description: "Resilient pin-core natural latex contouring to the cervical spine." },
        ],
      },
      fit_guide: {
        enabled: true,
        eyebrow: "FIND YOUR PILLOW",
        heading: "Pillow Styles & Lofts",
        description: "Choose between ergonomic contour, classic high-loft, and dual-profile shapes.",
        items: [
          { name: "Contour Ergonomic", subtitle: "For Neck & Cervical Support", specs: "Dual wave loft: 4\" & 4.5\"" },
          { name: "Classic Standard", subtitle: "Traditional Pillow Feel", specs: "Gentle 5\" plush natural loft" },
        ],
      },
      certification_ids: ["gols", "oeko-tex", "eco-institut", "lga", "fsc"],
    };
  }

  if (normCat.includes("topper")) {
    return {
      story: {
        enabled: true,
        eyebrow: "TRANSFORM ANY MATTRESS",
        heading: "Instant Organic Comfort Over Any Bed",
        description: `Add 2 or 3 inches of certified Dunlop latex to instantly soften a hard mattress or rejuvenate an aging bed.`,
        features: [
          { icon: "sparkles", title: "Instant Pressure Relief", description: "Cushions high-pressure contact points immediately on contact." },
          { icon: "shield-check", title: "Natural Dunlop Resilience", description: "No sinking feeling — effortless turn-over with buoyant support." },
          { icon: "wind", title: "Thermal Neutrality", description: "Replaces memory foam heat-trapping with breathable organic latex." },
        ],
      },
      lifestyle: {
        enabled: true,
        eyebrow: "VERSATILE UPGRADE",
        heading: "Affordable Luxury Sleep",
        description: `The easiest way to experience 100% organic latex comfort without replacing your entire bed frame.`,
        suitability_items: [
          { label: "Too-Firm Mattresses", value: "Adds cloud-like buoyant cushioning instantly", icon: "activity" },
          { label: "Guest Rooms & Renters", value: "Rollable, portable luxury sleep anywhere", icon: "shield-check" },
          { label: "Joint & Hip Pain", value: "Relieves direct pressure on sensitive pressure points", icon: "wind" },
        ],
        bullet_features: [
          "Durable corner anchor straps keep the topper firmly in place all night",
          "GOTS-certified removable organic cotton protector for easy washing",
          "Significantly extends the useful life of any underlying mattress",
        ],
      },
      construction: {
        enabled: true,
        eyebrow: "WHAT'S INSIDE?",
        heading: "Pure Organic Layering",
        description: `Continuous single-pour Dunlop latex wrapped in breathable organic cotton.`,
        layers: [
          { order: 1, name: "Organic Cotton Knitted Cover", description: "Cooling, hypoallergenic exterior with corner anchor straps." },
          { order: 2, name: "100% Organic Dunlop Latex Slab", description: "2\" or 3\" solid pin-core natural latex comfort pad." },
        ],
      },
      fit_guide: {
        enabled: true,
        eyebrow: "CHOOSE YOUR TOPPER",
        heading: "Dimensions & Thickness",
        description: "Available in all bed sizes and 2\" or 3\" comfort depths.",
        items: [
          { name: "2-Inch Medium-Soft", subtitle: "Subtle Comfort Cushion", specs: "Best for slightly firm mattresses" },
          { name: "3-Inch Cloud Plush", subtitle: "Deep Pressure Relief", specs: "Best for hard orthopedic beds" },
        ],
      },
      certification_ids: ["gols", "oeko-tex", "eco-institut", "lga", "fsc"],
    };
  }

  if (normCat.includes("baby") || normCat.includes("kid")) {
    return {
      story: {
        enabled: true,
        eyebrow: "SAFE, PURE & CERTIFIED FOR BABIES",
        heading: "Chemical-Free Sleep For Growing Bones",
        description: `Pediatrician-aligned firm organic Dunlop latex that supports developing infant spines with zero toxic off-gassing.`,
        features: [
          { icon: "sparkles", title: "Zero Harmful Chemicals", description: "No toxic flame retardants, no phthalates, no VOC emissions." },
          { icon: "shield-check", title: "Pediatric Firmness", description: "Firm, flat surface that meets infant safety guidelines." },
          { icon: "wind", title: "100% Breathable Core", description: "Open-cell airflow reduces overheating and breathing obstruction risk." },
        ],
      },
      lifestyle: {
        enabled: true,
        eyebrow: "PEACE OF MIND FOR PARENTS",
        heading: "Purity You Can Trust From Day One",
        description: `Babies spend up to 18 hours a day in their crib. Kotson ensures every breath is pure, clean, and restorative.`,
        suitability_items: [
          { label: "Newborns & Infants", value: "Optimal firm density for safe crib sleeping", icon: "shield-check" },
          { label: "Toddlers", value: "Durable edge support for active movement and play", icon: "activity" },
          { label: "Sensitive Baby Skin", value: "Hypoallergenic, eczema-friendly organic cotton", icon: "wind" },
        ],
        bullet_features: [
          "Certified Class 1 baby-safe under OEKO-TEX Standard 100",
          "Naturally water and saliva resistant Dunlop density",
          "Washable, water-resistant organic cotton protector cover",
        ],
      },
      construction: {
        enabled: true,
        eyebrow: "WHAT'S INSIDE?",
        heading: "Child-Safe Construction",
        description: `Certified non-toxic from rubber tree sap to final stitch.`,
        layers: [
          { order: 1, name: "OEKO-TEX Certified Organic Cotton Casing", description: "Hypoallergenic, ultra-breathable knitted cotton cover." },
          { order: 2, name: "Firm Infant-Grade Dunlop Latex Core", description: "High-density natural latex slab formulated for spinal growth." },
        ],
      },
      fit_guide: {
        enabled: true,
        eyebrow: "CRIB & TODDLER SIZES",
        heading: "Standard & Custom Crib Fits",
        description: "Snug, gap-free fit for all standard and bespoke crib frames.",
        items: [
          { name: "Standard Crib (52×28 in)", subtitle: "Fits All Standard Infant Cribs", specs: "4\" or 5\" firm depth" },
          { name: "Custom Cot / Bed", subtitle: "Made to Specific Cradle Dimensions", specs: "Custom crafted in 48 hours" },
        ],
      },
      certification_ids: ["gols", "oeko-tex", "eco-institut", "lga", "fsc"],
    };
  }

  // Default: MATTRESSES
  return {
    story: {
      enabled: true,
      eyebrow: "100% CERTIFIED ORGANIC DUNLOP LATEX",
      heading: "Restorative Sleep, Pure & Chemical-Free",
      description: `Crafted with authentic Dunlop organic latex from sustainably harvested Hevea brasiliensis trees, engineered to support your spine in neutral anatomical alignment.`,
      features: [
        { icon: "sparkles", title: "100% Organic Dunlop Latex", description: "Zero synthetic blends, zero petroleum-based polyurethanes, zero toxic fire-retardant sprays." },
        { icon: "shield-check", title: "7-Zone Ergonomic Support", description: "Targeted differential pressure relief that cradles shoulders and supports the lumbar region." },
        { icon: "wind", title: "Natural Pin-Core Cooling", description: "Continuous open-cell airflow dissipates body heat naturally without synthetic gel beads." },
      ],
    },
    lifestyle: {
      enabled: true,
      eyebrow: "ENGINEERED FOR NATURAL SLEEP",
      heading: "Designed For Deeper, Restful Nights",
      description: `Whether you sleep on your back, side, or stomach, Kotson's natural buoyancy adapts instantly to every shift in your body position.`,
      suitability_items: [
        { label: "Back & Side Sleepers", value: "Gentle contouring with resilient lumbar lift", icon: "activity" },
        { label: "Hot Sleepers", value: "Naturally thermo-neutral breathable latex", icon: "wind" },
        { label: "Sensitive Skin & Allergy Prone", value: "Naturally dust-mite, mildew & allergen resistant", icon: "shield-check" },
      ],
      bullet_features: [
        "Zero motion transfer ensures undisturbed partner sleep",
        "Breathable GOTS certified organic knitted cotton cover",
        "30-Night risk-free in-home trial with full refund guarantee",
        "10-Year comprehensive non-prorated manufacturer warranty",
      ],
    },
    construction: {
      enabled: true,
      eyebrow: "WHAT'S INSIDE?",
      heading: "3-Layer Natural Dunlop Anatomy",
      description: `Every layer is sustainably harvested, free of volatile chemicals, and rigorously tested for resilience.`,
      layers: [
        { order: 1, name: "GOTS-Certified Knitted Organic Cotton Cover", description: "Quilted with pure natural wool yarn for breathable softness and hypoallergenic comfort." },
        { order: 2, name: "Pin-Core Dunlop Natural Latex Comfort Layer", description: "Responsive micro-cushioning that distributes body weight evenly without sinking sensations." },
        { order: 3, name: "High-Density Natural Latex Support Base", description: "Firm structural foundation delivering long-term spinal support that resists sagging for decades." },
      ],
    },
    fit_guide: {
      enabled: true,
      eyebrow: "FIND THE RIGHT FIT",
      heading: "Select Your Ideal Size & Thickness",
      description: "Available in standard Indian bed dimensions as well as custom made-to-measure sizing.",
      items: [
        { name: "King Size (78×72 in)", subtitle: "Master Bedroom Standard", specs: "6\", 8\", or 10\" thickness available" },
        { name: "Queen Size (78×60 in)", subtitle: "Spacious Comfort for Couples", specs: "6\", 8\", or 10\" thickness available" },
        { name: "Single / Custom", subtitle: "Made to Any Bed Frame Dimension", specs: "Bespoke cut-to-order in 48 hours" },
      ],
    },
    certification_ids: ["gols", "oeko-tex", "eco-institut", "lga", "fsc"],
  };
}
