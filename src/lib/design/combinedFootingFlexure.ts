/**
 * Combined Footing — Longitudinal Flexural Design
 * Phase 7a — Footing-কে spacing-এর দিকে একটা "inverted beam" হিসেবে
 * ট্রিট করা হয়: uniform upward factored soil pressure (qu, per meter
 * length, পুরো perpendicular width জুড়ে) সমান upward UDL, এবং দুটো
 * downward point load (column reactions) span-এর দুই পয়েন্টে। এটা
 * একটা statically-determinate beam analysis (কোনো FE বা continuous-
 * beam-with-support-settlement মডেল না) — hand-calculable shear/moment
 * diagram থেকে critical moment বের করা হয়, তারপর rcBeamFlexure.ts
 * পুনঃব্যবহার করে as নির্ণয় (Phase 6a প্যাটার্ন)।
 *
 * Sign convention: soil pressure upward (হগিং/স্যাগিং উভয় সম্ভব —
 * কলামের মাঝে সাধারণত hogging (top tension), কলামের বাইরের
 * cantilever অংশে sagging (bottom tension))। এই মডিউল critical
 * positive ও negative moment উভয়ই বের করে, top ও bottom
 * reinforcement আলাদা করে ডিজাইন করার জন্য।
 */

import { designFlexuralReinforcement, type FlexuralDesignResult } from "@/lib/design/rcBeamFlexure";

export interface CombinedFootingLongitudinalInput {
  footingLengthMm: number;
  footingWidthMm: number; // perpendicular width — qu কে per-meter-length-এ কনভার্ট করতে লাগে
  overhangBeyondColumnAMm: number;
  overhangBeyondColumnBMm: number;
  columnToColumnSpacingMm: number;
  factoredPointLoadAKN: number; // Pu at column A
  factoredPointLoadBKN: number; // Pu at column B
}

export interface CombinedFootingMomentDiagramPoint {
  positionFromNearEdgeMm: number;
  shearKN: number;
  momentKNm: number;
}

export interface CombinedFootingLongitudinalResult {
  factoredUniformPressureKNPerM: number; // qu, per meter length (পুরো width জুড়ে ইতিমধ্যে ইন্টিগ্রেট করা)
  maxSaggingMomentKNm: number; // cantilever/overhang অঞ্চলে (bottom tension)
  maxSaggingMomentPositionMm: number;
  maxHoggingMomentKNm: number; // দুই কলামের মাঝে (top tension) — magnitude (ধনাত্মক হিসেবে রিপোর্ট করা)
  maxHoggingMomentPositionMm: number;
  diagram: CombinedFootingMomentDiagramPoint[];
  warnings: string[];
}

/**
 * Shear/moment diagram নির্ণয় — নমুনা বিন্দুতে (edge, column faces,
 * mid-span, opposite edge) mechanics-of-materials সরাসরি ইন্টিগ্রেশন
 * দিয়ে। ২০টা সমান ভাগে sample করা হয়েছে যথেষ্ট রেজোলিউশনের জন্য;
 * critical moment গুলো (max sagging cantilever tip নয়, বরং zero-shear
 * পয়েন্টে) sample points থেকে numerically approximate করা হয় —
 * closed-form parabolic max বের করার বদলে, কারণ দুই point load থাকায়
 * shear diagram piecewise-linear এবং zero-crossing একাধিক জায়গায়
 * হতে পারে; sampling approach সহজ ও robust।
 */
