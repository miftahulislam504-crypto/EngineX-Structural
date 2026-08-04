/**
 * Rebar Bar Selection Engine
 * Phase 10 প্রস্তুতি — Detailing Model-এর জন্য দরকার, কিন্তু generically
 * ব্যবহারযোগ্য যেকোনো Design panel-এও (Beam/Column/Slab/Wall/Footing)।
 *
 * এখন পর্যন্ত (Phase 6) প্রতিটা RC design module শুধু required steel
 * area (As, mm²) বের করে — কিন্তু বাস্তবে ইঞ্জিনিয়ার/detailer কে একটা
 * *buildable* bar arrangement লাগবে: কয়টা বার, কত dia, কী spacing।
 * এই মডিউল সেই gap পূরণ করে — As (ও width) দিলে সবচেয়ে practical
 * bar count + diameter সমন্বয় বেছে দেয়।
 *
 * নীতি (সরলীকৃত কিন্তু বাস্তবসম্মত heuristic, কোনো কোড-নির্ধারিত একক
 * "সঠিক উত্তর" নেই এখানে — detailer-রা সবসময় বিচার-বিবেচনা করেই বার
 * সাইজ বাছেন):
 *   1. একটা নির্দিষ্ট pool of "পছন্দের" diameter থেকে বাছা হয় (ছোট থেকে
 *      বড়), যাতে খুব বেশি ছোট বার (কনজেশন) বা খুব বড় বার (poor crack
 *      distribution) এড়ানো যায়।
 *   2. প্রতিটা candidate diameter-এর জন্য, ন্যূনতম bar count (≥minBars)
 *      বের করা হয় যা required area কভার করে, availableWidth-এ bar
 *      spacing (clear spacing ≥ code minimum) মেনে ফিট করে কিনা যাচাই
 *      করা হয়।
 *   3. যেসব সমন্বয় ফিট করে তাদের মধ্যে সবচেয়ে কম "waste" (provided
 *      area − required area) ও ব্যবহারিক bar count (না খুব কম, না খুব
 *      বেশি) অনুযায়ী সেরাটা বাছা হয়।
 *
 * এটা একটা v1 heuristic — optimization engine (Phase 9) এর মতো কোনো
 * cost-based সূক্ষ্ম অপ্টিমাইজেশন না, কিন্তু detailing visualization
 * এর জন্য একটা বাস্তবসম্মত, buildable answer দেয়।
 */

import { REBAR_SIZES, getRebarSize, totalRebarArea } from "@/lib/design/rebarSizes";

export interface BarSelectionInput {
  requiredAreaMm2: number;
  /** যে দিকে বার সারিবদ্ধভাবে বসবে তার clear width, mm (যেমন beam width − 2×cover − 2×stirrupDia) — spacing feasibility check করতে ব্যবহৃত। */
  availableWidthMm: number;
  minBars?: number; // ডিফল্ট 2 (beam এ ন্যূনতম ২টা বার প্রতি face, column এ সাধারণত বেশি — caller override করতে পারে)
  maxBars?: number; // ডিফল্ট 12 (congestion সীমা — এর বেশি হলে সাধারণত section বড় করা উচিত)
  /** ন্যূনতম clear spacing bar এর মাঝে, mm — না দিলে ACI 318-19 §25.2.1 অনুযায়ী max(25mm, barDia) ব্যবহৃত হয় (caller প্রতিটা bar diameter এর জন্য dynamically চেক করে)। */
  minClearSpacingMm?: number;
  /** শুধু এই candidate diameter গুলোর মধ্যে থেকে বাছা হবে — না দিলে পুরো REBAR_SIZES pool ব্যবহৃত হয়। */
  candidateDiametersMm?: number[];
}

export interface BarSelectionResult {
  barDiameterMm: number;
  barCount: number;
  providedAreaMm2: number;
  utilizationRatio: number; // providedArea / requiredArea (≥1 হওয়া উচিত)
  actualSpacingMm: number; // center-to-center, availableWidth / (barCount − 1) [barCount=1 হলে 0]
  clearSpacingMm: number; // actualSpacing − barDiameter
  fits: boolean; // clear spacing ≥ minimum ও barCount ≤ maxBars হলে true
  warnings: string[];
}

