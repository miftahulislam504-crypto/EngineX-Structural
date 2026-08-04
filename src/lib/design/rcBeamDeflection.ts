/**
 * RC Beam — Deflection Check
 * Phase 6a — ACI 318-19 Table 9.3.1.1 (deflection-control minimum
 * thickness, non-prestressed one-way members not supporting/attached
 * to partitions likely to be damaged by large deflection)। এটা
 * Phase 5-এর codeCompliance.ts এ থাকা span/depth থাম্ব-রুলের চেয়ে
 * বেশি নির্ভুল — কারণ end-condition (simple/continuous/cantilever)
 * ও fy বিবেচনা করে, শুধু একটামাত্র constant ratio না।
 *
 * এটা এখনো একটা প্রকৃত deflection মান (mm) হিসাব করে না (creep,
 * cracked-section moment of inertia, load history দরকার হতো) —
 * বরং কোড-নির্ধারিত ন্যূনতম thickness মেনে চলা হলে deflection check
 * বাদ দেওয়া যায় কিনা, তা যাচাই করে (ACI-এর permitted শর্টকাট, exact
 * deflection calculation না করেই)।
 */

export type BeamSupportCondition = "simply-supported" | "one-end-continuous" | "both-ends-continuous" | "cantilever";

/** ACI 318-19 Table 9.3.1.1 — L/thickness অনুপাত, support condition অনুযায়ী (fy=420 MPa ভিত্তিক)। */
const MIN_THICKNESS_RATIO: Record<BeamSupportCondition, number> = {
  "simply-supported": 16,
  "one-end-continuous": 18.5,
  "both-ends-continuous": 21,
  cantilever: 8,
};

export interface DeflectionCheckInput {
  spanMm: number; // L
  totalDepthMm: number; // h (overall thickness)
  supportCondition: BeamSupportCondition;
  fyMPa: number; // rebar fy — ACI টেবিল fy=420 MPa বেসলাইন, ভিন্ন fy তে সমন্বয় প্রয়োজন
}

export interface DeflectionCheckResult {
  minRequiredThicknessMm: number;
  providedThicknessMm: number;
  adequate: boolean; // provided ≥ required হলে deflection check বাদ দেওয়া যায় (ACI shortcut)
  warnings: string[];
}

/**
 * ACI 318-19 §9.3.1.1.1 — fy ≠ 420 MPa হলে টেবিলের মান সমন্বয়:
 * ratio টা multiply করতে হয় (0.4 + fy/700) দিয়ে (fy MPa এককে)।
 * এই সমন্বয় thickness-কে কমায় না বাড়ায় তা fy এর উপর নির্ভর করে —
 * বেশি fy মানে বেশি thickness দরকার (কম rebar area আশা করা হয় বলে
 * stiffness-এর জন্য বেশি thickness লাগে)।
 */
export function checkDeflectionByMinThickness(input: DeflectionCheckInput): DeflectionCheckResult {
  const { spanMm, totalDepthMm, supportCondition, fyMPa } = input;
  const warnings: string[] = [];

  const baseRatio = MIN_THICKNESS_RATIO[supportCondition];
  const fyAdjustment = 0.4 + fyMPa / 700;
  const effectiveRatio = baseRatio / fyAdjustment;

  const minRequiredThickness = spanMm / effectiveRatio;
  const adequate = totalDepthMm >= minRequiredThickness;

  if (!adequate) {
    warnings.push(
      `Provided depth (${totalDepthMm.toFixed(0)}mm) is below the ACI 318-19 Table 9.3.1.1 minimum (${minRequiredThickness.toFixed(0)}mm) for ${supportCondition} — a detailed deflection calculation is required, or increase the section depth.`
    );
  }

  return {
    minRequiredThicknessMm: minRequiredThickness,
    providedThicknessMm: totalDepthMm,
    adequate,
    warnings,
  };
}
