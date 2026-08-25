/**
 * Stair (Waist Slab) Detailing Generator — Stair implementation
 * gap-closing pass (২০২৬-০৮)
 * ------------------------------------------------------------------
 * generateSlabDetailing.ts (Phase 10) reuse করা যায়নি সরাসরি — সেই
 * ফাইলের নিজস্ব ডকব্লকেই বলা আছে planarBoundingBoxMm() একটা "XZ-dominant
 * প্লেন অনুমান করে" (two-way mesh, flat horizontal slab)। Stair
 * waist-slab দুই দিক থেকেই আলাদা:
 *   (1) One-way, না two-way — main reinforcement slope বরাবর (flexural,
 *       stairDesign.ts এর moment থেকে), distribution/shrinkage steel
 *       তার লম্ব দিকে (width বরাবর) — RcSlabDesign-এর two-way mesh
 *       generateSlabDetailing() ভুল হবে এখানে সরাসরি ব্যবহার করলে।
 *   (2) Inclined plane, XZ-flat না — waist slab-এর vertices bottom
 *       edge/top edge আলাদা elevation-এ (element.ts এর StairElement
 *       কমেন্ট), তাই planarBoundingBoxMm() এর XZ-bounding-box পদ্ধতি
 *       ভুল local grid দেবে। এখানে stairGeometry.ts এর
 *       deriveStairFlightGeometry() থেকে flight-এর নিজস্ব (slope,
 *       width) local coordinate system ব্যবহার করা হয়েছে — bar
 *       geometry local space এ (slopeLengthMm বরাবর 0→L, widthMm
 *       বরাবর 0→W, thicknessMm বরাবর 0→t) — types.ts এর "local
 *       coordinates" কনভেনশন অনুযায়ী (viewport render করার সময় local→
 *       world transform আলাদা, এখানে না — Beam/Column detailing এর
 *       ঠিক একই split-of-concerns)।
 *
 * main bar (flexural) — slope বরাবর, bottom fiber এ (positive moment)
 * এবং top fiber এ সাপোর্টে (negative moment, continuous হলে) —
 * stairDesign.ts এর StairDesignReport.flexuralDesign থেকে সরাসরি As,
 * requiredSpacingMm() generateSlabDetailing.ts থেকেই পুনর্ব্যবহার করা
 * যেত কিন্তু ছোট বলে (কোনো state/side-effect নেই) এখানে আলাদা কপি
 * রাখা হলো ফাইল-লেভেল dependency কম রাখতে।
 *
 * distribution bar — width বরাবর, minReinforcement.minAsPerMeterMm2
 * থেকে (BNBC/ACI shrinkage-temperature reinforcement, stairDesign.ts
 * এ ইতিমধ্যে হিসাব করা)।
 */

import type { StairDesignReport } from "@/lib/design/stairDesign";
import { getRebarSize } from "@/lib/design/rebarSizes";
import type { DetailingResult, RebarSegment, BarScheduleRow } from "@/lib/detailing/types";

export interface StairDetailingInput {
  elementId: string;
  elementLabel: string;
  slopeLengthM: number;
  widthM: number;
  thicknessMm: number;
  effectiveCoverMm: number;
  mainBarDiameterMm: number; // slope বরাবর flexural bar
  distributionBarDiameterMm: number; // width বরাবর shrinkage/temperature bar
  report: StairDesignReport;
}

function requiredSpacingMm(asPerMeterMm2: number, barDiameterMm: number): number {
  if (asPerMeterMm2 <= 0) return 300;
  const barArea = getRebarSize(barDiameterMm).areaMm2;
  const spacing = (barArea * 1000) / asPerMeterMm2;
  return Math.max(75, Math.min(spacing, 300)); // generateSlabDetailing.ts এর ঠিক একই ACI 318-19 §7.7.2.3 ব্যবহারিক cap
}

