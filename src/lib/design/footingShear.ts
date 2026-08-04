/**
 * Isolated Footing — Shear Checks
 * Phase 6e — ACI 318-19 §13.3.3.3 (one-way/wide-beam shear, critical
 * section at d from column face) ও two-way (punching) shear, যা
 * Phase 6d এর rcSlabPunchingShear.ts পুনঃব্যবহার করে (একই ACI §22.6
 * সূত্র, footing এর ক্ষেত্রেও প্রযোজ্য — ACI নিজেই footing punching
 * shear কে slab এর মতো একই ধারায় রাখে)।
 */

import { checkPunchingShear, type ColumnPosition, type PunchingShearResult } from "@/lib/design/rcSlabPunchingShear";

export interface FootingOneWayShearInput {
  footingDimensionMm: number; // যে দিকে shear চেক হচ্ছে, তার overall footing dimension
  columnDimensionMm: number; // ঐ দিকের column dimension
  effectiveDepthMm: number; // d
  factoredSoilPressureKPa: number; // qu
  fcMPa: number;
}

export interface FootingOneWayShearResult {
  criticalSectionDistanceFromCenterMm: number; // column face + d থেকে footing edge পর্যন্ত দূরত্ব (moment arm for Vu)
  factoredShearKNPerM: number; // Vu, per meter width
  phiVcKNPerM: number;
  utilizationRatio: number;
  adequate: boolean;
  warnings: string[];
}

/**
 * One-way shear — critical section column face থেকে d দূরে (ACI
 * §13.3.3.3, ফুটিং কে একটা wide beam হিসেবে ট্রিট করে)। Vc = 0.17λ√f'c·bw·d
 * (ACI §22.5.5.1, rcBeamShear.ts এর মতোই সূত্র, φ=0.75)।
 */
export function checkFootingOneWayShear(input: FootingOneWayShearInput): FootingOneWayShearResult {
  const { footingDimensionMm, columnDimensionMm, effectiveDepthMm, factoredSoilPressureKPa, fcMPa } = input;
  const warnings: string[] = [];
  const phi = 0.75;

  const cantileverMm = (footingDimensionMm - columnDimensionMm) / 2;
  const criticalDistanceMm = cantileverMm - effectiveDepthMm;

  if (criticalDistanceMm <= 0) {
    // critical section footing edge এর বাইরে চলে যায় — মানে d
    // যথেষ্ট বড়, one-way shear governs না (punching বেশি সংকটজনক
    // হবে)।
    return {
      criticalSectionDistanceFromCenterMm: 0,
      factoredShearKNPerM: 0,
      phiVcKNPerM: 0,
      utilizationRatio: 0,
      adequate: true,
      warnings: [
        "Critical section for one-way shear falls outside the footing edge (d is large relative to cantilever) — one-way shear does not govern; punching shear typically governs for such footings.",
      ],
    };
  }

  const criticalDistanceM = criticalDistanceMm / 1000;
  const Vu = factoredSoilPressureKPa * criticalDistanceM; // kN per meter width

  const VcN = 0.17 * Math.sqrt(fcMPa) * 1000 * effectiveDepthMm; // bw=1000mm strip
  const phiVc = (phi * VcN) / 1000; // N → kN

  const ratio = phiVc > 0 ? Vu / phiVc : Number.POSITIVE_INFINITY;
  const adequate = Number.isFinite(ratio) && ratio <= 1.0;

  if (!adequate) {
    warnings.push(
      `One-way shear Vu (${Vu.toFixed(1)} kN/m) exceeds capacity φVc (${phiVc.toFixed(1)} kN/m) — increase footing thickness.`
    );
  }

  return {
    criticalSectionDistanceFromCenterMm: criticalDistanceMm,
    factoredShearKNPerM: Vu,
    phiVcKNPerM: phiVc,
    utilizationRatio: ratio,
    adequate,
    warnings,
  };
}

export interface FootingPunchingShearInput {
  columnWidthMm: number;
  columnDepthMm: number;
  effectiveDepthMm: number;
  fcMPa: number;
  columnPosition: ColumnPosition; // isolated footing এ সাধারণত "interior" (column চারদিকে ঘেরা)
  factoredColumnLoadKN: number; // Pu (net, footing self-weight/soil overburden বাদ দেওয়ার পর — সরলীকরণ হিসেবে gross Pu ব্যবহার করা যায়, রক্ষণশীল)
}

/** Footing punching shear — rcSlabPunchingShear.ts এর checkPunchingShear সরাসরি পুনঃব্যবহার (একই ACI §22.6 সূত্র)। */
export function checkFootingPunchingShear(input: FootingPunchingShearInput): PunchingShearResult {
  return checkPunchingShear({
    columnWidthMm: input.columnWidthMm,
    columnDepthMm: input.columnDepthMm,
    slabEffectiveDepthMm: input.effectiveDepthMm,
    fcMPa: input.fcMPa,
    columnPosition: input.columnPosition,
    factoredShearKN: input.factoredColumnLoadKN,
  });
}
