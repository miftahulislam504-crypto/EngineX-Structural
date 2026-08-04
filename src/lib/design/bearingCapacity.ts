/**
 * Geotechnical — Bearing Capacity Derivation (Terzaghi / Meyerhof)
 * Phase 7e — এতদিন এই app-এ allowable bearing pressure (qa) সবসময়
 * ইঞ্জিনিয়ার-সরবরাহকৃত ছিল (geotechnical report থেকে সরাসরি input)।
 * এই মডিউল সেই qa-কে soil parameter (φ, c, γ, footing geometry)
 * থেকে derive করার একটা vetted classical hand-calculation পথ দেয় —
 * তবু এটা geotechnical analysis-এর প্রতিস্থাপন না; SPT/CPT/lab-টেস্ট
 * থেকে soil parameter নির্ণয়, water-table effect, layered-soil
 * analysis ইত্যাদি এখনো সম্পূর্ণভাবে geotechnical ইঞ্জিনিয়ারের কাজ।
 * এই মডিউল ধরে নেয় ইঞ্জিনিয়ার ইতিমধ্যে φ (friction angle), c
 * (cohesion), γ (unit weight) সরবরাহ করেছেন geotechnical report থেকে।
 */

export type BearingCapacityMethod = "terzaghi" | "meyerhof";
export type FootingShape = "strip" | "square" | "circular" | "rectangular";

export interface BearingCapacityInput {
  method: BearingCapacityMethod;
  footingShape: FootingShape;
  frictionAngleDeg: number; // φ, geotechnical report থেকে
  cohesionKPa: number; // c
  soilUnitWeightKNPerM3: number; // γ (effective/submerged হলে ইঞ্জিনিয়ার সেই মান দেবেন)
  footingDepthM: number; // Df, ground surface থেকে footing base পর্যন্ত
  footingWidthM: number; // B
  footingLengthM?: number; // L, rectangular হলে আবশ্যক (L ≥ B)
  factorOfSafety?: number; // ডিফল্ট 3.0 (bearing capacity-তে প্রচলিত FS)
  waterTableDepthM?: number; // ground surface থেকে water table পর্যন্ত — না দিলে water table প্রভাব উপেক্ষা করা হয় (dry condition ধরা হয়)
}

export interface BearingCapacityFactors {
  Nc: number;
  Nq: number;
  Ngamma: number;
}

export interface BearingCapacityResult {
  factors: BearingCapacityFactors;
  shapeFactors: { sc: number; sq: number; sgamma: number };
  depthFactors: { dc: number; dq: number; dgamma: number }; // শুধু Meyerhof-এ ব্যবহৃত হয়; Terzaghi-তে সব 1.0
  ultimateBearingCapacityKPa: number; // qu
  netUltimateBearingCapacityKPa: number; // qu - γ·Df (surcharge বাদ দিয়ে net capacity)
  allowableBearingPressureKPa: number; // qa = qu / FS (gross)
  warnings: string[];
}

/**
 * Terzaghi bearing capacity factors (classical, general shear failure
 * ধরে) — Nq ও Nc সূত্র সরাসরি φ থেকে, Nγ Terzaghi-র নিজস্ব approximate
 * সূত্র (Kp থেকে আসা, exact closed-form না — এটা widely-used একটা
 * ইঞ্জিনিয়ারিং approximation, বিভিন্ন রেফারেন্সে সামান্য ভিন্ন মান
 * পাওয়া যেতে পারে)।
 */
/**
 * Terzaghi bearing capacity factors (classical, general shear failure
 * ধরে) — Nq ও Nc সূত্র সরাসরি φ থেকে (Prandtl-Reissner ভিত্তিক,
 * Terzaghi-র মূল graphical সমাধানের সাথে সামঞ্জস্যপূর্ণ)। Nγ-এর জন্য
 * Terzaghi-র নিজস্ব মূল সমাধান একটা graphical পদ্ধতি ছিল যার কোনো
 * closed-form সূত্র নেই — তাই এখানে ব্যাপকভাবে ব্যবহৃত Meyerhof (1963)
 * Nγ approximation ব্যবহার করা হয়েছে উভয় method-এর জন্যই (এটা একটা
 * প্রচলিত ইঞ্জিনিয়ারিং প্র্যাকটিস, কিন্তু Terzaghi-র মূল published
 * টেবিলের Nγ মান থেকে সামান্য ভিন্ন হতে পারে — বড় Nγ-sensitive
 * প্রজেক্টে ইঞ্জিনিয়ার Terzaghi-র মূল টেবিল দিয়ে cross-check করে
 * নেওয়া উচিত)।
 */
