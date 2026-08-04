/**
 * Geotechnical — Soil Spring (Winkler Modulus of Subgrade Reaction)
 * Phase 7e — মাটিকে independent linear spring-এর একটা bed হিসেবে
 * ধরার classical Winkler মডেল। এই app-এর FE solver এখনো soil spring
 * boundary condition সমর্থন করে না (Phase 4a সীমাবদ্ধতা — mat/raft
 * এখনো rigid-method, Phase 7c দেখুন), তাই এই মডিউল standalone
 * ক্যালকুলেশন টুল হিসেবে ks এবং per-node spring stiffness বের করে
 * দেয় — যা ইঞ্জিনিয়ার ভবিষ্যতে অন্য সফটওয়্যার (SAFE, STAAD, ইত্যাদি)
 * এ soil-spring boundary condition হিসেবে সরাসরি ব্যবহার করতে পারেন,
 * অথবা ভবিষ্যতে এই app-এর FE solver-এ soil-spring সমর্থন যোগ হলে।
 */

export type SubgradeReactionMethod = "from-plate-load-test" | "from-allowable-bearing-pressure" | "from-elastic-modulus";

export interface SubgradeReactionInput {
  method: SubgradeReactionMethod;
  // method = "from-plate-load-test" হলে:
  plateLoadTestKsKNPerM3?: number; // ks যা সরাসরি 300mm×300mm (বা অন্য রেফারেন্স সাইজ) plate load test থেকে পাওয়া, geotechnical report থেকে
  plateWidthM?: number; // test plate-এর width, ডিফল্ট 0.3m (300mm প্রচলিত)
  // method = "from-allowable-bearing-pressure" হলে (Terzaghi-র সরলীকৃত সম্পর্ক, ks ≈ qa/settlement-এর একটা প্রচলিত rule of thumb):
  allowableBearingPressureKPa?: number;
  assumedSettlementAtAllowablePressureMm?: number; // ডিফল্ট 25mm (প্রচলিত অনুমান allowable pressure যে settlement এ পৌঁছায়)
  // method = "from-elastic-modulus" হলে (Vesic এর সরলীকৃত approximation):
  soilElasticModulusMPa?: number;
  soilPoissonRatio?: number;
  footingWidthM?: number;
  foundationRigidityEI?: number; // Ef·If, mat/raft-এর flexural rigidity (kN·m²) — Vesic সূত্রে দরকার
  // সব method-এর জন্য: actual foundation width (plate size থেকে extrapolate করতে)
  actualFoundationWidthM?: number;
}

export interface SubgradeReactionResult {
  modulusOfSubgradeReactionKNPerM3: number; // ks
  warnings: string[];
}

/**
 * Plate load test থেকে actual foundation-এর জন্য ks: Terzaghi-র
 * extrapolation সূত্র, cohesive soil-এ ks প্রায় plate size-নিরপেক্ষ,
 * granular soil-এ ks ∝ [(B+0.3)/(2B)]² হ্রাস পায় (B মিটারে) —
 * granular ধরা হয়েছে ডিফল্ট হিসেবে (রক্ষণশীল, বেশি common ব্যবহারিক
 * কেস)।
 */
function extrapolatePlateLoadKs(plateKs: number, plateWidthM: number, actualWidthM: number): number {
  const ratio = ((actualWidthM + 0.3) / (2 * actualWidthM)) ** 2;
  const plateRatio = ((plateWidthM + 0.3) / (2 * plateWidthM)) ** 2;
  return plateKs * (ratio / plateRatio);
}

