/**
 * Cost Optimization — Unit-Rate-Driven Cost Estimate
 * Phase 9d — Phase 9c এর weightOptimization.ts takeoff-এর উপর ভিত্তি
 * করে, ইঞ্জিনিয়ার-দেওয়া unit rate (material type অনুযায়ী: concrete-
 * জাতীয় material প্রতি m³, steel-জাতীয় material প্রতি kg) প্রয়োগ
 * করে একটা cost breakdown তৈরি করে। এখানে কোনো ডিফল্ট/বিল্ট-ইন দাম
 * নেই — কোনো নির্দিষ্ট বাজার-মূল্য ডাটাবেস কোডবেসে নেই এবং লোকাল
 * বাজার/সময়ভেদে দাম ব্যাপক ভিন্ন হয়, তাই ভুল ডিফল্ট দেখানো বিভ্রান্তিকর
 * হতো — ইঞ্জিনিয়ার নিজে rate ইনপুট না দিলে honest "rate missing"
 * exclusion রিপোর্ট হয়, কোনো অনুমিত সংখ্যা প্রদর্শিত হয় না।
 *
 * গুরুত্বপূর্ণ সীমাবদ্ধতা: এই cost estimate শুধু 9c যা কভার করে তার
 * উপর ভিত্তি করে — অর্থাৎ শুধু concrete/steel-section self-weight
 * (gross section volume)। এতে অন্তর্ভুক্ত না: rebar/reinforcement
 * cost (9c কোনো rebar quantity ট্র্যাক করে না, শুধু gross concrete
 * volume — সেটা RC section-এর ভিতরের rebar আলাদাভাবে বাদ/যোগ করে
 * না), formwork, labor, equipment, overhead, combined/strip footing
 * (9c-তেই plan dimension না থাকায় বাদ)। এটা একটা material-cost-only
 * preliminary estimate, সম্পূর্ণ BOQ/cost-estimation প্রতিস্থাপন না।
 */

import { computeWeightTakeoff, type CategoryWeightSummary, type WeightTakeoffExclusion } from "@/lib/design/weightOptimization";
import type { StructuralElement } from "@/lib/types/element";
import type { StructuralMaterial, MaterialType } from "@/lib/types/material";
import type { StructuralSection } from "@/lib/types/section";

const GRAVITY_M_PER_S2 = 9.81; // kN → kg mass conversion (steel-জাতীয় material প্রতি kg দামের জন্য)

/**
 * প্রতিটা material type-এর জন্য unit rate — concrete-জাতীয়
 * (concrete/timber/frp/glass/aluminium — volume-based pricing
 * প্রচলিত এদের জন্য) প্রতি m³, steel-জাতীয় প্রতি kg (স্টিল প্রচলিতভাবে
 * ওজন অনুযায়ী কেনা হয়, ভলিউম অনুযায়ী না)। Composite material-এর
 * জন্য rate optional — না দিলে সেই category "rate missing" হিসেবে
 * excluded হবে (composite-এর pricing basis প্রকল্পভেদে ভিন্ন হতে
 * পারে, তাই একতরফাভাবে volume বা weight ধরে নেওয়া ঠিক না)।
 */
export interface CostRateInput {
  materialType: MaterialType;
  ratePerUnit: number; // volume-based হলে currency/m³, steel হলে currency/kg
  pricingBasis: "volume" | "weight";
}

export interface CategoryCostSummary extends CategoryWeightSummary {
  ratePerUnit: number | null;
  pricingBasis: "volume" | "weight" | null;
  cost: number | null; // null মানে rate সরবরাহ করা হয়নি
}

export interface CostOptimizationResult {
  categoryCosts: CategoryCostSummary[];
  totalCost: number;
  currencyNote: string;
  excluded: WeightTakeoffExclusion[];
  missingRateMaterialTypes: MaterialType[];
  message: string;
}

/**
 * material type অনুযায়ী rate lookup তৈরি করে (একাধিক entry একই type
 * এ থাকলে শেষেরটা জেতে — UI-এ ডুপ্লিকেট এড়ানো উচিত)।
 */
function buildRateMap(rates: CostRateInput[]): Map<MaterialType, CostRateInput> {
  const map = new Map<MaterialType, CostRateInput>();
  for (const r of rates) {
    map.set(r.materialType, r);
  }
  return map;
}

/**
 * Phase 9c এর takeoff চালিয়ে, প্রতিটা category+materialType group-এ
 * ইঞ্জিনিয়ার-দেওয়া rate প্রয়োগ করে cost বের করে। কোনো নতুন search/
 * optimization loop না (9a/9b এর মতো candidate sweep না) — 9c এর
 * মতোই একটা deterministic pass, শুধু weight-এর উপর একটা linear cost
 * layer।
 */
export function computeCostEstimate(
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[],
  rates: CostRateInput[],
  currencyLabel = "৳"
): CostOptimizationResult {
  const takeoff = computeWeightTakeoff(elements, materials, sections);
  const rateMap = buildRateMap(rates);

  const categoryCosts: CategoryCostSummary[] = takeoff.categorySummaries.map((summary) => {
    const rate = rateMap.get(summary.materialType);
    if (!rate) {
      return { ...summary, ratePerUnit: null, pricingBasis: null, cost: null };
    }
    const cost =
      rate.pricingBasis === "weight"
        ? ((summary.totalWeightKN * 1000) / GRAVITY_M_PER_S2) * rate.ratePerUnit // kN→N→kg × currency/kg
        : summary.totalVolumeM3 * rate.ratePerUnit; // m³ × currency/m³
    return { ...summary, ratePerUnit: rate.ratePerUnit, pricingBasis: rate.pricingBasis, cost };
  });

  const totalCost = categoryCosts.reduce((sum, c) => sum + (c.cost ?? 0), 0);

  const materialTypesInModel = new Set(categoryCosts.map((c) => c.materialType));
  const missingRateMaterialTypes = Array.from(materialTypesInModel).filter((mt) => !rateMap.has(mt));

  const message =
    categoryCosts.length > 0
      ? `${categoryCosts.filter((c) => c.cost !== null).length}/${categoryCosts.length}টি category-তে rate প্রয়োগ করা হয়েছে। আনুমানিক material cost (rebar/formwork/labor বাদে): ${currencyLabel}${totalCost.toLocaleString()}।${missingRateMaterialTypes.length > 0 ? ` rate অনুপস্থিত: ${missingRateMaterialTypes.join(", ")} — এই material-এর element cost-এ যোগ হয়নি।` : ""}`
      : `মডেলে কোনো costable element পাওয়া যায়নি — Weight Optimization ট্যাবে takeoff দেখুন।`;

  return {
    categoryCosts,
    totalCost,
    currencyNote: `সব cost একটা material-cost-only preliminary estimate — rebar/reinforcement, formwork, labor, equipment, overhead, combined/strip footing অন্তর্ভুক্ত না (কারণ বিস্তারিত weightOptimization.ts এর মন্তব্যে)।`,
    excluded: takeoff.excluded,
    missingRateMaterialTypes,
    message,
  };
}
