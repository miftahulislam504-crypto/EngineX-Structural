/**
 * Shear Wall — In-Plane Shear Capacity (Basic Check)
 * Phase 6d — ACI 318-19 §11.5.4 (Design for Shear)। এই v1-এ শুধু
 * concrete + minimum horizontal reinforcement দিয়ে basic Vn চেক —
 * special boundary element design (ACI §18.10.6, উঁচু/high-seismic
 * shear wall এ প্রয়োজনীয়), coupling beam design, এবং overall
 * flexural (P-M) capacity of the wall as a vertical cantilever —
 * এসব এই v1-এ নেই (master plan এ future রিফাইনমেন্ট হিসেবে চিহ্নিত)।
 */

export interface ShearWallCapacityInput {
  thicknessMm: number; // bw (wall thickness)
  horizontalLengthMm: number; // lw (wall length, in-plane)
  fcMPa: number;
  horizontalReinforcementRatio: number; // ρt (provided, from rcWallEmpirical.ts এর মতো ratio)
  fyMPa: number;
  factoredShearKN: number; // Vu
}

export interface ShearWallCapacityResult {
  phiVnKN: number;
  utilizationRatio: number;
  adequate: boolean;
  warnings: string[];
}

/**
 * ACI 318-19 Eq. 11.5.4.6 (সরলীকৃত, αc=0.17 নন-স্লেন্ডার ধরে) —
 *   Vn = [αc·λ·√f'c + ρt·fy]·Acv, Acv = 0.8·lw·h (effective shear area)
 * αc = 0.17 (hw/lw ≥ 2.0, slender wall) — এই v1 এ সবসময় slender-wall
 * সহগ ব্যবহৃত (conservative for squat wall, যেখানে আসলে αc বেশি
 * হতে পারে — squat wall এর জন্য আলাদা αc রেঞ্জ ACI তে আছে, এই v1
 * এ সরলীকৃত হয়নি)।
 */
export function checkShearWallCapacity(input: ShearWallCapacityInput): ShearWallCapacityResult {
  const { thicknessMm, horizontalLengthMm, fcMPa, horizontalReinforcementRatio, fyMPa, factoredShearKN } = input;
  const warnings: string[] = [];
  const phi = 0.75;
  const alphaC = 0.17;

  const Acv = 0.8 * horizontalLengthMm * thicknessMm;
  const VnN = (alphaC * Math.sqrt(fcMPa) + horizontalReinforcementRatio * fyMPa) * Acv;

  // ACI §11.5.4.3 — upper limit, Vn ≤ 0.66√f'c·Acv (crushing এড়াতে)
  const VnMaxN = 0.66 * Math.sqrt(fcMPa) * Acv;
  const VnGoverning = Math.min(VnN, VnMaxN);

  if (VnN > VnMaxN) {
    warnings.push(
      "Computed shear strength exceeds the ACI §11.5.4.3 upper limit (0.66√f'c·Acv) — the wall thickness may need to increase regardless of added reinforcement (concrete crushing governs)."
    );
  }

  const phiVn = (phi * VnGoverning) / 1000; // N → kN
  const Vu = Math.abs(factoredShearKN);
  const ratio = phiVn > 0 ? Vu / phiVn : Number.POSITIVE_INFINITY;
  const adequate = Number.isFinite(ratio) && ratio <= 1.0;

  if (!adequate) {
    warnings.push(
      `Factored in-plane shear Vu (${Vu.toFixed(1)} kN) exceeds design shear capacity φVn (${phiVn.toFixed(1)} kN) — increase thickness or horizontal reinforcement ratio.`
    );
  }

  warnings.push(
    "This is a basic in-plane shear check only — special boundary element design (ACI §18.10.6), coupling beams, and overall wall flexural (P-M) capacity are not yet automated and should be checked separately for seismic-resistant shear walls."
  );

  return { phiVnKN: phiVn, utilizationRatio: ratio, adequate, warnings };
}
