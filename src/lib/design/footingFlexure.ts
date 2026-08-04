/**
 * Isolated Footing — Flexural Design
 * Phase 6e — ACI 318-19 §13.3.3 (critical section for moment, at
 * column face — rectangular column ধরা হয়েছে)। Footing কে একটা
 * cantilever slab strip হিসেবে treat করা হয়, যা upward soil pressure
 * (factored, qu) দ্বারা লোড হয় এবং column face এ moment maximum হয়।
 * Phase 6a এর rcBeamFlexure.ts পুনঃব্যবহার করে per-meter-width strip
 * ডিজাইন করা হয় (Phase 6d এর slab flexure এর মতোই প্যাটার্ন)।
 */

import { designFlexuralReinforcement, type FlexuralDesignResult } from "@/lib/design/rcBeamFlexure";

export interface FootingMomentInput {
  footingDimensionMm: number; // এই দিকের footing overall dimension (moment যে দিকে হিসাব হচ্ছে)
  columnDimensionMm: number; // এই দিকের column dimension (cantilever শুরুর রেফারেন্স)
  factoredSoilPressureKPa: number; // qu (factored, ultimate soil pressure — Pu/Area থেকে)
}

export interface FootingMomentResult {
  cantileverLengthMm: number; // column face থেকে footing edge পর্যন্ত
  momentKNmPerM: number; // column face এ moment, per meter width
}

/**
 * Cantilever moment: M = qu × cantilever² / 2 (per meter width strip,
 * qu কে kN/m² থেকে kN/m per-meter-strip হিসেবে সরাসরি ব্যবহার করা
 * যায়, কারণ strip width = 1m ধরা হয়েছে)।
 */
export function computeFootingMoment(input: FootingMomentInput): FootingMomentResult {
  const { footingDimensionMm, columnDimensionMm, factoredSoilPressureKPa } = input;

  const cantileverMm = (footingDimensionMm - columnDimensionMm) / 2;
  const cantileverM = cantileverMm / 1000;

  const moment = (factoredSoilPressureKPa * cantileverM ** 2) / 2;

  return { cantileverLengthMm: cantileverMm, momentKNmPerM: moment };
}

export interface FootingFlexuralDesignInput {
  moment: FootingMomentResult;
  thicknessMm: number;
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
}

export function designFootingFlexuralReinforcement(input: FootingFlexuralDesignInput): FlexuralDesignResult {
  const { moment, thicknessMm, effectiveCoverMm, fcMPa, fyMPa } = input;
  const STRIP_WIDTH_MM = 1000;

  return designFlexuralReinforcement({
    factoredMomentKNm: moment.momentKNmPerM,
    widthMm: STRIP_WIDTH_MM,
    totalDepthMm: thicknessMm,
    effectiveCoverMm,
    fcMPa,
    fyMPa,
  });
}
