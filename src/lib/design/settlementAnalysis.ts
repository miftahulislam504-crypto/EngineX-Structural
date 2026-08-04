/**
 * Geotechnical — Settlement Analysis (Elastic + Simplified Consolidation)
 * Phase 7e — এই app কোনো soil boring/lab test করে না; elastic
 * modulus (Es), Poisson's ratio (ν), compression/recompression index
 * (Cc/Cr), preconsolidation pressure (σ'c) সব geotechnical report
 * থেকে ইঞ্জিনিয়ার সরবরাহ করেন। এই মডিউল classical hand-calculation
 * সূত্র প্রয়োগ করে, কোনো FE-based soil-structure interaction বা
 * multi-layer numerical integration না (সেটা dedicated geotechnical
 * সফটওয়্যারের কাজ)।
 */

export type FootingRigidity = "flexible" | "rigid";

export interface ElasticSettlementInput {
  netFoundationPressureKPa: number; // q, net applied pressure (গ্রস pressure বিয়োগ overburden)
  footingWidthM: number; // B
  footingLengthM?: number; // L, strip হলে undefined রাখা যায় (L/B → ∞ ধরা হয়)
  soilElasticModulusMPa: number; // Es
  soilPoissonRatio: number; // ν
  rigidity: FootingRigidity;
  isCircular?: boolean;
}

export interface ElasticSettlementResult {
  influenceFactor: number; // If
  immediateSettlementMm: number;
  warnings: string[];
}

/**
 * ইলাস্টিক সেটেলমেন্ট, ক্লাসিক্যাল সূত্র (Poulos & Davis / Terzaghi):
 *   Se = q·B·(1-ν²)·If / Es
 * If (influence factor) rigidity ও L/B অনুপাতের উপর নির্ভরশীল —
 * নিচের টেবিল একটা প্রচলিত সরলীকৃত reference (ব্যাপকভাবে ব্যবহৃত
 * hand-calculation approximation, exact elasticity solution না)।
 */
export function computeElasticSettlement(input: ElasticSettlementInput): ElasticSettlementResult {
  const { netFoundationPressureKPa, footingWidthM, footingLengthM, soilElasticModulusMPa, soilPoissonRatio, rigidity, isCircular } =
    input;
  const warnings: string[] = [];

  if (footingWidthM <= 0 || soilElasticModulusMPa <= 0) {
    warnings.push("Footing width and soil elastic modulus must be positive.");
    return { influenceFactor: 0, immediateSettlementMm: 0, warnings };
  }

  const LtoB = footingLengthM ? footingLengthM / footingWidthM : Number.POSITIVE_INFINITY;

  let influenceFactor: number;
  if (isCircular) {
    influenceFactor = rigidity === "rigid" ? 0.79 : 1.0; // center-average approximation for flexible circular
  } else if (rigidity === "rigid") {
    if (LtoB <= 1.5) influenceFactor = 0.88;
    else if (LtoB <= 5) influenceFactor = 0.82;
    else influenceFactor = 0.71; // strip footing এর কাছাকাছি (L/B বড়)
  } else {
    // flexible, center-average settlement approximation
    if (LtoB <= 1.5) influenceFactor = 1.06;
    else if (LtoB <= 5) influenceFactor = 1.3;
    else influenceFactor = 1.7; // strip footing
  }

  const EsKPa = soilElasticModulusMPa * 1000;
  const Se = (netFoundationPressureKPa * footingWidthM * (1 - soilPoissonRatio ** 2) * influenceFactor) / EsKPa;

  if (soilPoissonRatio < 0 || soilPoissonRatio >= 0.5) {
    warnings.push(`Poisson's ratio (${soilPoissonRatio}) is outside the typical valid range (0 to <0.5) — verify input.`);
  }

  return { influenceFactor, immediateSettlementMm: Se * 1000, warnings };
}

export interface ConsolidationSettlementInput {
  initialVoidRatio: number; // e0
  compressionIndex: number; // Cc
  recompressionIndex?: number; // Cr — দিলে over-consolidated soil ধরা হয় (σ'0 < σ'c < σ'0+Δσ' এর ক্ষেত্রে dual-slope calculation)
  layerThicknessM: number; // H, compressible layer thickness
  initialEffectiveStressKPa: number; // σ'0, layer মধ্যবিন্দুতে
  stressIncreaseKPa: number; // Δσ', foundation load থেকে ঐ গভীরতায় stress increase (Boussinesq বা approximate method দিয়ে ইঞ্জিনিয়ার আলাদাভাবে বের করবেন — এই মডিউল সেই ধাপ করে না)
  preconsolidationPressureKPa?: number; // σ'c — দিলে over-consolidated বিবেচনা করা হয়
}

export interface ConsolidationSettlementResult {
  isOverConsolidated: boolean;
  consolidationSettlementMm: number;
  warnings: string[];
}

