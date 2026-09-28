export interface KotsonStore {
  id: string;
  number: string;
  name: string;
  city: string;
  state: string;
  area: string;
  tagline: string;
  address: string;
  pincodes: string[];
  phone: string;
  timings: string;
  mapUrl: string;
  image: string;
  storeCount: number;
}

export interface VisitBenefit {
  id: string;
  title: string;
  description: string;
}

export interface StoreSectionContent {
  eyebrow: string;
  heading: string;
  paragraph: string;
  showroomImage: string;
  showroomImageAlt: string;
  stores: KotsonStore[];
  benefits: VisitBenefit[];
}

export const KOTSON_STORE_DATA: StoreSectionContent = {
  eyebrow: "EXPLORE OUR STORES",
  heading: "Experience Kotson In Person",
  paragraph:
    "Experience our mattresses, pillows and natural latex products in person. Visit a Kotson store and find the comfort that feels right for you.",
  showroomImage:
    "https://cdn.phototourl.com/free/2026-09-22-5f3360d1-de72-4db6-b87b-fd03e0286836.png",
  showroomImageAlt:
    "Kotson showroom interior featuring natural latex mattresses, pillows and ergonomic displays",
  stores: [
    {
      id: "hyderabad",
      number: "01",
      name: "Hyderabad Experience Centre",
      city: "Hyderabad",
      state: "Telangana",
      area: "Jubilee Hills",
      tagline: "Flagship 7-Zone Botanical Sleep Studio",
      address: "Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033",
      pincodes: ["500033", "500081", "500034", "500001", "500032", "500084", "500072", "500082", "500016"],
      phone: "+91 91234 56789",
      timings: "10:30 AM – 8:30 PM (All 7 Days)",
      mapUrl: "https://maps.google.com/?q=Kotson+Mattress+Hyderabad",
      image: "https://cdn.phototourl.com/free/2026-09-22-5f3360d1-de72-4db6-b87b-fd03e0286836.png",
      storeCount: 1,
    },
    {
      id: "vijayawada",
      number: "02",
      name: "Vijayawada Experience Centre",
      city: "Vijayawada",
      state: "Andhra Pradesh",
      area: "Benz Circle",
      tagline: "Natural Latex Mattress & Contoured Pillow Gallery",
      address: "MG Road, Near Benz Circle, Vijayawada, Andhra Pradesh 520010",
      pincodes: ["520010", "520001", "520008", "520002", "520007", "520004", "520011"],
      phone: "+91 91234 56790",
      timings: "10:30 AM – 8:30 PM (All 7 Days)",
      mapUrl: "https://maps.google.com/?q=Kotson+Mattress+Vijayawada",
      image: "https://cdn.phototourl.com/free/2026-09-22-5f3360d1-de72-4db6-b87b-fd03e0286836.png",
      storeCount: 1,
    },
  ],
  benefits: [
    {
      id: "try-before-buy",
      title: "Try before you buy",
      description: "Feel all natural latex densities and anatomical zones in person",
    },
    {
      id: "sleep-experts",
      title: "Friendly sleep experts",
      description: "Zero-pressure posture guidance from trained ergonomic specialists",
    },
    {
      id: "personal-guidance",
      title: "Personal sleep guidance",
      description: "Custom firmness and pillow contour recommendations for your spine",
    },
  ],
};
