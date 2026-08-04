/**
 * RC Slab — Flexural Design (Moment Coefficient Method)
 * Phase 6d — ACI 318-19 Chapter 8। FE Analysis Engine (Phase 4a) এর
 * shell element এখনো moment/stress recovery দেয় না (শুধু displacement),
 * তাই slab design FE result এর উপর নির্ভর করতে পারে না — এই মডিউল
 * তার বদলে classical approximate coefficient পদ্ধতি ব্যবহার করে,
 * যা বাস্তব প্র্যাকটিসেও preliminary/routine slab design এ ব্যাপকভাবে
 * ব্যবহৃত হয় (পূর্ণাঙ্গ FEM ছাড়াই)।
 *
 * এক-মুখী (one-way, ly/lx > 2) স্ল্যাব: সরল simply-supported/continuous
 * strip moment, w·l²/8 (simple) বা coefficient টেবিল (continuous) থেকে।
 * দুই-মুখী (two-way, ly/lx ≤ 2): ACI moment coefficient method (পুরনো
 * ACI 318-63 টেবিল-ভিত্তিক পদ্ধতি — ACI 318-19 এ প্রত্যক্ষভাবে নেই,
 * কিন্তু এখনো ব্যাপকভাবে ব্যবহৃত একটা established, conservative
 * approximate পদ্ধতি হিসেবে; rigorous design এর জন্য ACI Direct Design
 * Method বা FEM প্রস্তাবিত, কিন্তু coefficient method preliminary design
 * এ industry-standard)।
 *
 * প্রতিটা moment কে "per meter width" strip হিসেবে ধরে, Phase 6a এর
 * rcBeamFlexure.ts এর ইতিমধ্যে hand-verified flexural design engine
 * পুনঃব্যবহার করা হয়েছে (width = 1000mm একটা strip, slab thickness =
 * beam depth হিসেবে treat করে)।
 */

import { designFlexuralReinforcement, type FlexuralDesignResult } from "@/lib/design/rcBeamFlexure";

export type SlabPanelType = "one-way" | "two-way-interior" | "two-way-edge" | "two-way-corner";

/**
 * ACI moment coefficient (Ca/Cb ইত্যাদির সরলীকৃত সংস্করণ) —
 * two-way panel এর জন্য aspect ratio (m = short/long span) অনুযায়ী,
 * negative (support) ও positive (midspan) moment এর জন্য পৃথক
 * সহগ। এই v1-এ একটা conservative, aspect-ratio-ইন্টারপোলেটেড
 * approximation ব্যবহার করা হয়েছে (m=1.0 বর্গাকার panel থেকে m=0.5
 * পর্যন্ত রৈখিক ইন্টারপোলেশন) — পূর্ণাঙ্গ ACI 13-টা কেসের টেবিল
 * (edge-condition-নির্দিষ্ট) এর বদলে একটা সরলীকৃত, রক্ষণশীল মধ্যবর্তী
 * মান।
 */
function getTwoWayMomentCoefficient(aspectRatioShortOverLong: number, panelType: SlabPanelType): number {
  const m = Math.max(0.5, Math.min(1.0, aspectRatioShortOverLong));
  // m=1.0 (বর্গাকার) → coefficient বেশি (short span বেশি লোড নেয়), m=0.5 → কম
  const baseCoefficient = 0.045 - (1.0 - m) * 0.02; // 0.045 (square) থেকে 0.025 (m=0.5) পর্যন্ত রৈখিক
  const positiveFactor = panelType === "two-way-interior" ? 0.63 : panelType === "two-way-edge" ? 0.8 : 1.0; // interior panel এ continuity বেশি বলে positive moment কম
  return baseCoefficient * positiveFactor;
}

export interface SlabMomentInput {
  panelType: SlabPanelType;
  shortSpanMm: number; // lx (two-way এর জন্য), বা one-way এর span
  longSpanMm?: number; // ly (শুধু two-way panel এর জন্য প্রয়োজন)
  factoredLoadKPa: number; // wu (factored uniformly distributed load, kN/m²)
  isOneWayContinuous?: boolean; // one-way slab continuous না simply-supported (moment coefficient পাল্টায়)
}

export interface SlabMomentResult {
  positiveMomentKNmPerM: number; // midspan moment, per meter width strip
  negativeMomentKNmPerM: number; // support moment, per meter width strip (0 যদি simply-supported)
  governingSpanMm: number; // moment হিসাবে ব্যবহৃত span (short span, two-way এর জন্য)
}

/**
 * Slab moment (per meter width) কম্পিউট করে — one-way হলে সরাসরি
 * w·l²/c (c = 8 simple, 10/11 continuous ACI moment coefficient
 * সরলীকরণ), two-way হলে aspect-ratio-ভিত্তিক coefficient থেকে।
 */