function computeTerzaghiFactors(phiDeg: number): BearingCapacityFactors {
  const phiRad = (phiDeg * Math.PI) / 180;

  if (phiDeg <= 0) {
    // φ=0 (purely cohesive soil) এর জন্য Terzaghi এর নিজস্ব শাস্ত্রীয় মান
    return { Nc: 5.7, Nq: 1.0, Ngamma: 0.0 };
  }

  const Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.tan((45 + phiDeg / 2) * (Math.PI / 180)) ** 2;
  const Nc = (Nq - 1) / Math.tan(phiRad);
  const Ngamma = (Nq - 1) * Math.tan(1.4 * phiRad);

  return { Nc, Nq, Ngamma };
}

/**
 * Meyerhof bearing capacity factors — Terzaghi-র সাধারণীকৃত সংস্করণ,
 * shape/depth/inclination factor সহ ব্যাপকভাবে গ্রহণযোগ্য (এই মডিউলে
 * শুধু shape ও depth factor, load inclination factor প্রযোজ্য না
 * কারণ এই app centric axial load ধরে — eccentric/inclined load এর
 * bearing capacity reduction এই v1-এ কভার করা হয়নি)।
 */
function computeMeyerhofFactors(phiDeg: number): BearingCapacityFactors {
  const phiRad = (phiDeg * Math.PI) / 180;

  if (phiDeg <= 0) {
    return { Nc: 5.14, Nq: 1.0, Ngamma: 0.0 };
  }

  const Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.tan((45 + phiDeg / 2) * (Math.PI / 180)) ** 2;
  const Nc = (Nq - 1) / Math.tan(phiRad);
  const Ngamma = (Nq - 1) * Math.tan(1.4 * phiRad); // Meyerhof (1963) approximation

  return { Nc, Nq, Ngamma };
}

