/**
 * Wall Detailing Generator
 * Phase 10 — RcWallDesignReport (Phase 6d) থেকে vertical + horizontal
 * double-curtain mesh বানায় (shear wall/core wall/regular wall সবার
 * জন্য একই প্যাটার্ন — শুধু minimum ratio ভিন্ন হতে পারে ভবিষ্যতে)।
 *
 * Local coordinate convention:
 *   x: 0 → lengthMm (wall-এর horizontal length, in-plane)
 *   y: 0 (base) → heightMm (vertical)
 *   z: -thicknessMm/2 → +thicknessMm/2 (দুই curtain, front/back face)
 */

import type { RcWallDesignReport } from "@/lib/design/rcWallDesign";
import { getRebarSize } from "@/lib/design/rebarSizes";
import type { DetailingResult, RebarSegment, BarScheduleRow } from "@/lib/detailing/types";

export interface WallDetailingInput {
  elementId: string;
  elementLabel: string;
  lengthMm: number;
  heightMm: number;
  thicknessMm: number;
  barDiameterMm: number;
  report: RcWallDesignReport;
}

function spacingFromRatio(ratioMinAsPerMeter: number, barDiameterMm: number, thicknessMm: number): number {
  const barArea = getRebarSize(barDiameterMm).areaMm2;
  // ratio ইতিমধ্যে "per meter width" As হিসেবে দেওয়া থাকে (minVerticalAsPerMeterMm2/minHorizontalAsPerMeterMm2)
  if (ratioMinAsPerMeter <= 0) return 300;
  const spacing = (barArea * 1000) / ratioMinAsPerMeter;
  return Math.max(100, Math.min(spacing, Math.min(3 * thicknessMm, 450)));
}

export function generateWallDetailing(input: WallDetailingInput): DetailingResult {
  const { elementId, elementLabel, lengthMm, heightMm, thicknessMm, barDiameterMm, report } = input;

  const warnings: string[] = [];
  const verticalSpacing = spacingFromRatio(report.minReinforcement.minVerticalAsPerMeterMm2, barDiameterMm, thicknessMm);
  const horizontalSpacing = spacingFromRatio(
    report.minReinforcement.minHorizontalAsPerMeterMm2,
    barDiameterMm,
    thicknessMm
  );

  const meshBars: RebarSegment[] = [];
  const zFront = thicknessMm / 2 - 25; // curtain positioned near each face, mm cover হিসেবে ২৫mm আনুমানিক
  const zBack = -thicknessMm / 2 + 25;

  function addCurtain(zLocal: number, tag: string) {
    // Vertical bars — height বরাবর, length-এ repeat
    const countAlongLength = Math.max(2, Math.floor(lengthMm / verticalSpacing) + 1);
    for (let i = 0; i < countAlongLength; i++) {
      const x = Math.min(i * verticalSpacing, lengthMm);
      meshBars.push({
        id: `${elementId}-${tag}-vert-${i}`,
        startLocal: [x, 0, zLocal],
        endLocal: [x, heightMm, zLocal],
        diameterMm: barDiameterMm,
        role: "mesh-y",
      });
    }
    // Horizontal bars — length বরাবর, height-এ repeat
    const countAlongHeight = Math.max(2, Math.floor(heightMm / horizontalSpacing) + 1);
    for (let i = 0; i < countAlongHeight; i++) {
      const y = Math.min(i * horizontalSpacing, heightMm);
      meshBars.push({
        id: `${elementId}-${tag}-horiz-${i}`,
        startLocal: [0, y, zLocal],
        endLocal: [lengthMm, y, zLocal],
        diameterMm: barDiameterMm,
        role: "mesh-x",
      });
    }
  }

  addCurtain(zFront, "f");
  addCurtain(zBack, "b");

  const verticalBars = meshBars.filter((b) => b.id.includes("-vert-"));
  const horizontalBars = meshBars.filter((b) => b.id.includes("-horiz-"));

  const schedule: BarScheduleRow[] = [];
  if (verticalBars.length > 0) {
    schedule.push({
      barMark: `${elementLabel}-VERT`,
      diameterMm: barDiameterMm,
      count: verticalBars.length,
      shape: "straight",
      cutLengthMm: heightMm,
      totalLengthMm: heightMm * verticalBars.length,
    });
  }
  if (horizontalBars.length > 0) {
    schedule.push({
      barMark: `${elementLabel}-HORIZ`,
      diameterMm: barDiameterMm,
      count: horizontalBars.length,
      shape: "straight",
      cutLengthMm: lengthMm,
      totalLengthMm: lengthMm * horizontalBars.length,
    });
  }

  if (report.shearCapacity && !report.shearCapacity.adequate) {
    warnings.push("In-plane shear capacity অপর্যাপ্ত — detailing এ শুধু minimum reinforcement mesh দেখানো হয়েছে, boundary element/special reinforcement এই v1-এ মডেল করা হয়নি।");
  }

  return {
    elementId,
    elementLabel,
    category: "wall",
    generatedAt: new Date().toISOString(),
    sourceDesignStatus: report.overallStatus,
    longitudinalBars: [],
    transverseBars: [],
    meshBars,
    schedule,
    warnings: [...warnings, ...report.allWarnings],
  };
}
