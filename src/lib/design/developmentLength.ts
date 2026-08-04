/**
 * Development Length / Lap Splice Length / Standard Hook Calculator
 * Phase 10c — Detailing ইঞ্জিনের তৃতীয় ধাপ। ACI 318-19 Chapter 25।
 *
 * MICON রেফারেন্স PDF-এর General Notes-এ একটা lap-length টেবিল ছিল, কিন্তু
 * OCR extraction garbled/misaligned হওয়ায় নির্ভরযোগ্যভাবে reverse-engineer
 * করা যায়নি — তাই সেই project-specific টেবিল কপি না করে, standard ACI
 * 318-19 সূত্র (একাধিক independent সোর্স দিয়ে ওয়েব সার্চে confirm করা:
 * RHC Engineering, SkyCiv, ideCAD, CRSI, PCI Journal) ব্যবহার করা হয়েছে।
 *
 * সরলীকরণ (v1, ইচ্ছাকৃতভাবে flagged):
 *   - Ktr (transverse reinforcement index) ডিফল্ট ০ — কোড নিজেই এটাকে
 *     "design simplification" হিসেবে অনুমতি দেয় (§25.4.2.3 commentary)।
 *   - ψo, ψc (hook-এর favorable-condition factors) ডিফল্ট 1.0 — favorable
 *     cover/tie থাকলেও স্বয়ংক্রিয়ভাবে credit দেওয়া হয় না।
 *   - Standard hook bend-diameter/extension টেবিল (Table 25.3.1/25.3.2)
 *     একাধিক secondary সোর্স মিলিয়ে পুনর্গঠন করা consolidated
 *     approximation — ACI-এর মূল টেবিল সরাসরি দেখা যায়নি।
 */

export const BAR_SIZE_FACTOR_THRESHOLD_MM = 19; // No.6/No.7 boundary — ≤19mm হলে ψs=0.8
const MAX_CONFINEMENT_TERM = 2.5; // (cb+Ktr)/db এর কোড-নির্ধারিত সিলিং
const MAX_PSI_T_PSI_E = 1.7;
const MIN_TENSION_DEVELOPMENT_LENGTH_MM = 300;
const MIN_COMPRESSION_DEVELOPMENT_LENGTH_MM = 200;
const MIN_TENSION_LAP_SPLICE_LENGTH_MM = 300;
const MIN_COMPRESSION_LAP_SPLICE_LENGTH_MM = 300; // §25.5.5.1 — development length floor (200mm) থেকে আলাদা
const MIN_HOOK_DEVELOPMENT_LENGTH_MM = 150;

/** ψs — bar size factor: ≤19mm(No.6) হলে 0.8, তার বড় হলে 1.0 */
export function barSizeFactor(barDiameterMm: number): number {
  return barDiameterMm <= BAR_SIZE_FACTOR_THRESHOLD_MM ? 0.8 : 1.0;
}

/** ψg — grade factor (ACI 318-19-এ নতুন যোগ): fy≤420MPa(Grade60)→1.0, ≤550(Grade80)→1.15, তার বেশি(Grade100)→1.3 */
export function gradeFactor(fyMPa: number): number {
  if (fyMPa <= 420) return 1.0;
  if (fyMPa <= 550) return 1.15;
  return 1.3;
}

export interface TensionDevelopmentLengthInput {
  barDiameterMm: number;
  fyMPa: number;
  fcMPa: number;
  clearCoverOrHalfSpacingMm: number; // cb — বার কেন্দ্র থেকে নিকটতম পৃষ্ঠ, বা অর্ধেক clear spacing, যেটা ছোট
  isTopBar?: boolean; // ψt=1.3, নিচে ≥300mm fresh concrete থাকলে
  isEpoxyCoated?: boolean;
  hasLowCoverOrSpacing?: boolean; // epoxy হলে: cover<3db বা clear spacing<6db → ψe=1.5, নাহলে 1.2
  isLightweightConcrete?: boolean; // λ=0.75, না হলে 1.0
  transverseReinforcementIndexMm?: number; // Ktr, ডিফল্ট ০ (কোড-অনুমোদিত সরলীকরণ)
}

export interface DevelopmentLengthResult {
  developmentLengthMm: number;
  psiT: number;
  psiE: number;
  psiS: number;
  psiG: number;
  lambda: number;
  confinementTerm: number;
  warnings: string[];
}

