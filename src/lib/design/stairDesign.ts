/**
 * RC Stair (Waist Slab) Design — Top-Level Orchestrator
 * ------------------------------------------------------------------
 * sheetIndex.ts-এ S-18 ("Stair Plan & Section, Landing Beam Details")
 * এতদিন `dataStatus: "unmodeled"` ছিল কারণ কোনো stair design module-ই
 * ছিল না — deriveAreaSelfWeightLoads.ts এর নিজস্ব কমেন্টে এই gap
 * স্বীকার করা ছিল। এই ফাইল সেই module।
 *
 * স্ট্রাকচারালভাবে stair waist slab একটা inclined one-way slab —
 * rcSlabDesign.ts/rcSlabFlexure.ts/rcSlabThickness.ts-এর ইতিমধ্যে
 * hand-verified one-way slab logic-ই পুনঃব্যবহার করা হয়েছে (নতুন করে
 * ACI moment-coefficient/flexural formula লেখা হয়নি), শুধু span
 * হিসেবে horizontal clear span-এর বদলে waist slab-এর নিজস্ব inclined
 * slope length ব্যবহার করা হয়েছে (stairGeometry.ts এর
 * deriveStairFlightGeometry() থেকে) — এটাই স্ট্যান্ডার্ড stair-design
 * প্র্যাকটিস (waist slab bending নেয় তার নিজস্ব slope length বরাবর,
 * horizontal projection বরাবর না)।
 *
 * লোড কনভেনশন: factoredLoadKPa ইঞ্জিনিয়ার horizontal plan area-র
 * উপর per-m² দেন (BNBC/ACI standard stair-design practice — live load
 * টেবিল, deriveLiveLoad.ts এর "সিঁড়ি (Staircase)" এন্ট্রি, এবং
 * deriveStairSelfWeightLoads.ts এর self-weight — দুটোই plan-area-ভিত্তিক
 * মান)। moment হিসাবের আগে এই load-কে slope length বরাবর সমতুল্য
 * inclined-length-per-meter লোডে রূপান্তর করা হয় (÷ cos(slopeAngle),
 * কারণ একই plan-area লোড slope length বরাবর কম দূরত্বে "ঘনীভূত" হয়ে
 * পড়ে) — এটাই standard reinforced-concrete-stair-design সরলীকরণ, waist
 * slab কে তার নিজস্ব slope length বরাবর একটা straight one-way slab
 * হিসেবে ট্রিট করার সময় ব্যবহৃত হয়।
 */

import {
  computeSlabDesignMoments,
  designSlabFlexuralReinforcement,
  type SlabMomentResult,
  type SlabFlexuralDesignResult,
} from "@/lib/design/rcSlabFlexure";
import {
  computeSlabMinThickness,
  computeSlabMinReinforcement,
  type SlabMinThicknessResult,
  type SlabMinReinforcementResult,
} from "@/lib/design/rcSlabThickness";
import { deriveStairFlightGeometry, type StairFlightGeometry } from "@/lib/design/stairGeometry";
import type { StairElement } from "@/lib/types/element";

export type StairSupportCondition = "simply-supported" | "one-end-continuous" | "both-ends-continuous";

export interface StairDesignInput {
  elementLabel: string;
  supportCondition: StairSupportCondition;
  thicknessMm: number; // waist slab thickness — সাধারণত element.thickness (import default 150mm, review-recommended)
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
  factoredLoadKPa: number; // wu — horizontal plan-area-ভিত্তিক factored load (dead + live), stairSelfWeight+liveLoad মিলিয়ে ইঞ্জিনিয়ার দেন
}