export function computeCombinedFootingLongitudinalMoments(
  input: CombinedFootingLongitudinalInput
): CombinedFootingLongitudinalResult {
  const {
    footingLengthMm,
    footingWidthMm,
    overhangBeyondColumnAMm,
    columnToColumnSpacingMm,
    factoredPointLoadAKN,
    factoredPointLoadBKN,
  } = input;
  const warnings: string[] = [];

  const totalFactoredLoad = factoredPointLoadAKN + factoredPointLoadBKN;
  const lengthM = footingLengthMm / 1000;
  const widthM = footingWidthMm / 1000;

  if (lengthM <= 0 || widthM <= 0) {
    warnings.push("Footing length/width must be positive to compute longitudinal moments.");
    return {
      factoredUniformPressureKNPerM: 0,
      maxSaggingMomentKNm: 0,
      maxSaggingMomentPositionMm: 0,
      maxHoggingMomentKNm: 0,
      maxHoggingMomentPositionMm: 0,
      diagram: [],
      warnings,
    };
  }

  // Factored uniform upward pressure, per meter of footing length
  // (qu_area × width) — qu_area = totalFactoredLoad / (length × width)
  const quPerM = totalFactoredLoad / lengthM; // kN/m, already integrated across width

  const columnAPositionMm = overhangBeyondColumnAMm;
  const columnBPositionMm = overhangBeyondColumnAMm + columnToColumnSpacingMm;

  const NUM_SAMPLES = 41;
  const diagram: CombinedFootingMomentDiagramPoint[] = [];

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const xMm = (footingLengthMm * i) / (NUM_SAMPLES - 1);
    const xM = xMm / 1000;

    // Shear at x: upward pressure reaction so far, minus point loads already passed (moving left→right)
    let shear = quPerM * xM;
    if (xMm >= columnAPositionMm) shear -= factoredPointLoadAKN;
    if (xMm >= columnBPositionMm) shear -= factoredPointLoadBKN;

    // Moment at x: integral of shear from 0 to x = (qu*x²/2) - PA*(x-xA) - PB*(x-xB), for x past each load
    let moment = (quPerM * xM * xM) / 2;
    if (xMm >= columnAPositionMm) {
      const armM = (xMm - columnAPositionMm) / 1000;
      moment -= factoredPointLoadAKN * armM;
    }
    if (xMm >= columnBPositionMm) {
      const armM = (xMm - columnBPositionMm) / 1000;
      moment -= factoredPointLoadBKN * armM;
    }

    diagram.push({ positionFromNearEdgeMm: xMm, shearKN: shear, momentKNm: moment });
  }

  // Moment sign convention here: positive value from the integration
  // above means sagging is negative bending relative to standard beam
  // convention only if we define pressure as "load"; ধরা হয়েছে qu
  // upward কে positive UDL হিসেবে, তাই M(x) ধনাত্মক মানে soil-pressure
  // dominates (hogging, top fiber tension for a footing loaded from
  // below) এবং ঋণাত্মক মানে column reaction dominates local bending
  // (sagging, bottom fiber tension) — cantilever overhang অংশে।
  let maxHogging = Number.NEGATIVE_INFINITY;
  let maxHoggingPos = 0;
  let maxSagging = Number.POSITIVE_INFINITY; // most negative
  let maxSaggingPos = 0;

  for (const pt of diagram) {
    if (pt.momentKNm > maxHogging) {
      maxHogging = pt.momentKNm;
      maxHoggingPos = pt.positionFromNearEdgeMm;
    }
    if (pt.momentKNm < maxSagging) {
      maxSagging = pt.momentKNm;
      maxSaggingPos = pt.positionFromNearEdgeMm;
    }
  }

  const maxHoggingMomentKNm = Math.max(0, maxHogging);
  const maxSaggingMomentKNm = Math.max(0, -maxSagging); // magnitude, sagging পাশের moment ঋণাত্মক ছিল

  warnings.push(
    "Longitudinal moments are computed via a statically-determinate beam idealization (uniform soil pressure, two point loads) sampled at 41 stations — for irregular column spacing or highly unequal loads, verify critical-section moments manually against the shear/moment diagram."
  );

  return {
    factoredUniformPressureKNPerM: quPerM,
    maxSaggingMomentKNm,
    maxSaggingMomentPositionMm: maxSaggingPos,
    maxHoggingMomentKNm,
    maxHoggingMomentPositionMm: maxHoggingPos,
    diagram,
    warnings,
  };
}

export interface CombinedFootingLongitudinalDesignInput {
  moments: CombinedFootingLongitudinalResult;
  thicknessMm: number;
  effectiveCoverMm: number;
  footingWidthMm: number; // reinforcement per-meter-width বের করার পর পুরো width-এর জন্য as বের করতে লাগে
  fcMPa: number;
  fyMPa: number;
}

export interface CombinedFootingLongitudinalDesignResult {
  topReinforcement: FlexuralDesignResult; // hogging moment এর জন্য (top steel, কলামের মাঝে)
  bottomReinforcement: FlexuralDesignResult; // sagging moment এর জন্য (bottom steel, overhang অঞ্চলে)
  warnings: string[];
}

/**
 * rcBeamFlexure.ts এর designFlexuralReinforcement সরাসরি পুনঃব্যবহার
 * — কিন্তু এখানে ইনপুট per-meter-width মোমেন্ট না বরং পুরো footing
 * width জুড়ে total moment (কারণ longitudinal moment ইতিমধ্যে
 * quPerM = pressure × width থেকে এসেছে, একটা beam-strip না গোটা
 * footing width)। তাই bw হিসেবে পুরো footingWidthMm পাস করা হয় (per-
 * meter-strip না)।
 */
export function designCombinedFootingLongitudinalReinforcement(
  input: CombinedFootingLongitudinalDesignInput
): CombinedFootingLongitudinalDesignResult {
  const { moments, thicknessMm, effectiveCoverMm, footingWidthMm, fcMPa, fyMPa } = input;

  const topReinforcement = designFlexuralReinforcement({
    factoredMomentKNm: moments.maxHoggingMomentKNm,
    widthMm: footingWidthMm,
    totalDepthMm: thicknessMm,
    effectiveCoverMm,
    fcMPa,
    fyMPa,
  });

  const bottomReinforcement = designFlexuralReinforcement({
    factoredMomentKNm: moments.maxSaggingMomentKNm,
    widthMm: footingWidthMm,
    totalDepthMm: thicknessMm,
    effectiveCoverMm,
    fcMPa,
    fyMPa,
  });

  return {
    topReinforcement,
    bottomReinforcement,
    warnings: [...moments.warnings],
  };
}
