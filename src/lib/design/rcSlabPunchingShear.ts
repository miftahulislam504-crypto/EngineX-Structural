/**
 * RC Slab — Punching Shear Check
 * Phase 6d — ACI 318-19 §22.6 (Two-Way Shear Strength)। Critical
 * section d/2 থেকে column face (rectangular column ধরা হয়েছে,
 * সবচেয়ে প্রচলিত)। শুধু interior column (b0 চারদিকে বন্ধ perimeter)
 * সমর্থিত এই v1-এ — edge/corner column এর জন্য unbalanced moment
 * transfer (ACI §8.4.4.2, eccentric shear stress model) একটা জটিলতর
 * পরের সংযোজন, এখানে edge/corner এর জন্য শুধু perimeter length ভিন্ন
 * ধরে সরল Vc হিসাব করা হয়েছে (moment transfer বাদ, তাই edge/corner
 * এ এই চেক অপর্যাপ্ত রক্ষণশীল হতে পারে — warning এ জানানো হয়েছে)।
 */

export type ColumnPosition = "interior" | "edge" | "corner";

export interface PunchingShearInput {
  columnWidthMm: number; // c1 — column dimension পরিমাপ ১ (analysis দিক)
  columnDepthMm: number; // c2 — column dimension পরিমাপ ২
  slabEffectiveDepthMm: number; // d
  fcMPa: number;
  columnPosition: ColumnPosition;
  factoredShearKN: number; // Vu — total column reaction/shear transferred to slab (ইঞ্জিনিয়ার সরবরাহ করেন, সাধারণত tributary area × factored load থেকে)
  betaC?: number; // long side/short side of column — square column এ 1.0 (ডিফল্ট)
}

export interface PunchingShearResult {
  criticalPerimeterMm: number; // b0
  phiVcKN: number;
  utilizationRatio: number;
  adequate: boolean;
  warnings: string[];
}

/**
 * ACI 318-19 §22.6.5.2 — Vc, তিনটা সীমার মধ্যে সবচেয়ে ছোটটা governing:
 *   (a) Vc = 0.33λ√f'c·b0·d
 *   (b) Vc = 0.17(1 + 2/βc)λ√f'c·b0·d
 *   (c) Vc = 0.083(2 + αs·d/b0)λ√f'c·b0·d, αs = 40(interior)/30(edge)/20(corner)
 */
export function checkPunchingShear(input: PunchingShearInput): PunchingShearResult {
  const {
    columnWidthMm,
    columnDepthMm,
    slabEffectiveDepthMm: d,
    fcMPa,
    columnPosition,
    factoredShearKN,
    betaC,
  } = input;
  const warnings: string[] = [];
  const phi = 0.75; // ACI §21.2.1 — shear

  // Critical perimeter b0 — d/2 বাইরে চারদিকে (interior); edge/corner
  // এ open sides বাদ পড়ে, কিন্তু এই v1 এ সরলীকৃত হিসেবে perimeter
  // শুধু ছোট করা হয়েছে actual open-edge geometry এর বদলে (নিচের
  // warning এ জানানো)।
  const fullPerimeter = 2 * (columnWidthMm + d) + 2 * (columnDepthMm + d);
  let b0: number;
  if (columnPosition === "interior") {
    b0 = fullPerimeter;
  } else if (columnPosition === "edge") {
    b0 = fullPerimeter * 0.75; // approximate — এক পাশ open
    warnings.push(
      "Edge column: this check uses a simplified reduced perimeter and does not include unbalanced-moment transfer (ACI §8.4.4.2) — treat as approximate; a rigorous eccentric shear stress check is recommended for edge columns."
    );
  } else {
    b0 = fullPerimeter * 0.5; // approximate — দুই পাশ open
    warnings.push(
      "Corner column: this check uses a simplified reduced perimeter and does not include unbalanced-moment transfer (ACI §8.4.4.2) — treat as approximate; a rigorous eccentric shear stress check is recommended for corner columns."
    );
  }

  const beta = betaC ?? Math.max(columnWidthMm, columnDepthMm) / Math.min(columnWidthMm, columnDepthMm);
  const alphaS = columnPosition === "interior" ? 40 : columnPosition === "edge" ? 30 : 20;

  const vcOptionA = 0.33 * Math.sqrt(fcMPa) * b0 * d;
  const vcOptionB = 0.17 * (1 + 2 / beta) * Math.sqrt(fcMPa) * b0 * d;
  const vcOptionC = 0.083 * (2 + (alphaS * d) / b0) * Math.sqrt(fcMPa) * b0 * d;

  const VcN = Math.min(vcOptionA, vcOptionB, vcOptionC);
  const phiVc = (phi * VcN) / 1000; // N → kN

  const Vu = Math.abs(factoredShearKN);
  const ratio = phiVc > 0 ? Vu / phiVc : Number.POSITIVE_INFINITY;
  const adequate = Number.isFinite(ratio) && ratio <= 1.0;

  if (!adequate) {
    warnings.push(
      `Factored shear Vu (${Vu.toFixed(1)} kN) exceeds punching shear capacity φVc (${phiVc.toFixed(1)} kN) — increase slab thickness, add shear reinforcement (stud rails/stirrups), or increase column size.`
    );
  }

  return {
    criticalPerimeterMm: b0,
    phiVcKN: phiVc,
    utilizationRatio: ratio,
    adequate,
    warnings,
  };
}