/** ACI 318-19 §25.2.1 — beam-এ single-layer bar এর ন্যূনতম clear spacing। */
function minCodeClearSpacingMm(barDiameterMm: number): number {
  return Math.max(25, barDiameterMm);
}

export function selectRebarArrangement(input: BarSelectionInput): BarSelectionResult {
  const {
    requiredAreaMm2,
    availableWidthMm,
    minBars = 2,
    maxBars = 12,
    minClearSpacingMm,
    candidateDiametersMm,
  } = input;

  const warnings: string[] = [];
  const pool = candidateDiametersMm ?? REBAR_SIZES.map((r) => r.diameterMm);

  if (requiredAreaMm2 <= 0) {
    // কোনো required area না থাকলেও একটা ন্যূনতম practical arrangement দেখানো ভালো (nominal/minimum reinforcement case)
    const fallbackDia = pool[Math.min(1, pool.length - 1)] ?? 12;
    const count = minBars;
    return buildResult(fallbackDia, count, requiredAreaMm2, availableWidthMm, minClearSpacingMm, maxBars, [
      "Required area শূন্য বা ঋণাত্মক — nominal/minimum arrangement দেখানো হচ্ছে।",
    ]);
  }

  type Candidate = BarSelectionResult & { diameterMm: number };
  const candidates: Candidate[] = [];

  for (const dia of pool) {
    const barArea = getRebarSize(dia).areaMm2;
    const count = Math.max(minBars, Math.ceil(requiredAreaMm2 / barArea));

    if (count > maxBars) continue; // এই diameter দিয়ে খুব বেশি বার লাগবে, বাদ

    const result = buildResult(dia, count, requiredAreaMm2, availableWidthMm, minClearSpacingMm, maxBars, []);
    candidates.push({ ...result, diameterMm: dia });
  }

  if (candidates.length === 0) {
    // কোনো candidate maxBars সীমার মধ্যে ফিট করেনি — সবচেয়ে বড় diameter দিয়ে যা লাগে তাই দেওয়া হচ্ছে, warning সহ
    const largestDia = pool[pool.length - 1];
    const barArea = getRebarSize(largestDia).areaMm2;
    const count = Math.max(minBars, Math.ceil(requiredAreaMm2 / barArea));
    const result = buildResult(
      largestDia,
      count,
      requiredAreaMm2,
      availableWidthMm,
      minClearSpacingMm,
      maxBars,
      [
        `কোনো standard bar diameter দিয়ে ${maxBars}টার মধ্যে required area (${requiredAreaMm2.toFixed(0)}mm²) পূরণ করা গেল না — সবচেয়ে বড় diameter (${largestDia}mm) দিয়ে ${count}টা বার প্রস্তাব করা হচ্ছে, কিন্তু section বড় করা বা doubly-reinforced/multi-layer বিবেচনা করুন।`,
      ]
    );
    return result;
  }

  // ফিট করা সমন্বয়গুলোর মধ্যে অগ্রাধিকার: (1) fits === true, (2) কম waste area, (3) practical bar count (খুব বেশি বার এড়ানো)
  const fittingOnes = candidates.filter((c) => c.fits);
  const pool2 = fittingOnes.length > 0 ? fittingOnes : candidates;

  pool2.sort((a, b) => {
    const wasteA = a.providedAreaMm2 - requiredAreaMm2;
    const wasteB = b.providedAreaMm2 - requiredAreaMm2;
    if (Math.abs(wasteA - wasteB) > 1e-6) return wasteA - wasteB;
    return a.barCount - b.barCount;
  });

  const best = pool2[0];
  if (fittingOnes.length === 0) {
    warnings.push(
      `${best.barDiameterMm}mm × ${best.barCount} বার নির্বাচিত হলেও clear spacing code minimum-এর কম (${best.clearSpacingMm.toFixed(1)}mm < প্রয়োজন) — multi-layer বা বড় section বিবেচনা করুন।`
    );
  }

  return { ...best, warnings: [...best.warnings, ...warnings] };
}

