/**
 * Stirrup / Tie Zone Layout
 * Phase 10b — Detailing ইঞ্জিনের দ্বিতীয় ধাপ।
 *
 * Phase 6a-এর designShearReinforcement() একটা POINT-এ (single factoredShearKN)
 * spacing বের করে; Phase 6b/rcColumnReinforcement.ts-এর checkTieSpacing()
 * একটা uniform max spacing দেয়। বাস্তবে shear span বরাবর বদলায় (সাপোর্টের
 * কাছে বেশি, মিডস্প্যানে কম) — তাই real drawing (MICON রেফারেন্স) buildable
 * ZONE-এ ভাগ করে দেখায় (যেমন "10mm@5/7/5"c/c" — সাপোর্ট/মিড/সাপোর্ট তিন
 * zone)। এই ফাইল সেই zone-এ ভাগ করার কাজ করে, existing point-check ফাংশন
 * দুটোই reuse করে।
 *
 * সীমাবদ্ধতা (v1, ইচ্ছাকৃতভাবে flagged):
 *   - Beam-এর ভিতরে shear শুধু ২টা sample point (support critical section +
 *     midspan) দিয়ে ধরা হয়েছে — একটা সম্পূর্ণ shear diagram (FE analysis
 *     থেকে multi-point) integrate করা এখনো হয়নি, সেটা future improvement।
 *   - Seismic special-moment-frame confinement zone length (lo) ACI 318-19
 *     §18.6.4.1 (beam: 2×depth) ও §18.7.5.1 (column: max(depth,
 *     clearHeight/6, 450mm)) থেকে সরাসরি নেওয়া, ওয়েব সার্চে confirm করা।
 *   - কিন্তু confinement zone-এর ভিতরের spacing (so) শুধু সরলীকৃত bound
 *     ব্যবহার করে (min(¼ dimension, 6×longBarDia, 150mm)) — ACI Table
 *     18.7.5.4-এর axial-load/hx-নির্ভর পূর্ণাঙ্গ refinement এখানে নেই,
 *     কারণ সেটার নির্ভরযোগ্য সূত্র search-এ পরিষ্কারভাবে confirm করা যায়নি।
 *     এটা honestly একটা simplification, পূর্ণাঙ্গ code check না।
 */

import { designShearReinforcement, type ShearDesignInput } from "@/lib/design/rcBeamShear";
import { checkTieSpacing } from "@/lib/design/rcColumnReinforcement";

const PRACTICAL_SPACING_INCREMENT_MM = 25;

function roundDownToIncrement(valueMm: number): number {
  return Math.max(PRACTICAL_SPACING_INCREMENT_MM, Math.floor(valueMm / PRACTICAL_SPACING_INCREMENT_MM) * PRACTICAL_SPACING_INCREMENT_MM);
}

// ---------------------------------------------------------------------------
// Beam — stirrup zones
// ---------------------------------------------------------------------------
export interface BeamStirrupZoneInput {
  elementLabel: string;
  clearSpanMm: number;
  supportShear: ShearDesignInput; // সাপোর্টের কাছের critical section (d away from face)
  midspanShear: ShearDesignInput; // মিডস্প্যান
  useSeismicConfinement?: boolean;
  smallestLongitudinalBarDiameterMm?: number; // seismic spacing bound-এর জন্য (থাকলে)
}

export interface StirrupZone {
  label: string; // "Support Zone" | "Midspan Zone"
  lengthMm: number;
  spacingMm: number;
  stirrupDiameterMm: number;
}

export interface BeamStirrupZoneResult {
  elementLabel: string;
  zones: StirrupZone[]; // [Support, Midspan, Support] — MICON-এর "5/7/5"-স্টাইল প্যাটার্ন
  seismicConfinementLengthMm: number | null; // §18.6.4.1 lo = 2×depth, useSeismicConfinement=false হলে null
  warnings: string[];
}