/** ACI 318-19 §25.4.2.3, Eq. 25.4.2.3a (SI, mm/MPa) — detailed method, Ktr ডিফল্ট ০। */
export function computeTensionDevelopmentLength(input: TensionDevelopmentLengthInput): DevelopmentLengthResult {
  const warnings: string[] = [];
  const lambda = input.isLightweightConcrete ? 0.75 : 1.0;
  const psiS = barSizeFactor(input.barDiameterMm);
  const psiG = gradeFactor(input.fyMPa);
  const psiT = input.isTopBar ? 1.3 : 1.0;
  let psiE = 1.0;
  if (input.isEpoxyCoated) {
    psiE = input.hasLowCoverOrSpacing ? 1.5 : 1.2;
  }

  let psiTPsiE = psiT * psiE;
  if (psiTPsiE > MAX_PSI_T_PSI_E) {
    warnings.push(`ψt×ψe (${psiTPsiE.toFixed(2)}) কোডের ${MAX_PSI_T_PSI_E} সিলিং ছাড়িয়ে গেছে — ক্ল্যাম্প করা হলো।`);
    psiTPsiE = MAX_PSI_T_PSI_E;
  }

  const Ktr = input.transverseReinforcementIndexMm ?? 0;
  const rawConfinementTerm = (input.clearCoverOrHalfSpacingMm + Ktr) / input.barDiameterMm;
  const confinementTerm = Math.min(rawConfinementTerm, MAX_CONFINEMENT_TERM);
  if (rawConfinementTerm > MAX_CONFINEMENT_TERM) {
    warnings.push(
      `(cb+Ktr)/db (${rawConfinementTerm.toFixed(2)}) কোডের ${MAX_CONFINEMENT_TERM} সিলিং ছাড়িয়ে গেছে — ${MAX_CONFINEMENT_TERM}-এ ক্ল্যাম্প করা হলো।`,
    );
  }

  const ldRaw =
    (input.fyMPa / (1.1 * lambda * Math.sqrt(input.fcMPa))) * ((psiTPsiE * psiS * psiG) / confinementTerm) * input.barDiameterMm;
  const developmentLengthMm = Math.max(ldRaw, Math.max(MIN_TENSION_DEVELOPMENT_LENGTH_MM, 12 * input.barDiameterMm));

  return { developmentLengthMm, psiT, psiE, psiS, psiG, lambda, confinementTerm, warnings };
}

export interface CompressionDevelopmentLengthInput {
  barDiameterMm: number;
  fyMPa: number;
  fcMPa: number;
  isLightweightConcrete?: boolean;
  hasSpiralOrTieConfinement?: boolean; // §25.4.9.3 শর্ত পূরণ হলে ×0.75
}

/** ACI 318-19 §25.4.9.2/§25.4.9.3 (SI, mm/MPa). */
export function computeCompressionDevelopmentLength(input: CompressionDevelopmentLengthInput): number {
  const lambda = input.isLightweightConcrete ? 0.75 : 1.0;
  const term1 = (0.24 * input.fyMPa * input.barDiameterMm) / (lambda * Math.sqrt(input.fcMPa));
  const term2 = 0.043 * input.fyMPa * input.barDiameterMm;
  let raw = Math.max(term1, term2);
  if (input.hasSpiralOrTieConfinement) raw *= 0.75;
  return Math.max(raw, MIN_COMPRESSION_DEVELOPMENT_LENGTH_MM);
}

export type TensionLapSpliceClass = "A" | "B";

/**
 * ACI 318-19 §25.5.2.1 — Class A = 1.0×ld (শর্ত পূরণ হলে: As_provided ≥
 * 2×As_required পুরো length জুড়ে, এবং splice length-এর মধ্যে সর্বোচ্চ ৫০%
 * বার spliced), অন্যথায় Class B = 1.3×ld (ডিফল্ট)।
 */
export function computeTensionLapSpliceLength(developmentLengthMm: number, spliceClass: TensionLapSpliceClass): number {
  const multiplier = spliceClass === "A" ? 1.0 : 1.3;
  return Math.max(developmentLengthMm * multiplier, MIN_TENSION_LAP_SPLICE_LENGTH_MM);
}

export interface CompressionLapSpliceInput {
  barDiameterMm: number;
  fyMPa: number;
  fcMPa: number;
}

/** ACI 318-19 §25.5.5.1 (SI, mm/MPa) — fy≤420→0.071·fy·db, fy>420→(0.13·fy−24)·db, f'c<21MPa হলে ×4/3। */
export function computeCompressionLapSpliceLength(input: CompressionLapSpliceInput): { spliceLengthMm: number; warnings: string[] } {
  const warnings: string[] = [];
  let raw = input.fyMPa <= 420 ? 0.071 * input.fyMPa * input.barDiameterMm : (0.13 * input.fyMPa - 24) * input.barDiameterMm;
  if (input.fcMPa < 21) {
    raw *= 4 / 3;
    warnings.push(`f'c (${input.fcMPa}MPa) 21MPa-এর কম — ×4/3 factor প্রয়োগ করা হয়েছে (§25.5.5.1)।`);
  }
  return { spliceLengthMm: Math.max(raw, MIN_COMPRESSION_LAP_SPLICE_LENGTH_MM), warnings };
}

