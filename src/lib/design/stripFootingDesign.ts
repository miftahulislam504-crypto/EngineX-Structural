/**
 * Strip/Continuous Footing — Flexural & Shear Design
 * Phase 7b — Wall বা কলাম-সারির নিচে transverse cantilever, isolated
 * footing (Phase 6e) এর একই cantilever-strip নীতি — computeFootingMoment
 * ও checkFootingOneWayShear সরাসরি পুনঃব্যবহার, শুধু "columnDimensionMm"
 * এর জায়গায় wall/support thickness পাস করা হয়। Punching shear strip
 * footing-এ প্রযোজ্য না (perimeter-based punching শুধু point/small-area
 * load-এর জন্য অর্থপূর্ণ, continuous line support-এর জন্য না) — তাই
 * এই মডিউলে punching shear চেক নেই, one-way shear-ই এখানে governing
 * shear mode (ACI §13.3.3.3 এর wide-beam shear)।
 */

import { computeFootingMoment, designFootingFlexuralReinforcement, type FootingMomentResult } from "@/lib/design/footingFlexure";
import { checkFootingOneWayShear, type FootingOneWayShearResult } from "@/lib/design/footingShear";
import type { FlexuralDesignResult } from "@/lib/design/rcBeamFlexure";

export interface StripFootingDesignInput {
  footingWidthMm: number;
  supportWidthMm: number; // wall thickness বা কলাম dimension, যেদিকে cantilever হিসাব হচ্ছে
  effectiveDepthMm: number;
  thicknessMm: number;
  effectiveCoverMm: number;
  factoredLinearLoadKNPerM: number; // wu (factored), per meter run
  fcMPa: number;
  fyMPa: number;
}

export interface StripFootingDesignReport {
  elementLabel: string;
  factoredSoilPressureKPa: number; // qu = wu / footingWidth
  moment: FootingMomentResult;
  flexuralDesign: FlexuralDesignResult;
  oneWayShear: FootingOneWayShearResult;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

export function runStripFootingDesign(
  input: StripFootingDesignInput & { elementLabel: string }
): StripFootingDesignReport {
  const {
    elementLabel,
    footingWidthMm,
    supportWidthMm,
    effectiveDepthMm,
    thicknessMm,
    effectiveCoverMm,
    factoredLinearLoadKNPerM,
    fcMPa,
    fyMPa,
  } = input;

  const footingWidthM = footingWidthMm / 1000;
  const quKPa = footingWidthM > 0 ? factoredLinearLoadKNPerM / footingWidthM : 0;

  const moment = computeFootingMoment({
    footingDimensionMm: footingWidthMm,
    columnDimensionMm: supportWidthMm,
    factoredSoilPressureKPa: quKPa,
  });

  const flexuralDesign = designFootingFlexuralReinforcement({
    moment,
    thicknessMm,
    effectiveCoverMm,
    fcMPa,
    fyMPa,
  });

  const oneWayShear = checkFootingOneWayShear({
    footingDimensionMm: footingWidthMm,
    columnDimensionMm: supportWidthMm,
    effectiveDepthMm,
    factoredSoilPressureKPa: quKPa,
    fcMPa,
  });

  const allWarnings = [...flexuralDesign.warnings, ...oneWayShear.warnings];

  const hasHardFailure = flexuralDesign.isDoublyReinforced || !oneWayShear.adequate;
  const overallStatus: StripFootingDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : allWarnings.length > 0
      ? "warning"
      : "ok";

  return {
    elementLabel,
    factoredSoilPressureKPa: quKPa,
    moment,
    flexuralDesign,
    oneWayShear,
    allWarnings,
    overallStatus,
  };
}
