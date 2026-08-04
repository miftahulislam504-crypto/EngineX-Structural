/**
 * Rebar Layout — Auto Reinforcement Solver
 * Phase 10a — Detailing ইঞ্জিন-এর প্রথম ধাপ।
 *
 * Phase 6 (Design Engine) required steel AREA বের করে (RcBeamDesignReport.
 * flexure.governingAsMm2, বা RcColumnDesignReport-এর ইনপুট হিসেবে ইঞ্জিনিয়ার-
 * নির্ধারিত totalAsMm2) — কিন্তু সেই area থেকে বাস্তবে কতগুলো কত mmØ বার
 * লাগবে, ওগুলো section-এর ভিতরে fit করে কিনা, না করলে কী করা হবে — এই কাজ
 * এখনো কোথাও ছিল না। এই ফাইল সেই gap পূরণ করে।
 *
 * Phase 9b (sectionOptimization.ts)-এর diameter×count sweep ধারণা এখানে
 * re-use করা হয়েছে (REBAR_SIZES + totalRebarArea, একই catalog) কিন্তু
 * উদ্দেশ্য আলাদা:
 *   - 9b: একটা section-এর জন্য সবচেয়ে হালকা bar combination খুঁজে বের করে,
 *     candidate-প্রতি পুরো design report (runRcBeamDesign/runRcColumnDesign)
 *     আবার চালিয়ে feasibility যাচাই করে — optimization।
 *   - এই ফাইল (rebarLayout.ts): required As টা already fixed ধরে নেয়
 *     (design engine বা optimizer থেকে already এসেছে), আর সেটা section-এর
 *     clear width/perimeter-এর ভিতরে physically ফিট করে কিনা — এই সম্পূর্ণ
 *     নতুন চেক (ACI 318-19 §25.2.1 clear spacing) প্রথম এখানে যোগ হলো।
 *     কোনো ফাইলই আগে এই check করত না।
 *
 * সীমাবদ্ধতা (v1) — সবগুলো ইচ্ছাকৃতভাবে out of scope, পরের ধাপে আসবে:
 *   - Beam curtailment point (span-এর কোথায় extra bar কেটে যাবে, যেমন
 *     MICON-এর রেফারেন্স PDF-এ দেখা L/4, L/3 পয়েন্ট) — এটার জন্য moment
 *     envelope আর development length লাগে, আসবে Phase 10c-এ।
 *   - Slab/Wall/Footing bar-spacing solve এই ফাইলে নেই — ওটা ভিন্ন ধরনের
 *     সমস্যা (As-per-unit-width → spacing, না যে fixed width-এর ভিতরে
 *     bar count বসানো) — 10a-এর পরের ডেলিভারিতে।
 *   - Column: শুধু rectangular tied, uniaxial-symmetric ধরা হয়েছে — same
 *     সীমাবদ্ধতা RcColumnDesignInput নিজেও explicitly বলে ("totalAsMm2
 *     symmetric ধরা হয়")।
 */

import { REBAR_SIZES, totalRebarArea, getRebarSize } from "@/lib/design/rebarSizes";
import { convertAsToBarSpacing } from "@/lib/design/rcSlabFlexure";

// ---------------------------------------------------------------------------
// Clear spacing rule — ACI 318-19 §25.2.1 (একই layer-এর ভিতরে বার):
//   s_clear ≥ max(25mm, db, (4/3)×dagg)
// dagg (সর্বোচ্চ coarse aggregate size)-এর কোনো একক ফিক্সড মান কোড দেয় না —
// এটা প্রজেক্ট-নির্ভর ইনপুট, তাই এখানে optional parameter হিসেবে রাখা
// হলো, ডিফল্ট ২০mm (¾ ইঞ্চি, বাংলাদেশে সাধারণ RCC প্র্যাকটিসে প্রচলিত
// coarse aggregate size) — silently hardcode না করে ইঞ্জিনিয়ার override
// করতে পারবে।
// ---------------------------------------------------------------------------
export const MIN_ABSOLUTE_CLEAR_SPACING_MM = 25;
export const DEFAULT_MAX_AGGREGATE_SIZE_MM = 20;

