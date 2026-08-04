/**
 * Retaining Wall — Stability Checks (Overturning, Sliding, Bearing)
 * Phase 6h — Classical cantilever retaining wall stability analysis।
 * ইঞ্জিনিয়ার wall geometry (stem, base, toe, heel dimension) সরবরাহ
 * করেন — geometry থেকে self-weight ও soil-weight-on-heel গণনা করে,
 * তারপর overturning/resisting moment নেওয়া হয় toe (front bottom
 * corner) এর সাপেক্ষে।
 *
 * Sign convention: সব moment toe বিন্দুর সাপেক্ষে, driving (overturning)
 * বনাম resisting — resisting/driving ≥ FS হলে adequate।
 */

import { computeActivePressure, type SoilProperties } from "@/lib/design/retainingWallPressure";

export interface RetainingWallGeometry {
  stemHeightM: number; // hs — stem এর উচ্চতা (base slab এর উপরের অংশ)
  stemTopThicknessMm: number;
  stemBottomThicknessMm: number;
  baseThicknessMm: number;
  toeWidthM: number; // stem front face থেকে base এর সামনের প্রান্ত পর্যন্ত
  heelWidthM: number; // stem back face থেকে base এর পেছনের প্রান্ত পর্যন্ত
  concreteUnitWeightKNm3: number; // সাধারণত 24
}

export interface RetainingWallStabilityInput {
  geometry: RetainingWallGeometry;
  backfillSoil: SoilProperties;
  surchargeKPa?: number;
  allowableBearingPressureKPa: number;
  frictionCoefficientBaseSoil?: number; // μ, base-soil interface friction coefficient — না দিলে tan(2φ/3) (প্রচলিত conservative estimate, φ backfill soil এর)
  passiveResistanceDepthM?: number; // toe এর সামনে soil depth (passive resistance এর জন্য) — না দিলে passive resistance বাদ (conservative)
}

export interface RetainingWallStabilityResult {
  totalWallHeightM: number; // H = stemHeightM + baseThicknessMm/1000
  activePressureForceKNPerM: number;
  wallSelfWeightKNPerM: number;
  soilWeightOnHeelKNPerM: number;
  totalVerticalLoadKNPerM: number; // ΣV
  overturningMomentKNmPerM: number;
  resistingMomentKNmPerM: number;
  factorOfSafetyOverturning: number;
  factorOfSafetySliding: number;
  eccentricityM: number; // e, resultant এর base centerline থেকে দূরত্ব
  maxBearingPressureKPa: number;
  minBearingPressureKPa: number; // ঋণাত্মক হলে uplift/tension নির্দেশ করে (অগ্রহণযোগ্য)
  bearingAdequate: boolean;
  overallAdequate: boolean;
  warnings: string[];
}