export function computeSlabDesignMoments(input: SlabMomentInput): SlabMomentResult {
  const { panelType, shortSpanMm, longSpanMm, factoredLoadKPa, isOneWayContinuous } = input;
  const wu = factoredLoadKPa; // kN/m² == kN/m per 1m-wide strip

  if (panelType === "one-way") {
    const lM = shortSpanMm / 1000; // m
    if (isOneWayContinuous) {
      // ACI moment coefficient (সরলীকৃত, সাধারণ interior span): +wl²/14, -wl²/10 (support)
      const positive = (wu * lM ** 2) / 14;
      const negative = (wu * lM ** 2) / 10;
      return { positiveMomentKNmPerM: positive, negativeMomentKNmPerM: negative, governingSpanMm: shortSpanMm };
    }
    const positive = (wu * lM ** 2) / 8; // simply-supported
    return { positiveMomentKNmPerM: positive, negativeMomentKNmPerM: 0, governingSpanMm: shortSpanMm };
  }

  if (!longSpanMm || longSpanMm <= 0) {
    throw new Error("longSpanMm is required for two-way slab panels.");
  }

  const m = shortSpanMm / longSpanMm;
  const lM = shortSpanMm / 1000;
  const coefficient = getTwoWayMomentCoefficient(m, panelType);

  const positive = coefficient * wu * lM ** 2;
  // negative (support) moment — continuity factor প্রয়োগ করে positive এর ~1.3× ধরা হয়েছে
  // interior/edge panel এ (conservative approximation, ACI টেবিলের প্যাটার্নের সাথে সঙ্গতিপূর্ণ
  // দিক — support moment সবসময় midspan moment এর চেয়ে বেশি হয় continuous panel এ)
  const negative = panelType === "two-way-corner" ? 0 : positive * 1.3;

  return { positiveMomentKNmPerM: positive, negativeMomentKNmPerM: negative, governingSpanMm: shortSpanMm };
}

export interface SlabFlexuralDesignInput {
  moments: SlabMomentResult;
  thicknessMm: number; // h
  effectiveCoverMm: number; // extreme tension fiber → rebar centroid
  fcMPa: number;
  fyMPa: number;
}

export interface SlabFlexuralDesignResult {
  positiveDesign: FlexuralDesignResult;
  negativeDesign: FlexuralDesignResult | null; // null হলে negative moment নেই (simply-supported/corner panel)
}

/**
 * Slab moment থেকে required As (per meter width) বের করে — Phase
 * 6a এর designFlexuralReinforcement পুনঃব্যবহার করে, width=1000mm
 * একটা "strip beam" হিসেবে ট্রিট করে (স্ল্যাব ডিজাইনের প্রচলিত
 * পদ্ধতি — per-meter-width reinforcement, তারপর bar spacing এ
 * translate করা হয়)।
 */
export function designSlabFlexuralReinforcement(input: SlabFlexuralDesignInput): SlabFlexuralDesignResult {
  const { moments, thicknessMm, effectiveCoverMm, fcMPa, fyMPa } = input;
  const STRIP_WIDTH_MM = 1000;

  const positiveDesign = designFlexuralReinforcement({
    factoredMomentKNm: moments.positiveMomentKNmPerM,
    widthMm: STRIP_WIDTH_MM,
    totalDepthMm: thicknessMm,
    effectiveCoverMm,
    fcMPa,
    fyMPa,
  });

  const negativeDesign =
    moments.negativeMomentKNmPerM > 0
      ? designFlexuralReinforcement({
          factoredMomentKNm: moments.negativeMomentKNmPerM,
          widthMm: STRIP_WIDTH_MM,
          totalDepthMm: thicknessMm,
          effectiveCoverMm,
          fcMPa,
          fyMPa,
        })
      : null;

  return { positiveDesign, negativeDesign };
}

/** As (mm²/m) কে bar spacing (mm c/c) এ রূপান্তর — dia মিলিমিটারে bar diameter। */
export function convertAsToBarSpacing(requiredAsPerMeterMm2: number, barDiameterMm: number): number {
  const barAreaMm2 = (Math.PI / 4) * barDiameterMm * barDiameterMm;
  const STRIP_WIDTH_MM = 1000;
  if (requiredAsPerMeterMm2 <= 0) return STRIP_WIDTH_MM; // moment নেই হলে spacing সীমাবদ্ধ না, max spacing rule প্রযোজ্য (নিচে)
  return (barAreaMm2 * STRIP_WIDTH_MM) / requiredAsPerMeterMm2;
}
