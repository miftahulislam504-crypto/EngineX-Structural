/**
 * Steel Beam — Flexural Design
 * Phase 6c — AISC 360-16 Chapter F (Design of Members for Flexure),
 * F2 (doubly symmetric compact I-shaped members, bent about major
 * axis) — সবচেয়ে প্রচলিত কেস (rolled W-shape beam)।
 *
 * সরলীকরণ:
 *   - শুধু compact section সমর্থিত (flange/web slenderness check
 *     compact না হলে non-compact/slender এর জন্য F3/F4/F5 এর জটিলতর
 *     সূত্র লাগে — এই v1-এ flag করে জানানো হয়, capacity হিসাব হয়
 *     না)
 *   - Cb (lateral-torsional buckling modification factor) সরলভাবে
 *     1.0 (uniform moment, conservative) ধরা হয়েছে — actual moment
 *     diagram থেকে Cb হিসাব করা একটা future রিফাইনমেন্ট
 *   - LRFD পদ্ধতি ব্যবহৃত (φb = 0.90), ASD না
 */

import type { SteelDesignProperties } from "@/lib/design/steelSectionProperties";

export interface FlexuralCapacityInput {
  properties: SteelDesignProperties;
  fyMPa: number;
  esMPa: number; // elastic modulus, সাধারণত 200000 MPa
  unbracedLengthMm: number; // Lb — lateral bracing points-এর মধ্যে দূরত্ব
  cb?: number; // lateral-torsional buckling modification factor, ডিফল্ট 1.0 (conservative)
}

export interface FlexuralCapacityResult {
  isCompact: boolean;
  phiMnKNm: number; // design flexural strength, φMn
  governingLimitState: "yielding" | "lateral-torsional-buckling" | "not-compact";
  lpMm: number; // Lp — plastic limiting laterally unbraced length
  lrMm: number; // Lr — inelastic LTB limiting length
  warnings: string[];
}

/**
 * AISC Table B4.1b — flange compactness limit λp for I-shaped members
 * in flexure: λp = 0.38√(E/Fy)
 */
function computeFlangeCompactLimit(esMPa: number, fyMPa: number): number {
  return 0.38 * Math.sqrt(esMPa / fyMPa);
}

/** AISC Table B4.1b — web compactness limit λp = 3.76√(E/Fy)। */
function computeWebCompactLimit(esMPa: number, fyMPa: number): number {
  return 3.76 * Math.sqrt(esMPa / fyMPa);
}

export function checkSteelBeamFlexuralCapacity(input: FlexuralCapacityInput): FlexuralCapacityResult {
  const { properties, fyMPa, esMPa, unbracedLengthMm, cb } = input;
  const warnings: string[] = [];
  const phi = 0.9;
  const Cb = cb ?? 1.0;

  const flangeLimit = computeFlangeCompactLimit(esMPa, fyMPa);
  const webLimit = computeWebCompactLimit(esMPa, fyMPa);

  const isFlangeCompact = properties.flangeSlenderness <= flangeLimit;
  const isWebCompact = properties.webSlenderness <= webLimit;
  const isCompact = isFlangeCompact && isWebCompact;

  if (!isCompact) {
    warnings.push(
      `Section is not compact per AISC Table B4.1b (flange λ=${properties.flangeSlenderness.toFixed(1)} vs limit ${flangeLimit.toFixed(1)}, web λ=${properties.webSlenderness.toFixed(1)} vs limit ${webLimit.toFixed(1)}) — non-compact/slender flexural strength (AISC F3/F4) is not yet implemented in this version.`
    );
    return {
      isCompact: false,
      phiMnKNm: 0,
      governingLimitState: "not-compact",
      lpMm: 0,
      lrMm: 0,
      warnings,
    };
  }

  // AISC F2-7 এর plastic moment
  const MpNmm = fyMPa * properties.zxMm3;

  // AISC F2-5 — Lp
  const Lp = 1.76 * properties.ryMm * Math.sqrt(esMPa / fyMPa);

  // AISC F2-6 — Lr, পূর্ণাঙ্গ সূত্র (rts, J, ho, Sx সহ — c=1 doubly
  // symmetric I-shape এর জন্য):
  //   Lr = 1.95·rts·(E/0.7Fy)·√[ (J/(Sx·ho)) + √((J/(Sx·ho))² + 6.76·(0.7Fy/E)²) ]
  // এর আগে এই ফাংশনে rts কে ry দিয়ে approximate করা হচ্ছিল এবং J=0
  // ধরা হচ্ছিল — যা Lr কে বাস্তবের চেয়ে বহুগুণ বড় (severely
  // unconservative) দেখাচ্ছিল, ম্যানুয়াল যাচাইয়ে ধরা পড়েছে। এখন
  // properties থেকে সরাসরি প্রকৃত rts, J, ho ব্যবহার করা হয়।
  const rts = properties.rtsMm;
  const Sx = properties.sxMm3;
  const J = properties.jMm4;
  const ho = properties.hoMm;

  const jTerm = J / (Sx * ho);
  const Lr =
    1.95 * rts * (esMPa / (0.7 * fyMPa)) * Math.sqrt(jTerm + Math.sqrt(jTerm ** 2 + 6.76 * ((0.7 * fyMPa) / esMPa) ** 2));

  let MnNmm: number;
  let governingLimitState: FlexuralCapacityResult["governingLimitState"];

  if (unbracedLengthMm <= Lp) {
    // AISC F2.1 — full yielding, no LTB reduction
    MnNmm = MpNmm;
    governingLimitState = "yielding";
  } else if (unbracedLengthMm <= Lr) {
    // AISC F2-2 — inelastic LTB, linear interpolation between Mp and 0.7FySx
    const My07 = 0.7 * fyMPa * Sx;
    const MnLtb = Cb * (MpNmm - (MpNmm - My07) * ((unbracedLengthMm - Lp) / (Lr - Lp)));
    MnNmm = Math.min(MnLtb, MpNmm);
    governingLimitState = "lateral-torsional-buckling";
  } else {
    // AISC F2-4 — elastic LTB, পূর্ণাঙ্গ সূত্র (J টার্ম সহ, c=1 doubly
    // symmetric I-shape এর জন্য):
    //   Fcr = (Cb·π²·E)/(Lb/rts)² · √[1 + 0.078·(J/(Sx·ho))·(Lb/rts)²]
    const LbOverRts = unbracedLengthMm / rts;
    const Fcr =
      ((Cb * Math.PI ** 2 * esMPa) / LbOverRts ** 2) * Math.sqrt(1 + 0.078 * jTerm * LbOverRts ** 2);
    MnNmm = Math.min(Fcr * Sx, MpNmm);
    governingLimitState = "lateral-torsional-buckling";
  }

  const phiMn = (phi * MnNmm) / 1e6; // N·mm → kN·m

  return {
    isCompact: true,
    phiMnKNm: phiMn,
    governingLimitState,
    lpMm: Lp,
    lrMm: Lr,
    warnings,
  };
}

export interface FlexuralAdequacyResult {
  phiMnKNm: number;
  utilizationRatio: number;
  adequate: boolean;
}

export function checkSteelBeamFlexuralAdequacy(
  factoredMomentKNm: number,
  capacity: FlexuralCapacityResult
): FlexuralAdequacyResult {
  const Mu = Math.abs(factoredMomentKNm);
  const ratio = capacity.phiMnKNm > 0 ? Mu / capacity.phiMnKNm : Number.POSITIVE_INFINITY;
  return { phiMnKNm: capacity.phiMnKNm, utilizationRatio: ratio, adequate: Number.isFinite(ratio) && ratio <= 1.0 };
}