export function minClearSpacingMm(barDiameterMm: number, maxAggregateSizeMm = DEFAULT_MAX_AGGREGATE_SIZE_MM): number {
  return Math.max(MIN_ABSOLUTE_CLEAR_SPACING_MM, barDiameterMm, (4 / 3) * maxAggregateSizeMm);
}

/**
 * এক সারিতে (single layer) কতগুলো bar ফিট করবে — দেওয়া উপাদান-প্রস্থ,
 * ক্লিয়ার কভার, confining bar (stirrup/tie) ব্যাস আর longitudinal bar
 * ব্যাস অনুযায়ী। প্রথম আর শেষ বারের কেন্দ্র ঠিক confining bar-এর ভিতরের
 * প্রান্তে বসে ধরা হয়েছে (standard convention)।
 */
export function maxBarsInOneLayer(params: {
  widthMm: number;
  clearCoverMm: number;
  confiningBarDiameterMm: number; // beam: stirrup, column: tie
  barDiameterMm: number;
  maxAggregateSizeMm?: number;
}): number {
  const s = minClearSpacingMm(params.barDiameterMm, params.maxAggregateSizeMm);
  const availableWidthForBars =
    params.widthMm - 2 * (params.clearCoverMm + params.confiningBarDiameterMm) - params.barDiameterMm;
  if (availableWidthForBars < 0) return 0;
  return Math.floor(availableWidthForBars / (params.barDiameterMm + s)) + 1;
}

// ---------------------------------------------------------------------------
// Beam — flexural bar layout
// ---------------------------------------------------------------------------
export interface BeamBarLayoutInput {
  elementLabel: string;
  widthMm: number;
  clearCoverMm: number;
  stirrupDiameterMm: number;
  tensionAsMm2: number; // Phase 6a-এর RcBeamDesignReport.flexure.governingAsMm2
  compressionAsMm2?: number; // doubly-reinforced হলে (6f gap-fill)
  barDiameterOptionsMm?: number[]; // না দিলে REBAR_SIZES পুরোটা
  maxAggregateSizeMm?: number;
}

export interface BarGroupLayout {
  barDiameterMm: number;
  barCount: number;
  providedAsMm2: number;
  layers: number[]; // প্রতি লেয়ারে কতগুলো বার (index 0 = confining bar-এর সবচেয়ে কাছেরটা)
}

export interface BeamBarLayoutResult {
  elementLabel: string;
  tension: BarGroupLayout;
  compression: BarGroupLayout | null;
  feasible: boolean;
  warnings: string[];
}

/**
 * একটা bar group (tension বা compression)-এর জন্য সবচেয়ে কম layer আর
 * তারপর সবচেয়ে কম providedAs — এই দুই criteria-তে diameter+count বাছাই
 * করে। Engineer barDiameterOptionsMm দিয়ে candidate সীমিত/override করতে
 * পারবে।
 */
function solveBarGroup(
  requiredAsMm2: number,
  widthMm: number,
  clearCoverMm: number,
  confiningBarDiameterMm: number,
  barDiameterOptionsMm: number[],
  maxAggregateSizeMm: number | undefined,
): { layout: BarGroupLayout; warnings: string[] } {
  let best: { layout: BarGroupLayout; layersUsed: number } | null = null;

  for (const barDiameterMm of barDiameterOptionsMm) {
    const singleAreaMm2 = getRebarSize(barDiameterMm).areaMm2;
    const minCountForArea = Math.max(2, Math.ceil(requiredAsMm2 / singleAreaMm2)); // ন্যূনতম ২টা bar
    const perLayer = maxBarsInOneLayer({
      widthMm,
      clearCoverMm,
      confiningBarDiameterMm,
      barDiameterMm,
      maxAggregateSizeMm,
    });
    if (perLayer < 2) continue; // এই diameter-এ ২টা বারও এক লেয়ারে ফিট করছে না

    const layersUsed = Math.ceil(minCountForArea / perLayer);
    const layers: number[] = [];
    let remaining = minCountForArea;
    for (let i = 0; i < layersUsed; i++) {
      const inThisLayer = Math.min(perLayer, remaining);
      layers.push(inThisLayer);
      remaining -= inThisLayer;
    }

    const candidate: BarGroupLayout = {
      barDiameterMm,
      barCount: minCountForArea,
      providedAsMm2: totalRebarArea(barDiameterMm, minCountForArea),
      layers,
    };

    if (
      !best ||
      layersUsed < best.layersUsed ||
      (layersUsed === best.layersUsed && candidate.providedAsMm2 < best.layout.providedAsMm2)
    ) {
      best = { layout: candidate, layersUsed };
    }
  }

  if (!best) {
    return {
      layout: { barDiameterMm: 0, barCount: 0, providedAsMm2: 0, layers: [] },
      warnings: [
        `কোনো bar diameter দিয়ে required As (${requiredAsMm2.toFixed(0)} mm²) reasonable লেয়ারে ফিট করানো গেল না — beam width বাড়ানো লাগবে।`,
      ],
    };
  }

  const warnings: string[] = [];
  if (best.layersUsed > 2) {
    warnings.push(
      `${best.layersUsed} layer লাগছে (${best.layout.barCount}-${best.layout.barDiameterMm}mmØ) — সাধারণত ২ layer-এর বেশি এড়ানো ভালো, beam width/depth পুনর্বিবেচনা করুন।`,
    );
  }
  return { layout: best.layout, warnings };
}

