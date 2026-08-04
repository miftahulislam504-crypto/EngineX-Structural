/**
 * Steel Beam — Shear Design
 * Phase 6c — AISC 360-16 Chapter G (Design of Members for Shear),
 * G2.1 (I-shaped members, web shear)। সরলীকরণ: web slenderness
 * h/tw ≤ 2.24√(E/Fy) হলে Cv1 = 1.0 (সবচেয়ে প্রচলিত rolled shape
 * এর জন্য প্রযোজ্য, kv=5.34 ধরে) — stiffened/unstiffened web বা
 * অতিরিক্ত slender web এর বিস্তারিত kv/tension-field-action সূত্র
 * (G2.2/G3) এই v1-এ নেই।
 */

import type { SteelDesignProperties } from "@/lib/design/steelSectionProperties";

export interface ShearCapacityInput {
  properties: SteelDesignProperties;
  webThicknessMm: number; // tw — Aw = d×tw হিসাবের জন্য প্রয়োজন
  overallDepthMm: number; // d
  fyMPa: number;
  esMPa: number;
}

export interface ShearCapacityResult {
  phiVnKN: number;
  cv1: number; // web shear strength coefficient
  warnings: string[];
}

export function computeSteelBeamShearCapacity(input: ShearCapacityInput): ShearCapacityResult {
  const { properties, webThicknessMm, overallDepthMm, fyMPa, esMPa } = input;
  const warnings: string[] = [];
  const phi = 0.9; // AISC G2.1(a) — rolled I-shape, h/tw ≤ 2.24√(E/Fy) হলে φv=1.0, কিন্তু সাধারণ প্রকাশনায় φ=0.9 ব্যবহার করা হয় ASD-LRFD উভয় সামঞ্জস্যের জন্য; এখানে φ=0.9 রক্ষণশীলভাবে সব ক্ষেত্রে প্রয়োগ করা হলো

  const webShearLimit = 2.24 * Math.sqrt(esMPa / fyMPa);
  const isStandardWeb = properties.webSlenderness <= webShearLimit;

  let cv1: number;
  if (isStandardWeb) {
    cv1 = 1.0;
  } else {
    // AISC G2.1(b) — kv=5.34 (unstiffened web), Cv1 সূত্র প্রয়োগ
    const kv = 5.34;
    const limit1 = 1.1 * Math.sqrt((kv * esMPa) / fyMPa);
    if (properties.webSlenderness <= limit1) {
      cv1 = 1.0;
    } else {
      cv1 = (1.1 * Math.sqrt((kv * esMPa) / fyMPa)) / properties.webSlenderness;
      warnings.push(
        `Web slenderness (h/tw=${properties.webSlenderness.toFixed(1)}) exceeds the standard rolled-shape limit — shear buckling reduction applied (Cv1=${cv1.toFixed(2)}); verify against AISC G2 for non-standard/built-up webs.`
      );
    }
  }

  const Aw = overallDepthMm * webThicknessMm; // mm², AISC G2.1(a) approximation (uses overall depth, not clear web depth)
  const VnN = 0.6 * fyMPa * Aw * cv1;
  const phiVn = (phi * VnN) / 1000; // N → kN

  return { phiVnKN: phiVn, cv1, warnings };
}

export interface ShearAdequacyResult {
  phiVnKN: number;
  utilizationRatio: number;
  adequate: boolean;
}

export function checkSteelBeamShearAdequacy(
  factoredShearKN: number,
  capacity: ShearCapacityResult
): ShearAdequacyResult {
  const Vu = Math.abs(factoredShearKN);
  const ratio = capacity.phiVnKN > 0 ? Vu / capacity.phiVnKN : Number.POSITIVE_INFINITY;
  return { phiVnKN: capacity.phiVnKN, utilizationRatio: ratio, adequate: Number.isFinite(ratio) && ratio <= 1.0 };
}