export interface StairDesignReport {
  elementLabel: string;
  geometry: StairFlightGeometry;
  /** factoredLoadKPa কে slope length বরাবর রূপান্তরিত equivalent load (kN/m² of inclined surface) — moment হিসাবে ব্যবহৃত মান। */
  inclinedFactoredLoadKPa: number;
  moments: SlabMomentResult;
  flexuralDesign: SlabFlexuralDesignResult;
  minThickness: SlabMinThicknessResult;
  minReinforcement: SlabMinReinforcementResult;
  thicknessAdequate: boolean;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

/**
 * একটা StairElement (single flight) এর জন্য পূর্ণ waist-slab design
 * চালায়। element-এর vertices থেকে geometry না বের করা গেলে (৪টা
 * vertex না থাকলে, বা zero run+rise) null রিটার্ন করে এবং কেন সেটা
 * caller-কে জানায় — silently ভুল geometry ধরে নেওয়া হয় না।
 */
export function runStairDesign(
  element: StairElement,
  input: StairDesignInput,
): StairDesignReport | { error: string } {
  const geometry = deriveStairFlightGeometry(element);
  if (!geometry) {
    return {
      error: `"${element.label}" এর vertices থেকে বৈধ flight geometry বের করা যায়নি (৪টা vertex ও শূন্য নয় এমন run/rise দরকার) — element geometry পরীক্ষা করুন।`,
    };
  }

  const allWarnings: string[] = [];

  // plan-area-ভিত্তিক load কে slope length বরাবর সমতুল্য inclined
  // load-এ রূপান্তর — cos(slopeAngle) দিয়ে ভাগ (dividing by cos, না
  // multiply — কারণ slope length > horizontal run, তাই একই মোট লোড
  // ছোট length-এ প্রয়োগ করলে per-length intensity বেশি হওয়া উচিত)।
  const cosAngle = Math.cos(geometry.slopeAngleRad);
  const inclinedFactoredLoadKPa = cosAngle > 1e-6 ? input.factoredLoadKPa / cosAngle : input.factoredLoadKPa;
  if (cosAngle <= 1e-6) {
    allWarnings.push(
      "Slope angle প্রায় ৯০° (উল্লম্ব) — inclined-load রূপান্তর বাদ দিয়ে horizontal load সরাসরি ব্যবহার করা হয়েছে, geometry পরীক্ষা করুন।",
    );
  }

  const isOneWayContinuous = input.supportCondition !== "simply-supported";

  const moments = computeSlabDesignMoments({
    panelType: "one-way",
    shortSpanMm: geometry.slopeLengthM * 1000,
    factoredLoadKPa: inclinedFactoredLoadKPa,
    isOneWayContinuous,
  });

  const flexuralDesign = designSlabFlexuralReinforcement({
    moments,
    thicknessMm: input.thicknessMm,
    effectiveCoverMm: input.effectiveCoverMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
  });

  const minThickness = computeSlabMinThickness({
    edgeCondition: "one-way",
    clearSpanLongDirectionMm: geometry.slopeLengthM * 1000,
    oneWaySpanMm: geometry.slopeLengthM * 1000,
    oneWaySupportCondition: input.supportCondition,
  });

  const minReinforcement = computeSlabMinReinforcement({
    thicknessMm: input.thicknessMm,
    fyMPa: input.fyMPa,
  });

  const thicknessAdequate = input.thicknessMm >= minThickness.minThicknessMm;
  if (!thicknessAdequate) {
    allWarnings.push(
      `Waist slab thickness (${input.thicknessMm}mm) ACI/BNBC deflection-control ন্যূনতম (${minThickness.minThicknessMm.toFixed(0)}mm) থেকে কম — thickness বাড়ান বা deflection সরাসরি চেক করুন।`,
    );
  }

  allWarnings.push(...flexuralDesign.positiveDesign.warnings);
  if (flexuralDesign.negativeDesign) {
    allWarnings.push(...flexuralDesign.negativeDesign.warnings);
  }

  const hasError = !thicknessAdequate && flexuralDesign.positiveDesign.isDoublyReinforced;
  const overallStatus: StairDesignReport["overallStatus"] = hasError ? "error" : !thicknessAdequate ? "warning" : "ok";

  return {
    elementLabel: input.elementLabel,
    geometry,
    inclinedFactoredLoadKPa,
    moments,
    flexuralDesign,
    minThickness,
    minReinforcement,
    thicknessAdequate,
    allWarnings,
    overallStatus,
  };
}