export function generateStairDetailing(input: StairDetailingInput): DetailingResult {
  const {
    elementId,
    elementLabel,
    slopeLengthM,
    widthM,
    thicknessMm,
    effectiveCoverMm,
    mainBarDiameterMm,
    distributionBarDiameterMm,
    report,
  } = input;

  const warnings: string[] = [];
  const slopeLengthMm = slopeLengthM * 1000;
  const widthMm = widthM * 1000;

  if (slopeLengthMm <= 0 || widthMm <= 0) {
    warnings.push("Slope length বা width শূন্য/অবৈধ — stair detailing generate করা যায়নি।");
    return {
      elementId,
      elementLabel,
      category: "stair",
      generatedAt: new Date().toISOString(),
      sourceDesignStatus: report.overallStatus,
      longitudinalBars: [],
      transverseBars: [],
      meshBars: [],
      schedule: [],
      warnings,
    };
  }

  const yBottom = effectiveCoverMm;
  const yTop = Math.max(thicknessMm - effectiveCoverMm, yBottom + 10);

  const positiveAs = report.flexuralDesign.positiveDesign.governingAsMm2;
  const negativeAs = report.flexuralDesign.negativeDesign?.governingAsMm2 ?? 0;
  const distributionAs = report.minReinforcement.minAsPerMeterMm2;

  const mainBottomSpacing = requiredSpacingMm(positiveAs, mainBarDiameterMm);
  const mainTopSpacing = negativeAs > 0 ? requiredSpacingMm(negativeAs, mainBarDiameterMm) : null;
  const distributionSpacing = requiredSpacingMm(distributionAs, distributionBarDiameterMm);

  const bars: RebarSegment[] = [];

  // main bar — local x: slope (0→slopeLengthMm), local z: width (0→widthMm),
  // local y: thickness (0→thicknessMm)। প্রতিটা main bar পুরো width জুড়ে
  // repeat হয় (distribution bar-এর direction-এ), ঠিক generateSlabDetailing.ts
  // এর mesh-x এর মতোই — শুধু এখানে "x" মানে slope, ওখানে global X।
  function addMainLayer(yLocal: number, spacingMm: number, layerTag: string) {
    const count = Math.max(2, Math.floor(widthMm / spacingMm) + 1);
    for (let i = 0; i < count; i++) {
      const z = Math.min(i * spacingMm, widthMm);
      bars.push({
        id: `${elementId}-main-${layerTag}-${i}`,
        startLocal: [0, yLocal, z],
        endLocal: [slopeLengthMm, yLocal, z],
        diameterMm: mainBarDiameterMm,
        role: layerTag === "bot" ? "longitudinal-bottom" : "longitudinal-top",
      });
    }
  }

  // distribution bar — slope বরাবর repeat, width জুড়ে বিছানো (main bar-এর লম্ব)
  function addDistributionLayer(yLocal: number, spacingMm: number) {
    const count = Math.max(2, Math.floor(slopeLengthMm / spacingMm) + 1);
    for (let i = 0; i < count; i++) {
      const x = Math.min(i * spacingMm, slopeLengthMm);
      bars.push({
        id: `${elementId}-dist-${i}`,
        startLocal: [x, yLocal, 0],
        endLocal: [x, yLocal, widthMm],
        diameterMm: distributionBarDiameterMm,
        role: "mesh-y",
      });
    }
  }

  addMainLayer(yBottom, mainBottomSpacing, "bot");
  if (mainTopSpacing !== null) addMainLayer(yTop, mainTopSpacing, "top");
  addDistributionLayer(yBottom, distributionSpacing);

  const schedule: BarScheduleRow[] = [];

  function scheduleRow(mark: string, filterFn: (b: RebarSegment) => boolean, diameterMm: number): void {
    const matched = bars.filter(filterFn);
    if (matched.length === 0) return;
    const totalLen = matched.reduce((sum, b) => {
      const dx = b.endLocal[0] - b.startLocal[0];
      const dz = b.endLocal[2] - b.startLocal[2];
      return sum + Math.sqrt(dx * dx + dz * dz);
    }, 0);
    schedule.push({
      barMark: mark,
      diameterMm,
      count: matched.length,
      shape: "straight",
      cutLengthMm: totalLen / matched.length,
      totalLengthMm: totalLen,
    });
  }

  scheduleRow(`${elementLabel}-MAIN-BOT`, (b) => b.id.includes("-main-bot-"), mainBarDiameterMm);
  if (mainTopSpacing !== null) {
    scheduleRow(`${elementLabel}-MAIN-TOP`, (b) => b.id.includes("-main-top-"), mainBarDiameterMm);
  }
  scheduleRow(`${elementLabel}-DIST`, (b) => b.id.includes("-dist-"), distributionBarDiameterMm);

  return {
    elementId,
    elementLabel,
    category: "stair",
    generatedAt: new Date().toISOString(),
    sourceDesignStatus: report.overallStatus,
    longitudinalBars: bars,
    transverseBars: [],
    meshBars: [],
    schedule,
    warnings: [...warnings, ...report.allWarnings],
  };
}
