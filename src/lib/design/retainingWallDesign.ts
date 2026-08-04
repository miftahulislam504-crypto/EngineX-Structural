/**
 * Cantilever Retaining Wall Design — Top-Level Orchestrator
 * Phase 6h — Stability (Overturning/Sliding/Bearing) → Stem Flexure →
 * Toe/Heel Flexure — একসাথে চালিয়ে একটা সম্পূর্ণ
 * RetainingWallDesignReport বানায়।
 */

import {
  checkRetainingWallStability,
  type RetainingWallGeometry,
  type RetainingWallStabilityResult,
} from "@/lib/design/retainingWallStability";
import { designStem, designBaseSlabCantilever, type StemDesignResult, type BaseSlabDesignResult } from "@/lib/design/retainingWallFlexure";
import type { SoilProperties } from "@/lib/design/retainingWallPressure";

export interface RetainingWallDesignInput {
  elementLabel: string;
  geometry: RetainingWallGeometry;
  backfillSoil: SoilProperties;
  surchargeKPa?: number;
  allowableBearingPressureKPa: number;
  frictionCoefficientBaseSoil?: number;
  passiveResistanceDepthM?: number;
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
}

export interface RetainingWallDesignReport {
  elementLabel: string;
  stability: RetainingWallStabilityResult;
  stem: StemDesignResult;
  toe: BaseSlabDesignResult;
  heel: BaseSlabDesignResult;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

export function runRetainingWallDesign(input: RetainingWallDesignInput): RetainingWallDesignReport {
  const stability = checkRetainingWallStability({
    geometry: input.geometry,
    backfillSoil: input.backfillSoil,
    surchargeKPa: input.surchargeKPa,
    allowableBearingPressureKPa: input.allowableBearingPressureKPa,
    frictionCoefficientBaseSoil: input.frictionCoefficientBaseSoil,
    passiveResistanceDepthM: input.passiveResistanceDepthM,
  });

  const stem = designStem({
    stemHeightM: input.geometry.stemHeightM,
    stemBottomThicknessMm: input.geometry.stemBottomThicknessMm,
    effectiveCoverMm: input.effectiveCoverMm,
    backfillSoil: input.backfillSoil,
    surchargeKPa: input.surchargeKPa,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
  });

  // Toe — upward net bearing pressure (average of toe-zone pressure
  // থেকে stem self-weight/soil বাদ, সরলীকরণ হিসেবে stability check
  // এর maxBearingPressure ব্যবহার করে conservative moment বের করা
  // হয়েছে — toe এর নিজের weight ও soil কভারেজ বাদ দেওয়া হয়নি, যা
  // সামান্য রক্ষণশীল)।
  const toe = designBaseSlabCantilever({
    cantileverLengthM: input.geometry.toeWidthM,
    netFactoredPressureKPaPerM: 1.6 * stability.maxBearingPressureKPa, // factored (ACI H-load factor সাথে সামঞ্জস্যপূর্ণ, conservative uniform-max ধরে)
    thicknessMm: input.geometry.baseThicknessMm,
    effectiveCoverMm: input.effectiveCoverMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
  });

  // Heel — downward net load: soil weight + surcharge (upward bearing
  // pressure এই জোনে সাধারণত কম থাকে বলে conservative রাখা হয়েছে,
  // upward bearing বাদ দিয়ে শুধু downward soil+surcharge+self-weight
  // ধরে moment বের করা — net-downward assumption)।
  const surcharge = input.surchargeKPa ?? 0;
  const heelDownwardPressure =
    input.geometry.stemHeightM * input.backfillSoil.unitWeightKNm3 +
    surcharge +
    (input.geometry.baseThicknessMm / 1000) * input.geometry.concreteUnitWeightKNm3;
  const heel = designBaseSlabCantilever({
    cantileverLengthM: input.geometry.heelWidthM,
    netFactoredPressureKPaPerM: 1.2 * heelDownwardPressure, // ACI D-load factor (dead/soil weight)
    thicknessMm: input.geometry.baseThicknessMm,
    effectiveCoverMm: input.effectiveCoverMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
  });

  const allWarnings = [
    ...stability.warnings,
    ...stem.flexuralDesign.warnings,
    ...toe.flexuralDesign.warnings,
    ...heel.flexuralDesign.warnings,
  ];

  const hasHardFailure =
    !stability.overallAdequate ||
    stem.flexuralDesign.isDoublyReinforced ||
    toe.flexuralDesign.isDoublyReinforced ||
    heel.flexuralDesign.isDoublyReinforced;

  const overallStatus: RetainingWallDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : allWarnings.length > 0
      ? "warning"
      : "ok";

  return {
    elementLabel: input.elementLabel,
    stability,
    stem,
    toe,
    heel,
    allWarnings,
    overallStatus,
  };
}