export function checkRetainingWallStability(input: RetainingWallStabilityInput): RetainingWallStabilityResult {
  const { geometry, backfillSoil, surchargeKPa, allowableBearingPressureKPa } = input;
  const warnings: string[] = [];

  const baseThicknessM = geometry.baseThicknessMm / 1000;
  const totalHeight = geometry.stemHeightM + baseThicknessM;
  const baseWidth = geometry.toeWidthM + geometry.heelWidthM + (geometry.stemBottomThicknessMm / 1000); // toe + stem width + heel

  // Active pressure (পুরো wall height H ধরে, base সহ)
  const activePressure = computeActivePressure({
    soil: backfillSoil,
    wallHeightM: totalHeight,
    surchargeKPa,
  });
  const Pa = activePressure.resultantForceKNPerM;
  const PaHeight = activePressure.resultantHeightFromBaseM;
  const Psur = activePressure.surchargeForceKNPerM;
  const PsurHeight = activePressure.surchargeHeightFromBaseM;

  const overturningMoment = Pa * PaHeight + Psur * PsurHeight;

  // Self-weight breakdown: stem (trapezoidal, top+bottom thickness average) + base slab + soil-on-heel
  const stemAvgThicknessM = (geometry.stemTopThicknessMm + geometry.stemBottomThicknessMm) / 2 / 1000;
  const stemWeight = stemAvgThicknessM * geometry.stemHeightM * geometry.concreteUnitWeightKNm3;
  const baseWeight = baseWidth * baseThicknessM * geometry.concreteUnitWeightKNm3;
  const wallSelfWeight = stemWeight + baseWeight;

  const soilWeightOnHeel = geometry.heelWidthM * geometry.stemHeightM * backfillSoil.unitWeightKNm3;

  const totalVerticalLoad = wallSelfWeight + soilWeightOnHeel;

  // Resisting moment — প্রতিটা vertical force এর moment arm toe থেকে
  // (toe = x=0 ধরে, base এর front edge)। stem centroid ≈ toeWidth +
  // stemBottomThickness/2 (সরলীকরণ — trapezoidal stem এর জন্য
  // approximate centroid, রক্ষণশীলভাবে rectangular ধরে)।
  const stemCentroidX = geometry.toeWidthM + geometry.stemBottomThicknessMm / 1000 / 2;
  const baseCentroidX = baseWidth / 2;
  const heelSoilCentroidX = geometry.toeWidthM + geometry.stemBottomThicknessMm / 1000 + geometry.heelWidthM / 2;

  const resistingMoment =
    stemWeight * stemCentroidX + baseWeight * baseCentroidX + soilWeightOnHeel * heelSoilCentroidX;

  const FSOverturning = overturningMoment > 0 ? resistingMoment / overturningMoment : Number.POSITIVE_INFINITY;

  // Sliding — friction resistance (± passive resistance, ঐচ্ছিক)
  const mu = input.frictionCoefficientBaseSoil ?? Math.tan(((2 / 3) * backfillSoil.frictionAngleDeg * Math.PI) / 180);
  const frictionResistance = mu * totalVerticalLoad;

  let passiveResistance = 0;
  if (input.passiveResistanceDepthM && input.passiveResistanceDepthM > 0) {
    const kp = Math.tan(Math.PI / 4 + (backfillSoil.frictionAngleDeg * Math.PI) / 180 / 2) ** 2;
    passiveResistance = 0.5 * kp * backfillSoil.unitWeightKNm3 * input.passiveResistanceDepthM ** 2;
    warnings.push(
      "Passive resistance is included — verify the soil in front of the toe will not be removed/eroded over the structure's life; many designs conservatively neglect passive resistance."
    );
  }

  const totalSlidingForce = Pa + Psur;
  const totalResistingForce = frictionResistance + passiveResistance;
  const FSSliding = totalSlidingForce > 0 ? totalResistingForce / totalSlidingForce : Number.POSITIVE_INFINITY;

  // Bearing pressure — eccentricity e = B/2 − (ΣM_resisting − ΣM_overturning)/ΣV
  const netMoment = resistingMoment - overturningMoment;
  const xBar = totalVerticalLoad > 0 ? netMoment / totalVerticalLoad : 0;
  const eccentricity = baseWidth / 2 - xBar;

  let maxBearing: number;
  let minBearing: number;
  if (Math.abs(eccentricity) <= baseWidth / 6) {
    // resultant within middle third — সম্পূর্ণ base compression এ (কোনো uplift না)
    maxBearing = (totalVerticalLoad / baseWidth) * (1 + (6 * eccentricity) / baseWidth);
    minBearing = (totalVerticalLoad / baseWidth) * (1 - (6 * eccentricity) / baseWidth);
  } else if (Math.abs(eccentricity) < baseWidth / 2) {
    // middle-third এর বাইরে কিন্তু resultant এখনো base এর ভেতরে —
    // effective-width পদ্ধতি (Meyerhof) দিয়ে redistribute
    warnings.push(
      "Resultant falls outside the middle third of the base — using the Meyerhof effective-width method; consider widening the base (especially the heel) to bring the resultant within the middle third for a more conventional design."
    );
    const effectiveWidth = 2 * (baseWidth / 2 - Math.abs(eccentricity));
    maxBearing = effectiveWidth > 0 ? totalVerticalLoad / effectiveWidth : Number.POSITIVE_INFINITY;
    minBearing = 0;
  } else {
    // eccentricity ≥ B/2 — resultant base এর বাইরে চলে গেছে, যা
    // physically অর্থহীন bearing pressure (Infinity) নির্দেশ করে।
    // Infinity propagate না করে একটা explicit bounded failure state
    // দেওয়া হচ্ছে (rcColumnSlenderness.ts এর একই প্যাটার্ন অনুসরণ করে)।
    warnings.push(
      "The resultant load falls outside the base entirely (eccentricity ≥ B/2) — the base is grossly undersized and bearing pressure is undefined; widen the base significantly before proceeding."
    );
    maxBearing = Number.POSITIVE_INFINITY;
    minBearing = Number.NEGATIVE_INFINITY;
  }

  const bearingAdequate = Number.isFinite(maxBearing) && maxBearing <= allowableBearingPressureKPa;

  if (!bearingAdequate && Number.isFinite(maxBearing)) {
    warnings.push(
      `Maximum bearing pressure (${maxBearing.toFixed(1)} kPa) exceeds the allowable bearing pressure (${allowableBearingPressureKPa.toFixed(1)} kPa) — widen the base or improve the soil.`
    );
  }

  if (FSOverturning < 2.0) {
    warnings.push(
      `Factor of safety against overturning (${FSOverturning.toFixed(2)}) is below the commonly required minimum of 2.0 — widen the base (especially the heel) or reduce wall height.`
    );
  }

  if (FSSliding < 1.5) {
    warnings.push(
      `Factor of safety against sliding (${FSSliding.toFixed(2)}) is below the commonly required minimum of 1.5 — add a shear key, increase base width, or rely on passive resistance (with caution).`
    );
  }

  const overallAdequate = FSOverturning >= 2.0 && FSSliding >= 1.5 && bearingAdequate && minBearing >= 0;

  if (minBearing < 0) {
    warnings.push(
      "Minimum bearing pressure is negative (net uplift at the heel) — this is not acceptable for a soil-bearing foundation; the base must be widened."
    );
  }

  return {
    totalWallHeightM: totalHeight,
    activePressureForceKNPerM: Pa + Psur,
    wallSelfWeightKNPerM: wallSelfWeight,
    soilWeightOnHeelKNPerM: soilWeightOnHeel,
    totalVerticalLoadKNPerM: totalVerticalLoad,
    overturningMomentKNmPerM: overturningMoment,
    resistingMomentKNmPerM: resistingMoment,
    factorOfSafetyOverturning: FSOverturning,
    factorOfSafetySliding: FSSliding,
    eccentricityM: eccentricity,
    maxBearingPressureKPa: maxBearing,
    minBearingPressureKPa: minBearing,
    bearingAdequate,
    overallAdequate,
    warnings,
  };
}