function buildResult(
  diameterMm: number,
  count: number,
  requiredAreaMm2: number,
  availableWidthMm: number,
  minClearSpacingMm: number | undefined,
  maxBars: number,
  extraWarnings: string[]
): BarSelectionResult {
  const providedAreaMm2 = totalRebarArea(diameterMm, count);
  const utilizationRatio = requiredAreaMm2 > 0 ? providedAreaMm2 / requiredAreaMm2 : 1;

  const actualSpacingMm = count > 1 ? availableWidthMm / (count - 1) : 0;
  const clearSpacingMm = count > 1 ? actualSpacingMm - diameterMm : availableWidthMm - diameterMm;
  const minSpacing = minClearSpacingMm ?? minCodeClearSpacingMm(diameterMm);

  const warnings = [...extraWarnings];
  const fits = count <= maxBars && (count === 1 || clearSpacingMm >= minSpacing);

  if (count > 1 && clearSpacingMm < minSpacing) {
    warnings.push(
      `${diameterMm}mm বার ${count}টা দিলে clear spacing ${clearSpacingMm.toFixed(1)}mm হয়, যা ন্যূনতম ${minSpacing.toFixed(1)}mm এর কম — একাধিক layer বা মোটা বার বিবেচনা করুন।`
    );
  }

  return {
    barDiameterMm: diameterMm,
    barCount: count,
    providedAreaMm2,
    utilizationRatio,
    actualSpacingMm,
    clearSpacingMm,
    fits,
    warnings,
  };
}

/**
 * Column-এর জন্য বিশেষায়িত helper — required total longitudinal As কে
 * পরিধি বরাবর symmetric bar layout-এ ভাগ করে (rectangular tied column,
 * সব face-এ কমপক্ষে minBarsPerFace থাকে, মোট bar count 4-এর multiple
 * এর কাছাকাছি রাখা হয় যাতে symmetric corner+face layout বাস্তবসম্মত হয়)।
 */
export function selectColumnBarArrangement(input: {
  requiredTotalAreaMm2: number;
  widthMm: number;
  depthMm: number;
  minBarsPerFace?: number; // ডিফল্ট 2 (শুধু corner bars) — চাইলে বাড়িয়ে intermediate bar যোগ করা যায়
  candidateDiametersMm?: number[];
}): BarSelectionResult & { barsAlongWidth: number; barsAlongDepth: number } {
  const { requiredTotalAreaMm2, widthMm, depthMm, minBarsPerFace = 2, candidateDiametersMm } = input;

  const availableWidth = Math.max(widthMm, depthMm) - 100; // মোটামুটি cover+tie allowance, spacing check এ ব্যবহৃত রেফারেন্স হিসেবে

  // মোট bar count কমপক্ষে 4 (৪ কোণা) রাখা হয়েছে — heuristic base selection
  const base = selectRebarArrangement({
    requiredAreaMm2: requiredTotalAreaMm2,
    availableWidthMm: availableWidth,
    minBars: Math.max(4, minBarsPerFace * 2),
    maxBars: 20,
    candidateDiametersMm,
  });

  // মোট bar সংখ্যা পরিধি বরাবর দুই দিকে ভাগ (widthMm/depthMm অনুপাতে) — corner bar গুলো উভয় face এ গণনা হওয়ায় সরলীকৃত সমান-বণ্টন
  const totalBars = base.barCount;
  const widthShare = widthMm / (widthMm + depthMm);
  const barsAlongWidth = Math.max(minBarsPerFace, Math.round((totalBars / 2) * widthShare * 2));
  const barsAlongDepth = Math.max(minBarsPerFace, totalBars - barsAlongWidth + 2); // +2 কারণ ৪ কোণা bar উভয় দিকে shared

  return { ...base, barsAlongWidth, barsAlongDepth };
}
