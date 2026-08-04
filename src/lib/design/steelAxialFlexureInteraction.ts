/**
 * Steel Member — Combined Axial + Flexure Interaction
 * Phase 6c — AISC 360-16 §H1.1 (Doubly and Singly Symmetric Members
 * Subject to Flexure and Axial Force), H1-1a/H1-1b equations।
 * Uniaxial bending (major axis) ধরা হয়েছে — biaxial (H1-1 এর পূর্ণ
 * সংস্করণ, Mry/Mcy টার্মসহ) পরের রিফাইনমেন্ট।
 */

export interface AxialFlexureInteractionInput {
  factoredAxialKN: number; // Pr (Pu, LRFD)
  phiPnKN: number; // Pc (design axial capacity)
  factoredMomentKNm: number; // Mr (Mu, LRFD, major axis)
  phiMnKNm: number; // Mc (design flexural capacity, major axis)
}

export interface AxialFlexureInteractionResult {
  axialRatio: number; // Pr/Pc
  interactionValue: number; // H1-1a বা H1-1b এর বাম পাশ (≤1.0 হলে adequate)
  governingEquation: "H1-1a" | "H1-1b";
  adequate: boolean;
}

/**
 * AISC §H1.1:
 *   Pr/Pc ≥ 0.2 হলে (H1-1a): Pr/Pc + (8/9)(Mrx/Mcx) ≤ 1.0
 *   Pr/Pc < 0.2 হলে (H1-1b): Pr/(2Pc) + (Mrx/Mcx) ≤ 1.0
 */
export function checkAxialFlexureInteraction(
  input: AxialFlexureInteractionInput
): AxialFlexureInteractionResult {
  const { factoredAxialKN, phiPnKN, factoredMomentKNm, phiMnKNm } = input;

  const Pr = Math.abs(factoredAxialKN);
  const Pc = phiPnKN;
  const Mr = Math.abs(factoredMomentKNm);
  const Mc = phiMnKNm;

  const axialRatio = Pc > 0 ? Pr / Pc : Number.POSITIVE_INFINITY;
  const momentRatio = Mc > 0 ? Mr / Mc : Number.POSITIVE_INFINITY;

  let interactionValue: number;
  let governingEquation: AxialFlexureInteractionResult["governingEquation"];

  if (axialRatio >= 0.2) {
    interactionValue = axialRatio + (8 / 9) * momentRatio;
    governingEquation = "H1-1a";
  } else {
    interactionValue = axialRatio / 2 + momentRatio;
    governingEquation = "H1-1b";
  }

  const adequate = Number.isFinite(interactionValue) && interactionValue <= 1.0;

  return { axialRatio, interactionValue, governingEquation, adequate };
}
