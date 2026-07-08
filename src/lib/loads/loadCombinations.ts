/**
 * Load Combination Generator (Phase 3 — Section 5, শেষ আইটেম)
 *
 * ACI 318-19 (Section 5.3) ও BNBC 2020 (Part 6, Chapter 2) এর LRFD
 * (Load and Resistance Factor Design) load combination — এটাই বাংলাদেশে
 * (BNBC 2020) এবং US কোডে (ACI 318-19) প্রচলিত প্রধান পদ্ধতি।
 *
 * ASD (Allowable Stress Design) combination এই মডিউলে দেওয়া হয়নি —
 * BNBC 2020/ACI 318-19 উভয়ই LRFD-কে প্রধান পদ্ধতি হিসেবে সুপারিশ করে
 * আধুনিক ডিজাইনে, তাই v1 তে শুধু LRFD। ASD প্রয়োজন হলে ভবিষ্যতে
 * যোগ করা যাবে (কাঠামো একই থাকবে, শুধু factor ভিন্ন)।
 */

export interface LoadCombinationFactor {
  patternCategory: string; // LoadCategory থেকে, যেমন "dead", "live", "wind"
  factor: number;
}

export interface LoadCombination {
  combinationId: string;
  name: string; // যেমন "1.2D + 1.6L", "0.9D + 1.0E"
  formula: string; // মানুষের পড়ার জন্য, যেমন "1.2*Dead + 1.6*Live"
  factors: LoadCombinationFactor[];
  source: "aci-318-19-default" | "bnbc-2020-default" | "user-defined";
  isEnabled: boolean; // ইউজার চাইলে কিছু ডিফল্ট কম্বিনেশন বন্ধ রাখতে পারবেন (যেমন seismic combination যদি প্রজেক্টে earthquake লোড না থাকে)
}

function makeCombinationId(): string {
  return `combo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * ACI 318-19 Section 5.3.1 এর প্রধান ৭টা LRFD combination। এগুলো
 * সাধারণত gravity + একটা lateral (wind বা seismic) এর সমন্বয়।
 * সব প্রজেক্টে সবগুলো প্রাসঙ্গিক নাও হতে পারে (যেমন seismic zone 1
 * এ কিছু ইঞ্জিনিয়ার seismic combination কম গুরুত্ব দেন) — তাই
 * isEnabled ফ্ল্যাগ দিয়ে ইউজার নিজে বেছে নিতে পারবেন কোনটা প্রযোজ্য।
 */
export function generateDefaultLoadCombinations(): LoadCombination[] {
  const now = Date.now();
  // makeCombinationId এর বদলে index-based ID ব্যবহার করা হচ্ছে এখানে
  // যাতে একসাথে তৈরি হওয়া combination গুলোর ID guaranteed ভাবে ইউনিক
  // থাকে (Date.now() মিলিসেকেন্ড রেজোলিউশনে, একই মিলিসেকেন্ডে একাধিক
  // তৈরি হলে collision হতে পারতো)।
  const combos: Omit<LoadCombination, "combinationId">[] = [
    {
      name: "1.4D",
      formula: "1.4 × Dead",
      factors: [{ patternCategory: "dead", factor: 1.4 }],
      source: "aci-318-19-default",
      isEnabled: true,
    },
    {
      name: "1.2D + 1.6L",
      formula: "1.2 × Dead + 1.6 × Live",
      factors: [
        { patternCategory: "dead", factor: 1.2 },
        { patternCategory: "live", factor: 1.6 },
      ],
      source: "aci-318-19-default",
      isEnabled: true,
    },
    {
      name: "1.2D + 1.6L + 0.5(Lr or S or R)",
      formula: "1.2 × Dead + 1.6 × Live + 0.5 × (Snow or Rain)",
      factors: [
        { patternCategory: "dead", factor: 1.2 },
        { patternCategory: "live", factor: 1.6 },
        { patternCategory: "snow", factor: 0.5 },
        { patternCategory: "rain", factor: 0.5 },
      ],
      source: "aci-318-19-default",
      isEnabled: true,
    },
    {
      name: "1.2D + 1.0W + 1.0L + 0.5(Lr or S or R)",
      formula: "1.2 × Dead + 1.0 × Wind + 1.0 × Live + 0.5 × (Snow or Rain)",
      factors: [
        { patternCategory: "dead", factor: 1.2 },
        { patternCategory: "wind", factor: 1.0 },
        { patternCategory: "live", factor: 1.0 },
        { patternCategory: "snow", factor: 0.5 },
        { patternCategory: "rain", factor: 0.5 },
      ],
      source: "aci-318-19-default",
      isEnabled: true,
    },
    {
      name: "1.2D + 1.0E + 1.0L + 0.2S",
      formula: "1.2 × Dead + 1.0 × Earthquake + 1.0 × Live + 0.2 × Snow",
      factors: [
        { patternCategory: "dead", factor: 1.2 },
        { patternCategory: "earthquake", factor: 1.0 },
        { patternCategory: "live", factor: 1.0 },
        { patternCategory: "snow", factor: 0.2 },
      ],
      source: "aci-318-19-default",
      isEnabled: true,
    },
    {
      name: "0.9D + 1.0W",
      formula: "0.9 × Dead + 1.0 × Wind",
      factors: [
        { patternCategory: "dead", factor: 0.9 },
        { patternCategory: "wind", factor: 1.0 },
      ],
      source: "aci-318-19-default",
      isEnabled: true,
    },
    {
      name: "0.9D + 1.0E",
      formula: "0.9 × Dead + 1.0 × Earthquake",
      factors: [
        { patternCategory: "dead", factor: 0.9 },
        { patternCategory: "earthquake", factor: 1.0 },
      ],
      source: "aci-318-19-default",
      isEnabled: true,
    },
  ];

  return combos.map((combo, index) => ({
    ...combo,
    combinationId: `combo-${now}-${index}`,
  }));
}

/** ইউজারের নিজের তৈরি custom combination। */
export function createCustomLoadCombination(params: {
  name: string;
  factors: LoadCombinationFactor[];
}): LoadCombination {
  const formula = params.factors
    .map((f) => `${f.factor} × ${f.patternCategory}`)
    .join(" + ");

  return {
    combinationId: makeCombinationId(),
    name: params.name,
    formula,
    factors: params.factors,
    source: "user-defined",
    isEnabled: true,
  };
}
