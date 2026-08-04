/**
 * Rebar Bar Size Database
 * Phase 6 (RC Design Engine) — ACI 318-19 / BNBC 2020 তে ব্যবহৃত
 * standard metric rebar diameter ও cross-sectional area। বাংলাদেশে
 * সাধারণত সরাসরি mm ব্যাসের নামকরণ ব্যবহৃত হয় (যেমন "16mm rebar"),
 * ACI-এর #3-#11 নামকরণের বদলে — তাই এখানে metric নামকরণ প্রাথমিক,
 * ACI designation রেফারেন্স হিসেবে সাথে রাখা হলো।
 */

export interface RebarSize {
  diameterMm: number;
  areaMm2: number; // একটা বার এর cross-sectional area, mm² (π/4 × d²)
  aciDesignation: string; // যেমন "#3", রেফারেন্সের জন্য
}

export const REBAR_SIZES: RebarSize[] = [
  { diameterMm: 10, areaMm2: 78.5, aciDesignation: "#3" },
  { diameterMm: 12, areaMm2: 113.1, aciDesignation: "#4 (approx)" },
  { diameterMm: 16, areaMm2: 201.1, aciDesignation: "#5 (approx)" },
  { diameterMm: 20, areaMm2: 314.2, aciDesignation: "#6 (approx)" },
  { diameterMm: 22, areaMm2: 380.1, aciDesignation: "#7 (approx)" },
  { diameterMm: 25, areaMm2: 490.9, aciDesignation: "#8 (approx)" },
  { diameterMm: 28, areaMm2: 615.8, aciDesignation: "#9 (approx)" },
  { diameterMm: 32, areaMm2: 804.2, aciDesignation: "#10 (approx)" },
];

export function getRebarSize(diameterMm: number): RebarSize {
  const found = REBAR_SIZES.find((r) => r.diameterMm === diameterMm);
  if (!found) {
    // অজানা diameter হলে সরাসরি geometric formula থেকে হিসাব — যাতে
    // ভবিষ্যতে অপ্রচলিত bar size দিয়েও ফাংশন কাজ করে, শুধু টেবিলের
    // বাইরে হলেই ব্যর্থ না হয়।
    return {
      diameterMm,
      areaMm2: (Math.PI / 4) * diameterMm * diameterMm,
      aciDesignation: "custom",
    };
  }
  return found;
}

/** n সংখ্যক bar এর মোট cross-sectional area, mm²। */
export function totalRebarArea(diameterMm: number, count: number): number {
  return getRebarSize(diameterMm).areaMm2 * count;
}