export function computeBearingCapacity(input: BearingCapacityInput): BearingCapacityResult {
  const {
    method,
    footingShape,
    frictionAngleDeg,
    cohesionKPa,
    soilUnitWeightKNPerM3,
    footingDepthM,
    footingWidthM,
    footingLengthM,
    factorOfSafety,
    waterTableDepthM,
  } = input;
  const warnings: string[] = [];
  const FS = factorOfSafety ?? 3.0;

  const factors = method === "terzaghi" ? computeTerzaghiFactors(frictionAngleDeg) : computeMeyerhofFactors(frictionAngleDeg);

  if (method === "terzaghi" && frictionAngleDeg > 0) {
    warnings.push(
      "Nc and Nq use the classical Terzaghi (Prandtl-Reissner) formulas; Nγ uses the widely-used Meyerhof (1963) approximation since Terzaghi's original Nγ was graphical with no closed form — values may differ slightly from Terzaghi's originally published table."
    );
  }

  const lengthM = footingShape === "rectangular" ? footingLengthM ?? footingWidthM * 2 : footingWidthM;
  if (footingShape === "rectangular" && (!footingLengthM || footingLengthM < footingWidthM)) {
    warnings.push("For a rectangular footing, length (L) should be provided and should be ≥ width (B).");
  }

  // Shape factors (Meyerhof-এর জন্য প্রযোজ্য; Terzaghi মূল সূত্র শুধু
  // strip footing-এর জন্য, তাই shape factor সাধারণত square/circular
  // এর জন্য একটা প্রচলিত সংশোধনী হিসেবে ব্যবহার করা হয় — এখানে উভয়
  // method-এই একই shape-factor প্রয়োগ করা হচ্ছে, রক্ষণশীল সরলীকরণ)
  let sc = 1.0;
  let sq = 1.0;
  let sgamma = 1.0;
  const BtoL = footingShape === "strip" ? 0 : footingWidthM / lengthM;

  if (footingShape === "square" || footingShape === "circular") {
    sc = 1 + (factors.Nq / factors.Nc) * 1.0;
    sq = 1 + Math.tan((frictionAngleDeg * Math.PI) / 180);
    sgamma = 0.6;
  } else if (footingShape === "rectangular") {
    sc = 1 + (BtoL * factors.Nq) / factors.Nc;
    sq = 1 + BtoL * Math.tan((frictionAngleDeg * Math.PI) / 180);
    sgamma = 1 - 0.4 * BtoL;
  }

  // Depth factors — শুধু Meyerhof-এ, Terzaghi ঐতিহ্যগতভাবে depth
  // factor ব্যবহার করে না (Df শুধু surcharge term q = γ·Df দিয়েই
  // প্রতিফলিত হয়)।
  let dc = 1.0;
  let dq = 1.0;
  let dgamma = 1.0;
  if (method === "meyerhof") {
    const phiRad = (frictionAngleDeg * Math.PI) / 180;
    const DtoB = footingDepthM / footingWidthM;
    dq = 1 + 2 * Math.tan(phiRad) * (1 - Math.sin(phiRad)) ** 2 * Math.min(DtoB, 1);
    dc = frictionAngleDeg > 0 ? dq - (1 - dq) / (factors.Nc * Math.tan(phiRad)) : 1 + 0.4 * Math.min(DtoB, 1);
    dgamma = 1.0; // সাধারণত dγ = 1 ধরা হয় (রক্ষণশীল)
  }

  // Effective surcharge — water table footing base-এর উপরে থাকলে
  // effective unit weight কমে যায় (submerged/buoyant weight)। এই
  // v1-এ সরলীকৃত: water table footing base-এর উপরে থাকলে পুরো
  // surcharge zone-এ γ কে অর্ধেক ধরা হয় (একটা প্রচলিত রক্ষণশীল
  // approximation — সঠিক গণনার জন্য water table-এর সুনির্দিষ্ট
  // অবস্থান অনুযায়ী layered surcharge integration দরকার, যা এই
  // মডিউলে নেই)।
  let effectiveUnitWeight = soilUnitWeightKNPerM3;
  let surchargeUnitWeight = soilUnitWeightKNPerM3;
  if (waterTableDepthM !== undefined && waterTableDepthM < footingDepthM) {
    surchargeUnitWeight = soilUnitWeightKNPerM3 * 0.5;
    warnings.push(
      "Water table is above the footing base — surcharge unit weight has been approximated as half the given value. For a precise calculation, provide the submerged (buoyant) unit weight directly and set the water table depth accordingly, or consult the geotechnical report."
    );
  }
  if (waterTableDepthM !== undefined && waterTableDepthM < footingDepthM + footingWidthM) {
    effectiveUnitWeight = soilUnitWeightKNPerM3 * 0.5;
    if (!warnings.some((w) => w.includes("Water table"))) {
      warnings.push(
        "Water table is within the influence zone below the footing base — the unit weight used in the Nγ term has been approximated as half the given value; consult the geotechnical report for a precise submerged-weight calculation."
      );
    }
  }

  const q = surchargeUnitWeight * footingDepthM; // effective surcharge at footing base

  const qu =
    cohesionKPa * factors.Nc * sc * dc +
    q * factors.Nq * sq * dq +
    0.5 * effectiveUnitWeight * footingWidthM * factors.Ngamma * sgamma * dgamma;

  const netQu = qu - soilUnitWeightKNPerM3 * footingDepthM;
  const qa = qu / FS;

  if (FS < 2.5) {
    warnings.push(
      `Factor of safety (${FS.toFixed(1)}) is below the commonly used minimum of 2.5-3.0 for bearing capacity — confirm this is acceptable.`
    );
  }

  if (frictionAngleDeg < 0 || frictionAngleDeg > 45) {
    warnings.push(
      `Friction angle (${frictionAngleDeg}°) is outside the typical range (0-45°) for natural soils — verify the geotechnical report value.`
    );
  }

  return {
    factors,
    shapeFactors: { sc, sq, sgamma },
    depthFactors: { dc, dq, dgamma },
    ultimateBearingCapacityKPa: qu,
    netUltimateBearingCapacityKPa: netQu,
    allowableBearingPressureKPa: qa,
    warnings,
  };
}
