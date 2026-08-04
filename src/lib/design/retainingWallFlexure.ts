/**
 * Retaining Wall — Stem & Base Slab Flexural Design
 * Phase 6h — Stem কে একটা vertical cantilever (fixed at base, free at
 * top) হিসেবে treat করা হয়, active pressure দ্বারা লোড হয়ে stem base
 * এ maximum moment হয়। Toe ও Heel কে horizontal cantilever (fixed at
 * stem face) হিসেবে treat করা হয়। সবগুলোই Phase 6a এর rcBeamFlexure.ts
 * পুনঃব্যবহার করে per-meter-width strip design (Phase 6d/6e এর মতোই
 * প্যাটার্ন)।
 */

import { designFlexuralReinforcement, type FlexuralDesignResult } from "@/lib/design/rcBeamFlexure";
import { computeActiveCoefficient } from "@/lib/design/retainingWallPressure";
import type { SoilProperties } from "@/lib/design/retainingWallPressure";

export interface StemDesignInput {
  stemHeightM: number; // hs (base slab top থেকে stem top পর্যন্ত)
  stemBottomThicknessMm: number;
  effectiveCoverMm: number;
  backfillSoil: SoilProperties;
  surchargeKPa?: number;
  fcMPa: number;
  fyMPa: number;
  loadFactor?: number; // active pressure কে factored করতে (ডিফল্ট 1.6, ACI-এর lateral earth pressure H load factor)
}

export interface StemDesignResult {
  factoredMomentAtBaseKNmPerM: number;
  flexuralDesign: FlexuralDesignResult;
}

/**
 * Stem base এ moment: cantilever, triangular (active pressure) +
 * rectangular (surcharge) load distribution থেকে, stem height (hs)
 * এর উপর ভিত্তি করে (stem base slab এর ঠিক উপরে শুরু হয় বলে পুরো
 * wall height H না, শুধু hs ব্যবহার করা হয়)।
 */
export function designStem(input: StemDesignInput): StemDesignResult {
  const { stemHeightM, stemBottomThicknessMm, effectiveCoverMm, backfillSoil, surchargeKPa, fcMPa, fyMPa } = input;
  const loadFactor = input.loadFactor ?? 1.6;

  const ka = computeActiveCoefficient(backfillSoil.frictionAngleDeg);

  // Triangular active pressure over stem height, moment at base = 0.5*ka*γ*hs² * (hs/3)
  const activeMoment = 0.5 * ka * backfillSoil.unitWeightKNm3 * stemHeightM ** 2 * (stemHeightM / 3);
  // Surcharge — uniform rectangular pressure over stem height, moment at base = ka*q*hs * (hs/2)
  const surcharge = surchargeKPa ?? 0;
  const surchargeMoment = ka * surcharge * stemHeightM * (stemHeightM / 2);

  const factoredMoment = loadFactor * (activeMoment + surchargeMoment);

  const flexuralDesign = designFlexuralReinforcement({
    factoredMomentKNm: factoredMoment,
    widthMm: 1000, // per-meter-width strip
    totalDepthMm: stemBottomThicknessMm,
    effectiveCoverMm,
    fcMPa,
    fyMPa,
  });

  return { factoredMomentAtBaseKNmPerM: factoredMoment, flexuralDesign };
}

export interface BaseSlabDesignInput {
  cantileverLengthM: number; // toe বা heel এর দৈর্ঘ্য (stem face থেকে)
  netFactoredPressureKPaPerM: number; // এই cantilever এর জন্য net upward/downward pressure (toe: net bearing upward; heel: soil weight + surcharge downward minus base bearing upward — ইঞ্জিনিয়ার/orchestrator থেকে net value সরবরাহ)
  thicknessMm: number;
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
}

export interface BaseSlabDesignResult {
  factoredMomentKNmPerM: number;
  flexuralDesign: FlexuralDesignResult;
}

/** Toe/Heel — cantilever moment = net pressure × cantilever²/2 (per meter width, rcSlab/footing এর মতোই cantilever-strip প্যাটার্ন)। */
export function designBaseSlabCantilever(input: BaseSlabDesignInput): BaseSlabDesignResult {
  const { cantileverLengthM, netFactoredPressureKPaPerM, thicknessMm, effectiveCoverMm, fcMPa, fyMPa } = input;

  const moment = (Math.abs(netFactoredPressureKPaPerM) * cantileverLengthM ** 2) / 2;

  const flexuralDesign = designFlexuralReinforcement({
    factoredMomentKNm: moment,
    widthMm: 1000,
    totalDepthMm: thicknessMm,
    effectiveCoverMm,
    fcMPa,
    fyMPa,
  });

  return { factoredMomentKNmPerM: moment, flexuralDesign };
}
