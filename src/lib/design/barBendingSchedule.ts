/**
 * Bar Bending Schedule (BBS)
 * Phase 10d — Detailing ইঞ্জিনের চতুর্থ ধাপ।
 *
 * 10a (bar diameter+count), 10b (zone spacing → count-in-zone), 10c
 * (hook extension length) — এই তিনটার আউটপুট একত্র করে প্রতি element-এর
 * bar schedule আর প্রজেক্ট-ব্যাপী summary বানানোই এই ফাইলের কাজ। MICON
 * রেফারেন্স PDF-এর "Reinf. Schedule of Slab" টেবিলগুলোর মতোই structure।
 *
 * এই BBS-এর computeTotalRebarWeightKg() হলো ভবিষ্যতের (deferred) Hub-sync
 * কাজে OutgoingQuantityOutput.reinforcementWeightKg ফিল্ড ভরার সোর্স —
 * কিন্তু এই ফেজে শুধু ডেটা তৈরি হচ্ছে, Hub-এ পাঠানো হচ্ছে না (আগের
 * সিদ্ধান্ত অনুযায়ী)।
 *
 * সীমাবদ্ধতা (v1, ইচ্ছাকৃতভাবে flagged):
 *   - শুধু দুই ধরনের shape সাপোর্ট করে: "straight" (main flexural bar, ২
 *     প্রান্তে ঐচ্ছিক hook) আর "stirrup-tie" (rectangular closed loop)।
 *     Crank/bent-up bar, L-shape, U-shape ইত্যাদি জটিল shape এই v1-এ নেই।
 *   - Stirrup/tie bend deduction একটা সাধারণ rule-of-thumb (প্রতি 90°
 *     bend-এ 2×db deduction) — এটা fabricator-নির্ভর সঠিক টেবিল না,
 *     quantity-estimation-এর জন্য যথেষ্ট নির্ভুল কিন্তু shop-drawing-exact
 *     cut length না।
 */

const STEEL_DENSITY_KG_PER_M3 = 7850; // স্ট্যান্ডার্ড ইস্পাত density (verified against well-known "16mmØ ≈ 1.58 kg/m" figure)

/** π/4 × d² × density — mm ব্যাস থেকে সরাসরি kg/m। */
export function computeRebarUnitWeightKgPerM(diameterMm: number): number {
  const areaM2 = (Math.PI / 4) * Math.pow(diameterMm / 1000, 2);
  return areaM2 * STEEL_DENSITY_KG_PER_M3;
}

export type BbsShapeType = "straight" | "stirrup-tie";

export interface BbsEntry {
  barMark: string;
  elementLabel: string;
  shapeType: BbsShapeType;
  barDiameterMm: number;
  count: number;
  cutLengthMm: number;
  totalLengthM: number;
  unitWeightKgPerM: number;
  totalWeightKg: number;
}

export interface StraightBarBbsInput {
  barMark: string;
  elementLabel: string;
  barDiameterMm: number;
  count: number;
  straightLengthMm: number; // মূল সোজা দৈর্ঘ্য (10a/10b থেকে zone length, বা span/height)
  hookExtensionStartMm?: number; // 10c-এর getStandardHookGeometry().extensionMm, থাকলে
  hookExtensionEndMm?: number;
}

export function computeStraightBarBbsEntry(input: StraightBarBbsInput): BbsEntry {
  const cutLengthMm = input.straightLengthMm + (input.hookExtensionStartMm ?? 0) + (input.hookExtensionEndMm ?? 0);
  const unitWeightKgPerM = computeRebarUnitWeightKgPerM(input.barDiameterMm);
  const totalLengthM = (cutLengthMm * input.count) / 1000;
  return {
    barMark: input.barMark,
    elementLabel: input.elementLabel,
    shapeType: "straight",
    barDiameterMm: input.barDiameterMm,
    count: input.count,
    cutLengthMm,
    totalLengthM,
    unitWeightKgPerM,
    totalWeightKg: totalLengthM * unitWeightKgPerM,
  };
}