export interface StandardHookDevelopmentLengthInput {
  barDiameterMm: number;
  fyMPa: number;
  fcMPa: number;
  isLightweightConcrete?: boolean;
  isEpoxyCoated?: boolean; // ψe: 1.2 coated / 1.0 uncoated
  psiCConfinementCover?: number; // ψc — side cover ≥2.5in favorable হলে 0.8, ডিফল্ট 1.0
  psiRTieConfinement?: number; // ψr — hook ties দিয়ে ঘেরা favorable হলে 0.8, ডিফল্ট 1.0
  psiOLocationFactor?: number; // ψo — location factor, ডিফল্ট 1.0
}

/** ACI 318-19 §25.4.3.1 (SI, mm/MPa) — ψc/ψr/ψo ডিফল্ট 1.0 (conservative, favorable credit auto-apply হয় না)। */
export function computeStandardHookDevelopmentLength(input: StandardHookDevelopmentLengthInput): number {
  const lambda = input.isLightweightConcrete ? 0.75 : 1.0;
  const psiE = input.isEpoxyCoated ? 1.2 : 1.0;
  const psiC = input.psiCConfinementCover ?? 1.0;
  const psiR = input.psiRTieConfinement ?? 1.0;
  const psiO = input.psiOLocationFactor ?? 1.0;

  const ldhRaw = (0.24 * input.fyMPa * psiE * psiO * psiR * psiC * input.barDiameterMm) / (lambda * Math.sqrt(input.fcMPa));
  return Math.max(ldhRaw, 8 * input.barDiameterMm, MIN_HOOK_DEVELOPMENT_LENGTH_MM);
}

// ---------------------------------------------------------------------------
// Standard Hook Geometry — ACI 318-19 Table 25.3.1 (main bars) / Table 25.3.2
// (stirrups/ties) + §25.3.1 (extension) — একাধিক independent সোর্স (ideCAD,
// CRSI Manual of Standard Practice, Caltrans Bridge Design Details) দিয়ে
// ওয়েব সার্চে cross-confirm করা consolidated approximation।
// ---------------------------------------------------------------------------
export type HookBendAngleDeg = 90 | 135 | 180;

export interface StandardHookGeometryInput {
  barDiameterMm: number;
  bendAngleDeg: HookBendAngleDeg;
  isStirrupOrTie: boolean;
}

export interface StandardHookGeometry {
  bendDiameterMm: number; // ভিতরের bend diameter
  extensionMm: number; // bend-এর পর সোজা extension (tail)
  warnings: string[];
}

/**
 * isStirrupOrTie=true হলে ছোট-বার stirrup/tie bend-diameter rule প্রযোজ্য
 * (Table 25.3.2: ≤16mm→4db, তার বড় হলে 6db); অন্যথায় main/longitudinal
 * bar rule (Table 25.3.1: 10-25mm→6db, 28-36mm→8db, 43-57mm→10db)।
 */
export function getStandardHookGeometry(input: StandardHookGeometryInput): StandardHookGeometry {
  const warnings: string[] = [
    "Bend diameter/extension একাধিক secondary সোর্স মিলিয়ে reconstruct করা consolidated approximation — চূড়ান্ত shop drawing-এর আগে ACI 318-19 Table 25.3.1/25.3.2 সরাসরি যাচাই করে নিন।",
  ];
  const { barDiameterMm, bendAngleDeg, isStirrupOrTie } = input;

  let bendDiameterMm: number;
  if (isStirrupOrTie) {
    bendDiameterMm = barDiameterMm <= 16 ? 4 * barDiameterMm : 6 * barDiameterMm; // Table 25.3.2
  } else if (barDiameterMm <= 25) {
    bendDiameterMm = 6 * barDiameterMm; // No.3-No.8 (10-25mm)
  } else if (barDiameterMm <= 36) {
    bendDiameterMm = 8 * barDiameterMm; // No.9-No.11 (28-36mm)
  } else {
    bendDiameterMm = 10 * barDiameterMm; // No.14, No.18 (43,57mm)
  }

  let extensionMm: number;
  if (bendAngleDeg === 180) {
    extensionMm = Math.max(4 * barDiameterMm, 65); // 4db, ≥2.5in≈65mm
  } else if (bendAngleDeg === 135) {
    extensionMm = 6 * barDiameterMm; // seismic hook, stirrup/tie-তে সাধারণ
    if (!isStirrupOrTie && barDiameterMm > 25) {
      warnings.push("135° hook সাধারণত ≤25mm(No.8) main bar বা stirrup/tie-এর জন্য — এই diameter তার চেয়ে বড়, যাচাই করুন।");
    }
  } else {
    extensionMm = isStirrupOrTie || barDiameterMm <= 16 ? 6 * barDiameterMm : 12 * barDiameterMm; // 90°
  }

  return { bendDiameterMm, extensionMm, warnings };
}
