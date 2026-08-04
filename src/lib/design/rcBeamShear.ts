/**
 * RC Beam — Shear Design
 * Phase 6a — ACI 318-19 Chapter 22.5 (One-way shear) / BNBC 2020।
 * সরলীকরণ: Vc হিসাবে ACI-এর সরলীকৃত সূত্র (§22.5.5.1, Vc = 0.17λ√f'c·bw·d,
 * SI ইউনিটে) ব্যবহার করা হয়েছে — বিস্তারিত সূত্র (axial load, ρw
 * প্রভাব বিবেচনা করা §22.5.6.1) v1-এ যোগ করা হয়নি, কারণ এটা একটা
 * conservative (নিরাপদ দিকে) সরলীকরণ যা অধিকাংশ সাধারণ beam এর জন্য
 * যথেষ্ট নির্ভুল প্রাথমিক ডিজাইনের জন্য। λ=1.0 (normal-weight
 * concrete) ধরে নেওয়া হয়েছে।
 */

export interface ShearDesignInput {
  factoredShearKN: number; // Vu, kN (magnitude)
  widthMm: number; // bw
  effectiveDepthMm: number; // d
  fcMPa: number; // f'c
  fyMPa: number; // stirrup rebar fy (সাধারণত rebarFy, প্রধান flexural rebar এর মতোই material থেকে)
  stirrupDiameterMm: number; // stirrup bar diameter (২ leg ধরে নেওয়া হয়েছে, সবচেয়ে প্রচলিত)
}

export interface ShearDesignResult {
  phiVcKN: number; // concrete shear capacity, φVc
  requiredVsKN: number; // stirrup থেকে প্রয়োজনীয় শক্তি, (Vu/φ - Vc), ঋণাত্মক হলে 0
  stirrupNeeded: boolean; // Vu > φVc/2 হলে অন্তত nominal stirrup লাগবে (ACI §9.6.3.1)
  requiredSpacingMm: number | null; // প্রয়োজনীয় stirrup spacing, null মানে stirrup না লাগলেও max spacing প্রযোজ্য
  maxSpacingMm: number; // ACI §9.7.6.2.2 spacing limit (d/2 বা 600mm, যেটা ছোট — Vs মাঝারি হলে; Vs বড় হলে d/4)
  warnings: string[];
}

const TWO_LEG_STIRRUP_COUNT = 2;

/** ACI 318-19 §22.5.5.1 (SI units): Vc = 0.17·λ·√f'c·bw·d, নিউটনে; ফলাফল kN। */
export function computeConcreteShearCapacity(
  widthMm: number,
  effectiveDepthMm: number,
  fcMPa: number
): number {
  const VcN = 0.17 * Math.sqrt(fcMPa) * widthMm * effectiveDepthMm;
  return VcN / 1000; // N → kN
}

export function designShearReinforcement(input: ShearDesignInput): ShearDesignResult {
  const { factoredShearKN, widthMm, effectiveDepthMm, fcMPa, fyMPa, stirrupDiameterMm } = input;
  const warnings: string[] = [];
  const phi = 0.75; // ACI 318-19 §21.2.1 — shear এর জন্য φ = 0.75

  const Vc = computeConcreteShearCapacity(widthMm, effectiveDepthMm, fcMPa);
  const phiVc = phi * Vc;
  const Vu = Math.abs(factoredShearKN);

  const stirrupNeeded = Vu > phiVc / 2;

  // ACI 318-19 §9.7.6.2.2 — spacing limit Vs এর মাত্রার উপর নির্ভরশীল:
  // Vs ≤ 0.33√f'c·bw·d হলে max spacing = min(d/2, 600mm), তার বেশি
  // হলে max spacing = min(d/4, 300mm)। প্রথমে d/2 ভিত্তিক সীমা দিয়ে
  // শুরু করে প্রয়োজনীয় Vs বের করার পর প্রযোজ্য সীমায় সমন্বয় করা হয়।
  const maxSpacingLow = Math.min(effectiveDepthMm / 2, 600);
  const maxSpacingHigh = Math.min(effectiveDepthMm / 4, 300);

  if (!stirrupNeeded) {
    return {
      phiVcKN: phiVc,
      requiredVsKN: 0,
      stirrupNeeded: false,
      requiredSpacingMm: null,
      maxSpacingMm: maxSpacingLow,
      warnings,
    };
  }

  const requiredVs = Math.max(0, Vu / phi - Vc);

  const VsMaxLimitN = 0.66 * Math.sqrt(fcMPa) * widthMm * effectiveDepthMm; // ACI §22.5.1.2 — Vs upper limit
  const VsMaxLimit = VsMaxLimitN / 1000;
  if (requiredVs > VsMaxLimit) {
    warnings.push(
      `Required Vs (${requiredVs.toFixed(1)} kN) exceeds the code upper limit (${VsMaxLimit.toFixed(1)} kN) — section is too small for shear; increase beam width/depth or concrete strength.`
    );
  }

  const stirrupAreaMm2 = getStirrupPairArea(stirrupDiameterMm);
  const maxSpacing = requiredVs > 0.33 * Math.sqrt(fcMPa) * widthMm * effectiveDepthMm / 1000 ? maxSpacingHigh : maxSpacingLow;

  // s = Av·fy·d / Vs (Vs in N)
  const requiredSpacing =
    requiredVs > 0
      ? (stirrupAreaMm2 * fyMPa * effectiveDepthMm) / (requiredVs * 1000)
      : maxSpacing;

  const governingSpacing = Math.min(requiredSpacing, maxSpacing);

  if (governingSpacing < 50) {
    warnings.push(
      `Required stirrup spacing (${governingSpacing.toFixed(0)}mm) is impractically small — consider a larger stirrup diameter, multi-leg stirrups, or a larger section.`
    );
  }

  return {
    phiVcKN: phiVc,
    requiredVsKN: requiredVs,
    stirrupNeeded: true,
    requiredSpacingMm: governingSpacing,
    maxSpacingMm: maxSpacing,
    warnings,
  };
}

/** ২-leg stirrup ধরে মোট cross-sectional area, mm²। */
function getStirrupPairArea(diameterMm: number): number {
  const singleArea = (Math.PI / 4) * diameterMm * diameterMm;
  return singleArea * TWO_LEG_STIRRUP_COUNT;
}
