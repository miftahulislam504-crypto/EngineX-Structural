/**
 * Column Detailing Generator
 * Phase 10 — RcColumnDesignReport (Phase 6b) + element geometry থেকে
 * rectangular tied column-এর longitudinal bar perimeter layout + tie
 * loops বানায়।
 *
 * Local coordinate convention:
 *   y: 0 (base) → unsupportedLengthMm (top), column axis বরাবর
 *   x: -widthMm/2 → +widthMm/2
 *   z: -totalDepthMm/2 → +totalDepthMm/2
 * (Column একটা vertical LineElement — DetailingLayer এই local y-axis
 * কে element এর startPoint→endPoint ভেক্টর বরাবর align করবে।)
 */

import type { RcColumnDesignReport } from "@/lib/design/rcColumnDesign";
import type { DetailingResult, RebarSegment, RebarLoop, BarScheduleRow } from "@/lib/detailing/types";

export interface ColumnDetailingInput {
  elementId: string;
  elementLabel: string;
  unsupportedLengthMm: number;
  widthMm: number;
  totalDepthMm: number;
  coverToBarCentroidMm: number;
  longitudinalBarDiameterMm: number;
  tieDiameterMm: number;
  totalAsMm2: number; // provided (ইঞ্জিনিয়ার-নির্ধারিত, RcColumnDesignInput এর মতোই)
  tieSpacingMm: number;
  barsAlongWidth: number; // selectColumnBarArrangement থেকে (caller বের করে দেয়)
  barsAlongDepth: number;
  report: RcColumnDesignReport;
}

export function generateColumnDetailing(input: ColumnDetailingInput): DetailingResult {
  const {
    elementId,
    elementLabel,
    unsupportedLengthMm,
    widthMm,
    totalDepthMm,
    coverToBarCentroidMm,
    longitudinalBarDiameterMm,
    tieDiameterMm,
    tieSpacingMm,
    barsAlongWidth,
    barsAlongDepth,
    report,
  } = input;

  const warnings: string[] = [];
  const halfW = widthMm / 2 - coverToBarCentroidMm;
  const halfD = totalDepthMm / 2 - coverToBarCentroidMm;

  // পরিধি বরাবর বার position বসানো — ৪ কোণা + প্রতি face এ intermediate bar (barsAlongWidth/barsAlongDepth অনুযায়ী)
  const perimeterPoints: { x: number; z: number }[] = [];
  function addFacePoints(count: number, fixed: "x" | "z", fixedVal: number, varMin: number, varMax: number) {
    if (count <= 1) {
      perimeterPoints.push(fixed === "x" ? { x: fixedVal, z: varMin } : { x: varMin, z: fixedVal });
      return;
    }
    for (let i = 0; i < count; i++) {
      const t = varMin + ((varMax - varMin) * i) / (count - 1);
      perimeterPoints.push(fixed === "x" ? { x: fixedVal, z: t } : { x: t, z: fixedVal });
    }
  }

  // ৪ face: top (z=+halfD), bottom (z=-halfD) — widthMm বরাবর barsAlongWidth টা করে
  // left (x=-halfW), right (x=+halfW) — depthMm বরাবর barsAlongDepth টা করে (কোণা বার দুইবার যোগ হওয়া এড়াতে depth face থেকে intermediate পয়েন্ট বাদ)
  addFacePoints(barsAlongWidth, "z", halfD, -halfW, halfW); // top face
  addFacePoints(barsAlongWidth, "z", -halfD, -halfW, halfW); // bottom face
  const depthIntermediateCount = Math.max(0, barsAlongDepth - 2);
  if (depthIntermediateCount > 0) {
    for (let i = 1; i <= depthIntermediateCount; i++) {
      const t = -halfD + (2 * halfD * i) / (depthIntermediateCount + 1);
      perimeterPoints.push({ x: -halfW, z: t }); // left face intermediate
      perimeterPoints.push({ x: halfW, z: t }); // right face intermediate
    }
  }

  // ডুপ্লিকেট কোণা পয়েন্ট বাদ দেওয়া (tolerance সহ)
  const uniquePoints: { x: number; z: number }[] = [];
  for (const p of perimeterPoints) {
    const exists = uniquePoints.some((u) => Math.abs(u.x - p.x) < 1 && Math.abs(u.z - p.z) < 1);
    if (!exists) uniquePoints.push(p);
  }

  const longitudinalBars: RebarSegment[] = uniquePoints.map((p, i) => ({
    id: `${elementId}-long-${i}`,
    startLocal: [p.x, 0, p.z],
    endLocal: [p.x, unsupportedLengthMm, p.z],
    diameterMm: longitudinalBarDiameterMm,
    role: "longitudinal-main",
  }));

  // ------ Ties — rectangular hoop, uniform spacing পুরো height জুড়ে ------
  const safeSpacing = Math.max(tieSpacingMm, 50);
  const tieCount = Math.max(2, Math.floor(unsupportedLengthMm / safeSpacing) + 1);

  const transverseBars: RebarLoop[] = [];
  for (let i = 0; i < tieCount; i++) {
    const y = Math.min(i * safeSpacing, unsupportedLengthMm);
    transverseBars.push({
      id: `${elementId}-tie-${i}`,
      pointsLocal: [
        [-halfW, y, -halfD],
        [halfW, y, -halfD],
        [halfW, y, halfD],
        [-halfW, y, halfD],
        [-halfW, y, -halfD],
      ],
      diameterMm: tieDiameterMm,
      role: "tie",
      positionAlongAxisMm: y,
    });
  }

  if (!report.tieSpacing.adequate && report.tieSpacing.providedSpacingMm !== null) {
    warnings.push(
      `Tie spacing (${report.tieSpacing.providedSpacingMm}mm) ACI 318-19 §25.7.2.1 সীমার বেশি (max ${report.tieSpacing.maxSpacingMm.toFixed(0)}mm) — detailing এ যা প্রদান করা হয়েছে তাই দেখানো হচ্ছে, ডিজাইন সংশোধন প্রয়োজন।`
    );
  }

  const schedule: BarScheduleRow[] = [
    {
      barMark: `${elementLabel}-L1`,
      diameterMm: longitudinalBarDiameterMm,
      count: uniquePoints.length,
      shape: "straight",
      cutLengthMm: unsupportedLengthMm,
      totalLengthMm: unsupportedLengthMm * uniquePoints.length,
    },
    {
      barMark: `${elementLabel}-TIE`,
      diameterMm: tieDiameterMm,
      count: tieCount,
      shape: "tie",
      cutLengthMm: 2 * (widthMm + totalDepthMm) + 20 * tieDiameterMm,
      totalLengthMm: (2 * (widthMm + totalDepthMm) + 20 * tieDiameterMm) * tieCount,
    },
  ];

  return {
    elementId,
    elementLabel,
    category: "column",
    generatedAt: new Date().toISOString(),
    sourceDesignStatus: report.overallStatus,
    longitudinalBars,
    transverseBars,
    schedule,
    warnings: [...warnings, ...report.allWarnings],
  };
}
