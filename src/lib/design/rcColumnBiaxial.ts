/**
 * RC Column — Biaxial Bending (Load Contour Method)
 * Phase 6f — ACI 318-19 R22.4.2.1 (Commentary)। এই মডিউল প্রকৃত
 * Bresler reciprocal-load সূত্র (1/Pn = 1/Pnx + 1/Pny − 1/Pn0) সরাসরি
 * বাস্তবায়ন করে না — কারণ সেই সূত্রের জন্য "নির্দিষ্ট moment এ axial
 * capacity" (inverse mapping) দরকার, যেখানে আমাদের uniaxial diagram
 * (rcColumnPmInteraction.ts) শুধু "নির্দিষ্ট axial এ moment capacity"
 * (forward mapping) দেয়। Forward-mapping কে ভুলভাবে invert করে Pnx/Pny
 * approximate করার একটা প্রাথমিক চেষ্টা রিভিউয়ে conceptually ত্রুটিপূর্ণ
 * ধরা পড়েছিল (utilization ratio শূন্যের কাছাকাছি হলে blow-up করতো)।
 *
 * তার বদলে এই মডিউল **load contour method** ব্যবহার করে — ACI
 * কমেন্টারিতে Bresler এর একটা established, সহজতর, ও রক্ষণশীল
 * বিকল্প হিসেবে উল্লিখিত:
 *
 *   (Mux/φMnx)^α + (Muy/φMny)^α ≤ 1.0
 *
 * যেখানে φMnx, φMny হলো একই Pu স্তরে x ও y অক্ষ বরাবর uniaxial
 * capacity (আমাদের ইতিমধ্যে থাকা forward-mapping দিয়ে সরাসরি পাওয়া
 * যায়, কোনো inversion লাগে না)। α সাধারণত 1.0-2.0 রেঞ্জে (rectangular
 * tied column এ প্রায়ই ~1.15-1.55) — এই v1 এ রক্ষণশীলভাবে α=1.0
 * (linear interaction, সবচেয়ে conservative প্রান্ত) ব্যবহার করা
 * হয়েছে।
 *
 * rcColumnPmInteraction.ts এর buildPmInteractionDiagram() rectangular
 * section এর width/depth swap করে দুইটা diagram (x ও y অক্ষ বরাবর
 * bending) বানানো হয় (symmetric reinforcement ধরে)।
 */

import {
  buildPmInteractionDiagram,
  checkColumnAdequacy,
  type PmInteractionInput,
} from "@/lib/design/rcColumnPmInteraction";

export interface BiaxialCheckInput {
  widthMm: number; // b — column dimension along the X (global) direction
  totalDepthMm: number; // h — column dimension along the Z (global) direction
  fcMPa: number;
  fyMPa: number;
  totalAsMm2: number;
  coverToBarCentroidMm: number;
  factoredAxialLoadKN: number; // Pu
  /**
   * Mux — moment about the X-axis. A moment vector about the X-axis
   * bends the column in the X-Z plane about that axis, meaning the
   * relevant lever-arm dimension for THIS bending is totalDepthMm
   * (h, the Z-direction dimension) — NOT widthMm. This can read as
   * counterintuitive from the variable names alone; it follows the
   * standard right-hand-rule convention (moment vector direction is
   * perpendicular to the plane it bends).
   */
  factoredMomentXKNm: number;
  /** Muy — moment about the Y-axis (vertical); bends the column in the plan (X-Z) plane, with widthMm (b) as the relevant lever-arm dimension. */
  factoredMomentYKNm: number;
}

export interface BiaxialCheckResult {
  phiMnxKNm: number; // interpolated uniaxial capacity, x-axis diagram, এই Pu স্তরে
  phiMnyKNm: number; // একইভাবে y-axis diagram থেকে
  momentRatioX: number; // Mux / phiMnx
  momentRatioY: number; // Muy / phiMny
  interactionValue: number; // momentRatioX + momentRatioY (≤1.0 হলে adequate)
  adequate: boolean;
  warnings: string[];
}

export function checkColumnBiaxialBending(input: BiaxialCheckInput): BiaxialCheckResult {
  const warnings: string[] = [];

  // Mux (moment about X-axis) bends the column with totalDepthMm (h,
  // Z-direction) as the lever-arm dimension — pass widthMm/totalDepthMm
  // unchanged (original orientation) to buildPmInteractionDiagram,
  // whose own totalDepthMm parameter IS defined as "the dimension
  // along the bending direction" (see rcColumnPmInteraction.ts).
  const diagramInputX: PmInteractionInput = {
    widthMm: input.widthMm,
    totalDepthMm: input.totalDepthMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
    totalAsMm2: input.totalAsMm2,
    numBarLayers: 2,
    coverToBarCentroidMm: input.coverToBarCentroidMm,
  };
  const diagramX = buildPmInteractionDiagram(diagramInputX);

  // Muy (moment about Y-axis) bends the column with widthMm (b,
  // X-direction) as the lever-arm dimension — swap width/depth so
  // buildPmInteractionDiagram's totalDepthMm now correctly points at
  // the X-direction dimension.
  const diagramInputY: PmInteractionInput = {
    widthMm: input.totalDepthMm,
    totalDepthMm: input.widthMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
    totalAsMm2: input.totalAsMm2,
    numBarLayers: 2,
    coverToBarCentroidMm: input.coverToBarCentroidMm,
  };
  const diagramY = buildPmInteractionDiagram(diagramInputY);

  const adequacyX = checkColumnAdequacy(diagramX, input.factoredAxialLoadKN, input.factoredMomentXKNm);
  const adequacyY = checkColumnAdequacy(diagramY, input.factoredAxialLoadKN, input.factoredMomentYKNm);

  // Load contour method (ACI R22.4.2.1, α=1.0 conservative):
  //   (Mux/φMnx) + (Muy/φMny) ≤ 1.0
  const momentRatioX = adequacyX.utilizationRatio;
  const momentRatioY = adequacyY.utilizationRatio;
  const interactionValue = momentRatioX + momentRatioY;
  const adequate = Number.isFinite(interactionValue) && interactionValue <= 1.0;

  if (input.factoredMomentXKNm <= 0 || input.factoredMomentYKNm <= 0) {
    warnings.push(
      "One or both moments are zero — this is effectively a uniaxial case; the biaxial load-contour method is intended for genuinely biaxial loading and may be overly conservative here. Consider the uniaxial P-M check instead for a less conservative result."
    );
  }

  if (!adequate) {
    warnings.push(
      `Combined biaxial demand ((Mux/\u03c6Mnx) + (Muy/\u03c6Mny) = ${Number.isFinite(interactionValue) ? interactionValue.toFixed(2) : "—"}) exceeds 1.0 — increase section size or reinforcement.`
    );
  }

  warnings.push(
    "Biaxial check uses a linear load-contour approximation (a conservative simplification of the Bresler method, ACI Commentary R22.4.2.1), not an exact biaxial strain-compatibility solution — treat results as preliminary."
  );

  return {
    phiMnxKNm: adequacyX.interpolatedPhiMnKNm,
    phiMnyKNm: adequacyY.interpolatedPhiMnKNm,
    momentRatioX,
    momentRatioY,
    interactionValue,
    adequate,
    warnings,
  };
}
