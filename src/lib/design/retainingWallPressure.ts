/**
 * Retaining Wall — Lateral Earth Pressure (Rankine Theory)
 * Phase 6h — Rankine active/passive earth pressure — সবচেয়ে প্রচলিত
 * সরলীকৃত তত্ত্ব cantilever retaining wall design এ (vertical wall
 * back face, horizontal backfill ধরে — Coulomb theory এর মতো
 * wall-friction/battered-face জটিলতা এড়িয়ে)। এই app কোনো geotechnical
 * investigation করে না — soil unit weight, friction angle (φ), ও
 * cohesion (c, সাধারণত cohesionless backfill এ 0 ধরা হয়) geotechnical
 * report থেকে ইঞ্জিনিয়ার সরবরাহ করেন।
 */

export interface SoilProperties {
  unitWeightKNm3: number; // γ, soil unit weight
  frictionAngleDeg: number; // φ, internal friction angle
  cohesionKPa?: number; // c, সাধারণত cohesionless granular backfill এ 0 (ডিফল্ট)
}

/** Rankine active earth pressure coefficient: Ka = tan²(45° − φ/2)। */
export function computeActiveCoefficient(frictionAngleDeg: number): number {
  const phiRad = (frictionAngleDeg * Math.PI) / 180;
  return Math.tan(Math.PI / 4 - phiRad / 2) ** 2;
}

/** Rankine passive earth pressure coefficient: Kp = tan²(45° + φ/2)। */
export function computePassiveCoefficient(frictionAngleDeg: number): number {
  const phiRad = (frictionAngleDeg * Math.PI) / 180;
  return Math.tan(Math.PI / 4 + phiRad / 2) ** 2;
}

export interface ActivePressureResult {
  ka: number;
  resultantForceKNPerM: number; // Pa, per meter length of wall — cohesion থাকলে tension-crack effect বাদ (সরলীকরণ, cohesionless backfill এর জন্য সবচেয়ে নির্ভুল)
  resultantHeightFromBaseM: number; // resultant force এর ক্রিয়ারেখা base থেকে উচ্চতা (H/3, ত্রিভুজাকার pressure distribution ধরে)
  surchargeForceKNPerM: number; // surcharge (uniform, ঐচ্ছিক) থেকে অতিরিক্ত বল
  surchargeHeightFromBaseM: number; // surcharge force এর ক্রিয়ারেখা (H/2, uniform rectangular distribution)
}

export interface ActivePressureInput {
  soil: SoilProperties;
  wallHeightM: number; // H — retained soil height (stem + base thickness, ground level থেকে base পর্যন্ত)
  surchargeKPa?: number; // ঐচ্ছিক uniform surcharge (traffic load, adjacent structure ইত্যাদি)
}

/**
 * Active pressure resultant: Pa = 0.5·Ka·γ·H² (per meter length)।
 * Cohesion থাকলে tension crack এর গভীরতা (zc = 2c/(√Ka·γ)) থেকে
 * pressure diagram-এর উপরের অংশ বাদ যায় — এই v1-এ সরলীকরণ হিসেবে
 * cohesion=0 (cohesionless backfill) এ optimized, cohesion>0 দিলে
 * conservative হিসেবে cohesion এর প্রভাব উপেক্ষা করা হয় (শুধু warning)।
 */
export function computeActivePressure(input: ActivePressureInput): ActivePressureResult {
  const { soil, wallHeightM, surchargeKPa } = input;
  const ka = computeActiveCoefficient(soil.frictionAngleDeg);

  const resultantForce = 0.5 * ka * soil.unitWeightKNm3 * wallHeightM ** 2;
  const resultantHeight = wallHeightM / 3;

  const surcharge = surchargeKPa ?? 0;
  const surchargeForce = ka * surcharge * wallHeightM;
  const surchargeHeight = wallHeightM / 2;

  return {
    ka,
    resultantForceKNPerM: resultantForce,
    resultantHeightFromBaseM: resultantHeight,
    surchargeForceKNPerM: surchargeForce,
    surchargeHeightFromBaseM: surchargeHeight,
  };
}

export interface PassivePressureResult {
  kp: number;
  resultantForceKNPerM: number;
}

/** Passive pressure (toe-এর সামনে soil থেকে) — Pp = 0.5·Kp·γ·D², D = toe-এর সামনে soil depth। সাধারণত sliding resistance এ conservatively বাদ দেওয়া হয় (erosion/excavation ঝুঁকির কারণে) — এই app তাই এটা ঐচ্ছিক ইনপুট হিসেবে রাখে, ডিফল্ট বাদ। */
export function computePassivePressure(soil: SoilProperties, depthM: number): PassivePressureResult {
  const kp = computePassiveCoefficient(soil.frictionAngleDeg);
  const resultantForce = 0.5 * kp * soil.unitWeightKNm3 * depthM ** 2;
  return { kp, resultantForceKNPerM: resultantForce };
}