export function layoutBeamBars(input: BeamBarLayoutInput): BeamBarLayoutResult {
  const barDiameterOptionsMm = input.barDiameterOptionsMm ?? REBAR_SIZES.map((r) => r.diameterMm);
  const warnings: string[] = [];

  const tensionResult = solveBarGroup(
    input.tensionAsMm2,
    input.widthMm,
    input.clearCoverMm,
    input.stirrupDiameterMm,
    barDiameterOptionsMm,
    input.maxAggregateSizeMm,
  );
  warnings.push(...tensionResult.warnings);

  let compression: BarGroupLayout | null = null;
  if (input.compressionAsMm2 && input.compressionAsMm2 > 0) {
    const compressionResult = solveBarGroup(
      input.compressionAsMm2,
      input.widthMm,
      input.clearCoverMm,
      input.stirrupDiameterMm,
      barDiameterOptionsMm,
      input.maxAggregateSizeMm,
    );
    warnings.push(...compressionResult.warnings.map((w) => `Compression: ${w}`));
    compression = compressionResult.layout;
  }

  const feasible = tensionResult.layout.barCount > 0 && (compression === null || compression.barCount > 0);

  return {
    elementLabel: input.elementLabel,
    tension: tensionResult.layout,
    compression,
    feasible,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Column — perimeter longitudinal bar layout
// ---------------------------------------------------------------------------
export interface ColumnBarLayoutInput {
  elementLabel: string;
  widthMm: number; // b
  totalDepthMm: number; // h
  clearCoverMm: number; // কভার tie-এর বাইরের ফেস থেকে
  tieDiameterMm: number;
  totalAsMm2: number; // Phase 6b/9b থেকে already-validated
  longitudinalBarDiameterMm: number; // Phase 6b/9b থেকে already-decided diameter
}

export interface ColumnBarLayoutResult {
  elementLabel: string;
  barDiameterMm: number;
  barCount: number; // totalAsMm2 থেকে round up
  providedAsMm2: number;
  cornerBarCount: 4;
  // [widthMm face ১, totalDepthMm face ১, widthMm face ২, totalDepthMm face ২] —
  // প্রতি face-এ কর্নার বাদে কতগুলো অতিরিক্ত বার বসছে
  faceBarCountEachFace: [number, number, number, number];
  feasible: boolean;
  warnings: string[];
}

/**
 * Rectangular tied column — ৪টা কর্নার বার বাধ্যতামূলক, বাকি বার widthMm
 * face-জোড়া আর totalDepthMm face-জোড়ায় face-length অনুপাতে ভাগ করে
 * (লম্বা face-এ বেশি বার), প্রতি জোড়ার দুই face সমান রেখে symmetry
 * বজায় রাখে — RcColumnDesignInput নিজেও totalAsMm2-কে symmetric ধরে।
 */
export function layoutColumnBars(input: ColumnBarLayoutInput): ColumnBarLayoutResult {
  const warnings: string[] = [];
  const singleAreaMm2 = getRebarSize(input.longitudinalBarDiameterMm).areaMm2;
  const barCount = Math.max(4, Math.ceil(input.totalAsMm2 / singleAreaMm2));

  const extraBars = barCount - 4;
  const pairsToPlace = Math.floor(extraBars / 2);
  const oddLeftover = extraBars - pairsToPlace * 2; // সাধারণত ০, symmetric column-এ barCount জোড় হওয়াই আদর্শ

  const totalFaceLength = input.widthMm + input.totalDepthMm;
  const widthFacePairs = Math.round((pairsToPlace * input.widthMm) / totalFaceLength);
  const depthFacePairs = pairsToPlace - widthFacePairs;

  // face order: [width face ১, depth face ১, width face ২, depth face ২]
  const faceBarCountEachFace: [number, number, number, number] = [
    widthFacePairs,
    depthFacePairs,
    widthFacePairs,
    depthFacePairs + oddLeftover, // বিজোড় leftover থাকলে একটা face-এ যোগ, flagged নিচে
  ];

  if (oddLeftover > 0) {
    warnings.push(
      `barCount (${barCount}) বিজোড় — rectangular tied column সাধারণত জোড় সংখ্যক symmetric bar ব্যবহার করে; ১টা বার asymmetric face-এ বসানো হয়েছে, engineer পুনর্বিবেচনা করুন।`,
    );
  }

  // সংকীর্ণতম face-এ clear spacing চেক (সবচেয়ে বেশি বার জমার ঝুঁকি ওখানেই)
  const shortestFaceMm = Math.min(input.widthMm, input.totalDepthMm);
  const maxOnShortestFace = maxBarsInOneLayer({
    widthMm: shortestFaceMm,
    clearCoverMm: input.clearCoverMm,
    confiningBarDiameterMm: input.tieDiameterMm,
    barDiameterMm: input.longitudinalBarDiameterMm,
  });
  const extraOnShortestFace = Math.max(depthFacePairs, widthFacePairs); // যেই face pair widthMm/totalDepthMm-এর ছোটটার সাথে মেলে তার count রক্ষণাত্মকভাবে ধরা হলো
  const barsOnShortestFace = 2 + extraOnShortestFace; // ২ কর্নার + ওই face-এর extra বার

  const feasible = barsOnShortestFace <= maxOnShortestFace;
  if (!feasible) {
    warnings.push(
      `${barCount}-${input.longitudinalBarDiameterMm}mmØ perimeter-এ নাও ফিট করতে পারে — সংকীর্ণতম face (${shortestFaceMm}mm)-এ সর্বোচ্চ ${maxOnShortestFace}টা বার ধরে, layout-এ ${barsOnShortestFace}টা লাগছে। bar diameter বাড়ান অথবা column dimension পুনর্বিবেচনা করুন।`,
    );
  }

  return {
    elementLabel: input.elementLabel,
    barDiameterMm: input.longitudinalBarDiameterMm,
    barCount,
    providedAsMm2: totalRebarArea(input.longitudinalBarDiameterMm, barCount),
    cornerBarCount: 4,
    faceBarCountEachFace,
    feasible,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Slab / Wall / Footing — distributed (per-meter-width) bar spacing layout
// ---------------------------------------------------------------------------
// Beam/Column-এর সমস্যা ছিল "fixed width-এর ভিতরে N bar ফিট করাও"। এখানে
// সমস্যা উল্টো: As একটা per-meter-width রেট হিসেবে দেওয়া থাকে
// (Phase 6d RcSlabDesignReport/RcWallDesignReport, Phase 6e footing — সব
// কটাই ইতিমধ্যে "AsPerMeterMm2" কনভেনশন ব্যবহার করে) — bar diameter বেছে
// spacing (center-to-center) বের করাই কাজ।
//
// rcSlabFlexure.ts-এ আগে থেকেই convertAsToBarSpacing() ছিল (As/m + dia →
// spacing) কিন্তু কোথাও call হতো না — এখানে সেটাই re-use করা হয়েছে,
// diameter-selection আর max-spacing-cap লজিক যোগ করে।

// ACI 318-19 §7.7.2.3 (primary flexural reinforcement, one-way slabs —
// combined/strip footing-ও Chapter 7-এর এই ধারা refer করে, §13.3.2.1
// অনুযায়ী) ও §24.4.3.3 (shrinkage/temperature) — ওয়েব সার্চে confirm করা।
export const MAX_FLEXURAL_SPACING_FACTOR = 3; // ×thickness
export const MAX_SHRINKAGE_SPACING_FACTOR = 5; // ×thickness
export const MAX_SPACING_ABSOLUTE_MM = 450; // উভয় rule-ই এই সিলিং-এ capped

const PRACTICAL_SPACING_INCREMENT_MM = 25; // real drawing convention-এর কাছাকাছি রাউন্ডিং গ্রানুলারিটি

// ACI hard rule না — crack control আর ঢালাইয়ের সময় বার-এর মধ্যে জ্যাম
// এড়াতে সাধারণ প্র্যাকটিসে মানা একটা practical floor। এটা ছাড়া
// "largest diameter, widest spacing"-এর দিকে সমাধান চলে যায় (v1 hand-
// verify-এ ধরা পড়েছে: 254mm²/m শ্রিংকেজ স্টিলের জন্য 12mmØ@425mm বের
// হচ্ছিল, যেখানে বাস্তব MICON রেফারেন্স 10mmØ@~140mm ব্যবহার করে)।
const PRACTICAL_MIN_SPACING_MM = 75;

export type DistributedReinforcementRole = "flexural" | "shrinkage-temperature";

export interface DistributedBarLayoutInput {
  elementLabel: string;
  requiredAsPerMeterMm2: number; // Phase 6d/6e থেকে (positiveDesign.governingAsMm2, minAsPerMeterMm2, ইত্যাদি)
  thicknessMm: number; // slab/wall thickness, বা footing depth — max-spacing cap-এর জন্য
  reinforcementRole: DistributedReinforcementRole;
  barDiameterOptionsMm?: number[];
  maxAggregateSizeMm?: number;
}

export interface DistributedBarLayout {
  barDiameterMm: number;
  spacingMm: number; // 25mm increment-এ রাউন্ড ডাউন করা, কখনো under-provide করে না
  providedAsPerMeterMm2: number;
}

export interface DistributedBarLayoutResult {
  elementLabel: string;
  layout: DistributedBarLayout;
  maxAllowedSpacingMm: number;
  feasible: boolean;
  warnings: string[];
}

/**
 * ছোট diameter → বেশি, কাছাকাছি বার → ভালো crack control, সাধারণ slab/wall/
 * footing detailing practice-এও এটাই প্রচলিত (MICON রেফারেন্সেও 10-16mmØ
 * প্রাধান্য পেয়েছে, কখনো 20mm+ না)। তাই smallest diameter থেকে শুরু করে
 * প্রথম যেটার spacing practical floor (PRACTICAL_MIN_SPACING_MM, ঢালাইয়ের
 * সুবিধার জন্য) আর max-spacing cap দুটোর মধ্যে পড়ে, সেটাই বেছে নেওয়া হয়।
 * খুব বেশি As লাগলে (ছোট diameter-এ spacing practical floor-এর নিচে নেমে
 * যায়) স্বয়ংক্রিয়ভাবে পরের বড় diameter-এ চলে যায়।
 */
export function layoutDistributedBars(input: DistributedBarLayoutInput): DistributedBarLayoutResult {
  const barDiameterOptionsMm = (input.barDiameterOptionsMm ?? REBAR_SIZES.map((r) => r.diameterMm))
    .slice()
    .sort((a, b) => a - b); // smallest first

  const spacingFactor =
    input.reinforcementRole === "flexural" ? MAX_FLEXURAL_SPACING_FACTOR : MAX_SHRINKAGE_SPACING_FACTOR;
  const maxAllowedSpacingMm = Math.min(spacingFactor * input.thicknessMm, MAX_SPACING_ABSOLUTE_MM);

  let chosen: { barDiameterMm: number; spacingMm: number } | null = null;

  for (const barDiameterMm of barDiameterOptionsMm) {
    const rawSpacingMm =
      input.requiredAsPerMeterMm2 > 0
        ? convertAsToBarSpacing(input.requiredAsPerMeterMm2, barDiameterMm)
        : maxAllowedSpacingMm;
    const roundedSpacingMm = Math.max(
      PRACTICAL_SPACING_INCREMENT_MM,
      Math.floor(rawSpacingMm / PRACTICAL_SPACING_INCREMENT_MM) * PRACTICAL_SPACING_INCREMENT_MM,
    );
    // practicalFloorMm-এ clear-spacing শর্ত (requiredClearSpacingMm + barDiameterMm) আর practical
    // constructability floor দুটোই অন্তর্ভুক্ত — যেটা বড়, সেটাই কার্যকর সীমা
    const requiredClearSpacingMm = minClearSpacingMm(barDiameterMm, input.maxAggregateSizeMm);
    const practicalFloorMm = Math.max(requiredClearSpacingMm + barDiameterMm, PRACTICAL_MIN_SPACING_MM);

    if (roundedSpacingMm >= practicalFloorMm && roundedSpacingMm <= maxAllowedSpacingMm) {
      chosen = { barDiameterMm, spacingMm: roundedSpacingMm };
      break; // smallest-first iteration, প্রথম valid candidate = সবচেয়ে ছোট diameter যেটার spacing দুই সীমার মধ্যে পড়ে
    }
  }

  const warnings: string[] = [];
  if (!chosen) {
    // দুই দিকে fail করতে পারে: (ক) As এত কম যে ছোট বার-এও natural spacing
    // max cap ছাড়িয়ে যায় — তখন ছোট diameter + spacing cap-এ ক্ল্যাম্প;
    // (খ) As এত বেশি যে বড় বার-এও spacing practical floor-এর নিচে নেমে
    // যায় — তখন বড় diameter নিয়ে যতটা সম্ভব চওড়া spacing (over-provide,
    // safe দিকে, কিন্তু congestion সম্পর্কে flagged)।
    const smallestDiameterMm = barDiameterOptionsMm[0] ?? 10;
    const largestDiameterMm = barDiameterOptionsMm[barDiameterOptionsMm.length - 1] ?? 10;
    const smallestRawSpacingMm =
      input.requiredAsPerMeterMm2 > 0
        ? convertAsToBarSpacing(input.requiredAsPerMeterMm2, smallestDiameterMm)
        : maxAllowedSpacingMm;
    const asTooHighForAnyDiameter = smallestRawSpacingMm < PRACTICAL_MIN_SPACING_MM;
    const fallbackDiameterMm = asTooHighForAnyDiameter ? largestDiameterMm : smallestDiameterMm;

    const rawSpacingMm =
      input.requiredAsPerMeterMm2 > 0
        ? convertAsToBarSpacing(input.requiredAsPerMeterMm2, fallbackDiameterMm)
        : maxAllowedSpacingMm;
    const fallbackSpacingMm = Math.max(
      PRACTICAL_SPACING_INCREMENT_MM,
      Math.min(
        maxAllowedSpacingMm,
        Math.floor(rawSpacingMm / PRACTICAL_SPACING_INCREMENT_MM) * PRACTICAL_SPACING_INCREMENT_MM,
      ),
    );
    chosen = { barDiameterMm: fallbackDiameterMm, spacingMm: fallbackSpacingMm };
    warnings.push(
      asTooHighForAnyDiameter
        ? `প্রয়োজনীয় As এত বেশি যে কোনো standard diameter-ই ${PRACTICAL_MIN_SPACING_MM}mm practical spacing floor-এর উপরে থাকতে পারছে না — সবচেয়ে বড় diameter (${fallbackDiameterMm}mmØ) দিয়ে সর্বোচ্চ সম্ভব spacing (${fallbackSpacingMm}mm) ব্যবহার করা হয়েছে, তবু tight হতে পারে। thickness বাড়ানো বিবেচনা করুন।`
        : `কোনো standard diameter-ই max-spacing cap (${maxAllowedSpacingMm.toFixed(0)}mm) মানছে না — সবচেয়ে ছোট diameter (${fallbackDiameterMm}mmØ) দিয়ে spacing জোর করে cap-এ বসানো হয়েছে (over-provide, safe দিকে)।`,
    );
  }

  const providedAsPerMeterMm2 = (1000 / chosen.spacingMm) * getRebarSize(chosen.barDiameterMm).areaMm2;
  const feasible = providedAsPerMeterMm2 >= input.requiredAsPerMeterMm2 && chosen.spacingMm <= maxAllowedSpacingMm;

  return {
    elementLabel: input.elementLabel,
    layout: { barDiameterMm: chosen.barDiameterMm, spacingMm: chosen.spacingMm, providedAsPerMeterMm2 },
    maxAllowedSpacingMm,
    feasible,
    warnings,
  };
}