export interface StirrupBbsInput {
  barMark: string;
  elementLabel: string;
  barDiameterMm: number;
  count: number; // মোট কতগুলো stirrup/tie লাগবে (zone length / spacing থেকে caller হিসাব করে দেবে)
  memberWidthMm: number;
  memberDepthMm: number;
  clearCoverMm: number;
  hookExtensionMm: number; // 10c থেকে (135° seismic hook হলে উভয় প্রান্তে একই ধরা হয়েছে)
}

const BEND_DEDUCTION_FACTOR_PER_90_DEG = 2; // ×db প্রতি bend — rule-of-thumb, fabricator-নির্ভর সঠিক টেবিল না
const STIRRUP_CORNER_COUNT = 4;

export function computeStirrupBbsEntry(input: StirrupBbsInput): BbsEntry {
  const coreWidthMm = input.memberWidthMm - 2 * input.clearCoverMm;
  const coreDepthMm = input.memberDepthMm - 2 * input.clearCoverMm;
  const perimeterMm = 2 * (coreWidthMm + coreDepthMm);
  const bendDeductionMm = STIRRUP_CORNER_COUNT * BEND_DEDUCTION_FACTOR_PER_90_DEG * input.barDiameterMm;
  const cutLengthMm = Math.max(0, perimeterMm + 2 * input.hookExtensionMm - bendDeductionMm);

  const unitWeightKgPerM = computeRebarUnitWeightKgPerM(input.barDiameterMm);
  const totalLengthM = (cutLengthMm * input.count) / 1000;
  return {
    barMark: input.barMark,
    elementLabel: input.elementLabel,
    shapeType: "stirrup-tie",
    barDiameterMm: input.barDiameterMm,
    count: input.count,
    cutLengthMm,
    totalLengthM,
    unitWeightKgPerM,
    totalWeightKg: totalLengthM * unitWeightKgPerM,
  };
}

/** কতগুলো stirrup/tie লাগবে একটা zone-এ — zone length আর spacing থেকে (fencepost: +1)। */
export function computeStirrupCountInZone(zoneLengthMm: number, spacingMm: number): number {
  if (spacingMm <= 0) return 0;
  return Math.max(1, Math.floor(zoneLengthMm / spacingMm) + 1);
}

// ---------------------------------------------------------------------------
// Project-wide summary
// ---------------------------------------------------------------------------
export interface BbsSummaryByDiameter {
  barDiameterMm: number;
  totalCount: number;
  totalLengthM: number;
  totalWeightKg: number;
}

export function summarizeBbsByDiameter(entries: BbsEntry[]): BbsSummaryByDiameter[] {
  const byDiameter = new Map<number, BbsSummaryByDiameter>();
  for (const entry of entries) {
    const existing = byDiameter.get(entry.barDiameterMm);
    if (existing) {
      existing.totalCount += entry.count;
      existing.totalLengthM += entry.totalLengthM;
      existing.totalWeightKg += entry.totalWeightKg;
    } else {
      byDiameter.set(entry.barDiameterMm, {
        barDiameterMm: entry.barDiameterMm,
        totalCount: entry.count,
        totalLengthM: entry.totalLengthM,
        totalWeightKg: entry.totalWeightKg,
      });
    }
  }
  return Array.from(byDiameter.values()).sort((a, b) => a.barDiameterMm - b.barDiameterMm);
}

/** Estimating app-এর জন্য (OutgoingQuantityOutput.reinforcementWeightKg-এর ভবিষ্যৎ সোর্স, এই ফেজে শুধু গণনা, পাঠানো হচ্ছে না)। */
export function computeTotalRebarWeightKg(entries: BbsEntry[]): number {
  return entries.reduce((sum, e) => sum + e.totalWeightKg, 0);
}
