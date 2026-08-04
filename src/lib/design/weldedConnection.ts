/**
 * Fillet Weld Connection Design
 * Phase 6g — AISC 360-16 §J2.2 (Fillet Welds)। শুধু longitudinal
 * fillet weld (load parallel to weld axis, সবচেয়ে প্রচলিত shear-
 * connection কেস) — transverse/oblique weld এর directional strength
 * increase (§J2.4(b), (1.0+0.5sin^1.5θ) factor) এই v1-এ প্রয়োগ করা
 * হয়নি (conservative, θ=0 ধরা)।
 */

export type WeldElectrode = "E70XX" | "E80XX";

const ELECTRODE_STRENGTH_MPA: Record<WeldElectrode, number> = {
  E70XX: 482, // FEXX = 70 ksi ≈ 482 MPa, সবচেয়ে প্রচলিত
  E80XX: 552, // 80 ksi ≈ 552 MPa
};

export interface FilletWeldInput {
  electrode: WeldElectrode;
  weldSizeMm: number; // leg size
  weldLengthMm: number; // মোট effective length (উভয় পাশ একসাথে ধরলে ইঞ্জিনিয়ার নিজে যোগফল দেন)
  factoredShearKN: number; // Vu
}

export interface FilletWeldResult {
  effectiveThroatMm: number;
  phiRnKN: number;
  utilizationRatio: number;
  adequate: boolean;
  warnings: string[];
}

/**
 * AISC 360-16 §J2.2a — fillet weld strength:
 *   φRn = φ·0.6·FEXX·(0.707·w)·L, φ=0.75
 * effective throat = 0.707 × leg size (৪৫° fillet ধরে, সবচেয়ে প্রচলিত)।
 */
export function designFilletWeld(input: FilletWeldInput): FilletWeldResult {
  const { electrode, weldSizeMm, weldLengthMm, factoredShearKN } = input;
  const warnings: string[] = [];
  const phi = 0.75;

  const effectiveThroat = 0.707 * weldSizeMm;
  const Fexx = ELECTRODE_STRENGTH_MPA[electrode];

  const RnN = 0.6 * Fexx * effectiveThroat * weldLengthMm;
  const phiRn = (phi * RnN) / 1000; // N → kN

  const Vu = Math.abs(factoredShearKN);
  const ratio = phiRn > 0 ? Vu / phiRn : Number.POSITIVE_INFINITY;
  const adequate = Number.isFinite(ratio) && ratio <= 1.0;

  if (!adequate) {
    warnings.push(
      `Factored shear Vu (${Vu.toFixed(1)} kN) exceeds weld capacity φRn (${phiRn.toFixed(1)} kN) — increase weld size or length.`
    );
  }

  if (weldSizeMm < 5) {
    warnings.push(
      `Weld size (${weldSizeMm}mm) is below the commonly used practical minimum of 5mm (3/16") for structural fillet welds — verify against AISC Table J2.4 minimum size requirements based on the thinner connected part.`
    );
  }

  warnings.push(
    "This check assumes load parallel to the weld axis (longitudinal, conservative) — no directional-strength increase for transverse/oblique loading (AISC §J2.4(b)) is applied."
  );

  return { effectiveThroatMm: effectiveThroat, phiRnKN: phiRn, utilizationRatio: ratio, adequate, warnings };
}