export function layoutBeamStirrupZones(input: BeamStirrupZoneInput): BeamStirrupZoneResult {
  const warnings: string[] = [];
  const supportResult = designShearReinforcement(input.supportShear);
  const midspanResult = designShearReinforcement(input.midspanShear);
  warnings.push(...supportResult.warnings, ...midspanResult.warnings);

  let supportSpacingMm = roundDownToIncrement(supportResult.requiredSpacingMm ?? supportResult.maxSpacingMm);
  const midspanSpacingMm = roundDownToIncrement(midspanResult.requiredSpacingMm ?? midspanResult.maxSpacingMm);

  let seismicConfinementLengthMm: number | null = null;
  if (input.useSeismicConfinement) {
    seismicConfinementLengthMm = 2 * input.supportShear.effectiveDepthMm; // depth ≈ effectiveDepth-এর কাছাকাছি proxy হিসেবে, h না d — v1 সরলীকরণ

    if (input.smallestLongitudinalBarDiameterMm) {
      // ACI 318-19 §18.6.4.4-এর সরলীকৃত bound (v1): min(d/4, 6×longBarDia, 150mm)
      const seismicBoundMm = Math.min(
        input.supportShear.effectiveDepthMm / 4,
        6 * input.smallestLongitudinalBarDiameterMm,
        150,
      );
      const seismicSpacingMm = roundDownToIncrement(seismicBoundMm);
      if (seismicSpacingMm < supportSpacingMm) {
        supportSpacingMm = seismicSpacingMm; // seismic bound শক্তিশালী হলে সেটাই governs
      }
    }
    warnings.push(
      "Seismic confinement zone length (2×depth) ACI §18.6.4.1 থেকে সরাসরি নেওয়া, কিন্তু ভিতরের spacing একটা simplified bound — Table 18.7.5.4-এর axial-load/hx-নির্ভর পূর্ণাঙ্গ চেক এখানে নেই।",
    );
  }

  if (midspanSpacingMm < supportSpacingMm) {
    // মিডস্প্যানে সাধারণত shear কম থাকে, তাই spacing বেশি হওয়া উচিত —
    // উল্টো হলে (input ভুল বা asymmetric loading) flag করা হলো, override করা হয় না
    warnings.push(
      `Midspan spacing (${midspanSpacingMm}mm) সাপোর্ট spacing (${supportSpacingMm}mm)-এর চেয়ে ছোট এসেছে — সাধারণত এর উল্টোটা হওয়া উচিত, input shear ভ্যালু যাচাই করুন।`,
    );
  }

  const supportZoneLengthMm = seismicConfinementLengthMm ?? Math.round(input.clearSpanMm / 4); // non-seismic v1 default: quarter-span প্রতি পাশে (প্রচলিত প্র্যাকটিস, MICON-এর L/4-স্টাইল প্যাটার্নের সাথে সামঞ্জস্যপূর্ণ)
  const midspanZoneLengthMm = Math.max(0, input.clearSpanMm - 2 * supportZoneLengthMm);

  if (midspanZoneLengthMm === 0) {
    warnings.push("Support zone দুইটা মিলে পুরো span কভার করে ফেলছে — clearSpanMm বা zone length পুনর্বিবেচনা করুন।");
  }

  return {
    elementLabel: input.elementLabel,
    zones: [
      { label: "Support Zone", lengthMm: supportZoneLengthMm, spacingMm: supportSpacingMm, stirrupDiameterMm: input.supportShear.stirrupDiameterMm },
      { label: "Midspan Zone", lengthMm: midspanZoneLengthMm, spacingMm: midspanSpacingMm, stirrupDiameterMm: input.midspanShear.stirrupDiameterMm },
      { label: "Support Zone", lengthMm: supportZoneLengthMm, spacingMm: supportSpacingMm, stirrupDiameterMm: input.supportShear.stirrupDiameterMm },
    ],
    seismicConfinementLengthMm,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Column — tie zones
// ---------------------------------------------------------------------------
export interface ColumnTieZoneInput {
  elementLabel: string;
  clearHeightMm: number;
  widthMm: number;
  totalDepthMm: number;
  longitudinalBarDiameterMm: number;
  tieDiameterMm: number;
  useSeismicConfinement?: boolean;
}

export interface ColumnTieZoneResult {
  elementLabel: string;
  zones: StirrupZone[]; // [End Zone (lo), Mid Zone, End Zone (lo)]
  generalMaxSpacingMm: number; // ACI §25.7.2.1 (সবসময় প্রযোজ্য, non-seismic ভিত্তি)
  seismicConfinementLengthMm: number | null;
  warnings: string[];
}

export function layoutColumnTieZones(input: ColumnTieZoneInput): ColumnTieZoneResult {
  const warnings: string[] = [];
  const minDimensionMm = Math.min(input.widthMm, input.totalDepthMm);

  const generalCheck = checkTieSpacing({
    longitudinalBarDiameterMm: input.longitudinalBarDiameterMm,
    tieDiameterMm: input.tieDiameterMm,
    minColumnDimensionMm: minDimensionMm,
  });
  const generalSpacingMm = roundDownToIncrement(generalCheck.maxSpacingMm);

  let seismicConfinementLengthMm: number | null = null;
  let endZoneSpacingMm = generalSpacingMm;

  if (input.useSeismicConfinement) {
    // ACI 318-19 §18.7.5.1 — lo = max(column depth, clear height/6, 450mm)
    seismicConfinementLengthMm = Math.max(input.totalDepthMm, input.clearHeightMm / 6, 450);

    // সরলীকৃত (v1) confinement spacing bound: min(¼ min dimension, 6×longBarDia, 150mm)
    const seismicBoundMm = Math.min(minDimensionMm / 4, 6 * input.longitudinalBarDiameterMm, 150);
    endZoneSpacingMm = Math.min(generalSpacingMm, roundDownToIncrement(seismicBoundMm));

    warnings.push(
      "Seismic confinement zone length (lo) ACI §18.7.5.1 থেকে সরাসরি নেওয়া, কিন্তু ভিতরের spacing একটা simplified bound — Table 18.7.5.4-এর axial-load/hx-নির্ভর পূর্ণাঙ্গ চেক এখানে নেই।",
    );
  }

  const endZoneLengthMm = seismicConfinementLengthMm ?? Math.round(input.clearHeightMm / 6); // non-seismic v1 default
  const midZoneLengthMm = Math.max(0, input.clearHeightMm - 2 * endZoneLengthMm);

  if (midZoneLengthMm === 0) {
    warnings.push("End zone দুইটা মিলে পুরো clear height কভার করে ফেলছে — clearHeightMm পুনর্বিবেচনা করুন।");
  }

  return {
    elementLabel: input.elementLabel,
    zones: [
      { label: "End Zone", lengthMm: endZoneLengthMm, spacingMm: endZoneSpacingMm, stirrupDiameterMm: input.tieDiameterMm },
      { label: "Mid Zone", lengthMm: midZoneLengthMm, spacingMm: generalSpacingMm, stirrupDiameterMm: input.tieDiameterMm },
      { label: "End Zone", lengthMm: endZoneLengthMm, spacingMm: endZoneSpacingMm, stirrupDiameterMm: input.tieDiameterMm },
    ],
    generalMaxSpacingMm: generalSpacingMm,
    seismicConfinementLengthMm,
    warnings: [...warnings, ...generalCheck.warnings],
  };
}
