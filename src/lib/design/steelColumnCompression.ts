/**
 * Steel Column — Compression Design
 * Phase 6c — AISC 360-16 Chapter E (Design of Members for Compression),
 * E3 (flexural buckling of members without slender elements)। শুধু
 * flexural buckling (সবচেয়ে সাধারণ প্রচলিত কেস) — torsional/flexural-
 * torsional buckling (E4, unsymmetric/thin-walled shape এর জন্য
 * প্রাসঙ্গিক, doubly-symmetric W-shape এ সাধারণত governs করে না)
 * এই v1-এ নেই।
 */

import type { SteelDesignProperties } from "@/lib/design/steelSectionProperties";

export interface CompressionCapacityInput {
  properties: SteelDesignProperties;
  unbracedLengthMm: number; // Lc = KL (effective length already applied by caller)
  fyMPa: number;
  esMPa: number;
}

export interface CompressionCapacityResult {
  phiPnKN: number;
  governingLimitState: "inelastic-buckling" | "elastic-buckling";
  fcrMPa: number; // critical stress
  slendernessRatio: number; // KL/r (governing, weak-axis ধরা হয়েছে — সাধারণত এটাই সংকটজনক)
  warnings: string[];
}

/**
 * AISC E3 — governing slenderness ধরা হয়েছে weak-axis (ry), কারণ
 * doubly-symmetric W-shape এ সাধারণত সেটাই সংকটজনক দিক (rx > ry
 * প্রায় সবসময়) — যদি bracing/support condition ভিন্ন হয় (যেমন strong-
 * axis এ unbraced length অনেক বেশি), ইঞ্জিনিয়ারের নিজে rx দিয়ে চেক
 * করা উচিত (এই v1-এ শুধু weak-axis automated)।
 */
export function computeSteelColumnCompressionCapacity(
  input: CompressionCapacityInput
): CompressionCapacityResult {
  const { properties, unbracedLengthMm, fyMPa, esMPa } = input;
  const warnings: string[] = [];
  const phi = 0.9;

  const slendernessRatio = unbracedLengthMm / properties.ryMm;

  // AISC E3 — elastic buckling stress
  const Fe = (Math.PI ** 2 * esMPa) / slendernessRatio ** 2;

  let Fcr: number;
  let governingLimitState: CompressionCapacityResult["governingLimitState"];

  const transitionRatio = fyMPa / Fe;
  if (transitionRatio <= 2.25) {
    // AISC E3-2 — inelastic buckling
    Fcr = 0.658 ** transitionRatio * fyMPa;
    governingLimitState = "inelastic-buckling";
  } else {
    // AISC E3-3 — elastic buckling
    Fcr = 0.877 * Fe;
    governingLimitState = "elastic-buckling";
  }

  if (slendernessRatio > 200) {
    warnings.push(
      `Slenderness ratio KL/r=${slendernessRatio.toFixed(0)} exceeds the AISC-recommended practical limit of 200 — the member should be stiffened or braced.`
    );
  }

  const PnN = Fcr * properties.areaMm2;
  const phiPn = (phi * PnN) / 1000; // N → kN

  return { phiPnKN: phiPn, governingLimitState, fcrMPa: Fcr, slendernessRatio, warnings };
}