/**
 * সরলীকৃত এক-মাত্রিক consolidation settlement (Terzaghi):
 * Normally consolidated: Sc = Cc·H/(1+e0)·log10[(σ'0+Δσ')/σ'0]
 * Over-consolidated (σ'0+Δσ' ≤ σ'c): Sc = Cr·H/(1+e0)·log10[(σ'0+Δσ')/σ'0]
 * Over-consolidated (σ'0+Δσ' > σ'c): dual-slope — Cr অংশ σ'0→σ'c, Cc অংশ σ'c→σ'0+Δσ'
 *
 * এই মডিউল Δσ' (stress increase at depth) নিজে গণনা করে না — সেটা
 * Boussinesq বা 2:1 approximate method দিয়ে ইঞ্জিনিয়ার আলাদাভাবে বের
 * করে input হিসেবে দেবেন, কারণ সেই গণনা layer geometry ও load
 * distribution-এর উপর নির্ভরশীল যা এই app-এর geometry model থেকে
 * automatically derive করা এই v1-এ সম্ভব না।
 */
export function computeConsolidationSettlement(input: ConsolidationSettlementInput): ConsolidationSettlementResult {
  const {
    initialVoidRatio,
    compressionIndex,
    recompressionIndex,
    layerThicknessM,
    initialEffectiveStressKPa,
    stressIncreaseKPa,
    preconsolidationPressureKPa,
  } = input;
  const warnings: string[] = [];

  if (initialEffectiveStressKPa <= 0) {
    warnings.push("Initial effective stress must be positive — check the input.");
    return { isOverConsolidated: false, consolidationSettlementMm: 0, warnings };
  }

  const finalStress = initialEffectiveStressKPa + stressIncreaseKPa;
  const H_over_1_plus_e0 = layerThicknessM / (1 + initialVoidRatio);

  let Sc: number;
  let isOverConsolidated = false;

  if (preconsolidationPressureKPa !== undefined && preconsolidationPressureKPa > initialEffectiveStressKPa) {
    isOverConsolidated = true;
    const Cr = recompressionIndex ?? compressionIndex / 5; // না দিলে প্রচলিত অনুমান Cr ≈ Cc/5-Cc/10, রক্ষণশীলভাবে Cc/5
    if (recompressionIndex === undefined) {
      warnings.push(
        "Recompression index (Cr) was not provided — approximated as Cc/5 (a common but rough rule of thumb; provide Cr from the geotechnical report for accuracy)."
      );
    }

    if (finalStress <= preconsolidationPressureKPa) {
      Sc = Cr * H_over_1_plus_e0 * Math.log10(finalStress / initialEffectiveStressKPa);
    } else {
      const recompressionPart = Cr * H_over_1_plus_e0 * Math.log10(preconsolidationPressureKPa / initialEffectiveStressKPa);
      const virginCompressionPart = compressionIndex * H_over_1_plus_e0 * Math.log10(finalStress / preconsolidationPressureKPa);
      Sc = recompressionPart + virginCompressionPart;
    }
  } else {
    Sc = compressionIndex * H_over_1_plus_e0 * Math.log10(finalStress / initialEffectiveStressKPa);
  }

  if (stressIncreaseKPa < 0) {
    warnings.push("Stress increase (Δσ') is negative — check the input; consolidation settlement assumes loading, not unloading.");
  }

  return { isOverConsolidated, consolidationSettlementMm: Math.max(0, Sc) * 1000, warnings };
}

export interface TotalSettlementInput {
  elastic: ElasticSettlementResult;
  consolidation?: ConsolidationSettlementResult;
  allowableTotalSettlementMm?: number; // ডিফল্ট 25mm (isolated footing এর জন্য প্রচলিত সীমা, IS 1904/ACI প্রচলিত practice)
  allowableDifferentialSettlementMm?: number; // এই মডিউল একটা single footing এর জন্য, differential settlement (একাধিক footing এর তুলনা) এখানে চেক করা হয় না
}

export interface TotalSettlementResult {
  totalSettlementMm: number;
  allowableSettlementMm: number;
  utilizationRatio: number;
  adequate: boolean;
  warnings: string[];
}

export function checkTotalSettlement(input: TotalSettlementInput): TotalSettlementResult {
  const { elastic, consolidation, allowableTotalSettlementMm } = input;
  const warnings = [...elastic.warnings, ...(consolidation?.warnings ?? [])];

  const total = elastic.immediateSettlementMm + (consolidation?.consolidationSettlementMm ?? 0);
  const allowable = allowableTotalSettlementMm ?? 25;

  const ratio = allowable > 0 ? total / allowable : Number.POSITIVE_INFINITY;
  const adequate = Number.isFinite(ratio) && ratio <= 1.0;

  if (!adequate) {
    warnings.push(
      `Total settlement (${total.toFixed(1)}mm) exceeds the allowable limit (${allowable.toFixed(1)}mm) — consider a larger footing, deeper foundation, or ground improvement.`
    );
  }

  warnings.push(
    "This settlement estimate does not account for differential settlement between adjacent foundations, which is often more critical to the structure than total settlement — verify differential settlement separately across the foundation layout."
  );

  return { totalSettlementMm: total, allowableSettlementMm: allowable, utilizationRatio: ratio, adequate, warnings };
}