export function computeSubgradeReactionModulus(input: SubgradeReactionInput): SubgradeReactionResult {
  const warnings: string[] = [];

  if (input.method === "from-plate-load-test") {
    const { plateLoadTestKsKNPerM3, plateWidthM = 0.3, actualFoundationWidthM } = input;
    if (!plateLoadTestKsKNPerM3 || plateLoadTestKsKNPerM3 <= 0) {
      warnings.push("Plate load test ks must be a positive value.");
      return { modulusOfSubgradeReactionKNPerM3: 0, warnings };
    }
    if (!actualFoundationWidthM || actualFoundationWidthM <= 0) {
      warnings.push("Actual foundation width is required to extrapolate the plate-test ks to full scale.");
      return { modulusOfSubgradeReactionKNPerM3: plateLoadTestKsKNPerM3, warnings };
    }
    const ks = extrapolatePlateLoadKs(plateLoadTestKsKNPerM3, plateWidthM, actualFoundationWidthM);
    warnings.push(
      "Plate-load ks was extrapolated to the actual foundation width assuming granular (cohesionless) soil behavior — if the soil is predominantly cohesive, ks is roughly plate-size-independent and this extrapolation may not apply; consult the geotechnical report."
    );
    return { modulusOfSubgradeReactionKNPerM3: ks, warnings };
  }

  if (input.method === "from-allowable-bearing-pressure") {
    const { allowableBearingPressureKPa, assumedSettlementAtAllowablePressureMm = 25 } = input;
    if (!allowableBearingPressureKPa || allowableBearingPressureKPa <= 0) {
      warnings.push("Allowable bearing pressure must be a positive value.");
      return { modulusOfSubgradeReactionKNPerM3: 0, warnings };
    }
    const settlementM = assumedSettlementAtAllowablePressureMm / 1000;
    const ks = allowableBearingPressureKPa / settlementM;
    warnings.push(
      `ks derived as qa / assumed settlement (${assumedSettlementAtAllowablePressureMm}mm) — this is a common rule-of-thumb approximation, not a rigorous derivation; for critical structures, prefer plate load test data or the elastic-modulus method.`
    );
    return { modulusOfSubgradeReactionKNPerM3: ks, warnings };
  }

  // from-elastic-modulus (Vesic 1961 simplified approximation, ignoring the EI term normalization for a first estimate)
  const { soilElasticModulusMPa, soilPoissonRatio, footingWidthM } = input;
  if (!soilElasticModulusMPa || soilElasticModulusMPa <= 0 || !footingWidthM || footingWidthM <= 0) {
    warnings.push("Soil elastic modulus and footing width must be positive values.");
    return { modulusOfSubgradeReactionKNPerM3: 0, warnings };
  }
  const nu = soilPoissonRatio ?? 0.3;
  const EsKPa = soilElasticModulusMPa * 1000;
  // সরলীকৃত approximation: ks ≈ Es / [B·(1-ν²)] — Vesic এর মূল সূত্রের EI-normalized অংশ বাদ দিয়ে একটা প্রথম-অনুমান (rough estimate)
  const ks = EsKPa / (footingWidthM * (1 - nu ** 2));
  warnings.push(
    "This is a simplified first-estimate (Es-based) approximation of ks, not the full Vesic (1961) formula (which also depends on foundation flexural rigidity EI) — treat as a preliminary estimate and refine with plate load test data where available."
  );
  return { modulusOfSubgradeReactionKNPerM3: ks, warnings };
}

export interface SoilSpringNodeInput {
  modulusOfSubgradeReactionKNPerM3: number; // ks
  tributaryAreaM2: number; // ঐ node/point-এর tributary plan area (mat mesh node হলে mesh cell area, isolated point spring হলে relevant contributory area)
}

export interface SoilSpringNodeResult {
  springStiffnessKNPerM: number; // K = ks × tributary area
  warnings: string[];
}

/** একটা নির্দিষ্ট node/point-এর জন্য discrete spring stiffness — ks কে tributary area দিয়ে গুণ করে (Winkler ডিসক্রিটাইজেশন)। */
export function computeSoilSpringStiffness(input: SoilSpringNodeInput): SoilSpringNodeResult {
  const { modulusOfSubgradeReactionKNPerM3, tributaryAreaM2 } = input;
  const warnings: string[] = [];

  if (modulusOfSubgradeReactionKNPerM3 <= 0 || tributaryAreaM2 <= 0) {
    warnings.push("Modulus of subgrade reaction and tributary area must be positive values.");
    return { springStiffnessKNPerM: 0, warnings };
  }

  return { springStiffnessKNPerM: modulusOfSubgradeReactionKNPerM3 * tributaryAreaM2, warnings };
}
