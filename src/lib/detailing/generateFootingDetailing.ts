/**
 * Footing Detailing Generator
 * Phase 10 — FootingDesignReport (Phase 6e/7) থেকে বটম mesh
 * reinforcement বানায় (দুই দিকেই — flexuralDesignX/Z থেকে required
 * As, প্রতিটা দিকের designed span-এর width/length ব্যবহার করে)।
 *
 * Local coordinate convention:
 *   x: -widthMm/2 → +widthMm/2 (sizing.widthMm — X-দিকে plan dimension)
 *   z: -lengthMm/2 → +lengthMm/2 (sizing.lengthMm — Z-দিকে plan dimension)
 *   y: effectiveCoverMm (bottom mesh, footing bottom fiber থেকে cover)
 */

import type { FootingDesignReport } from "@/lib/design/footingDesign";
import { getRebarSize } from "@/lib/design/rebarSizes";
import type { DetailingResult, RebarSegment, BarScheduleRow } from "@/lib/detailing/types";

export interface FootingDetailingInput {
  elementId: string;
  elementLabel: string;
  effectiveCoverMm: number;
  barDiameterMm: number;
  report: FootingDesignReport;
}

function spacingFromAsPerMeter(asPerMeterMm2: number, barDiameterMm: number): number {
  if (asPerMeterMm2 <= 0) return 300;
  const barArea = getRebarSize(barDiameterMm).areaMm2;
  const spacing = (barArea * 1000) / asPerMeterMm2;
  return Math.max(75, Math.min(spacing, 300));
}

export function generateFootingDetailing(input: FootingDetailingInput): DetailingResult {
  const { elementId, elementLabel, effectiveCoverMm, barDiameterMm, report } = input;

  const widthMm = report.sizing.widthMm; // X-দিকে
  const lengthMm = report.sizing.lengthMm; // Z-দিকে
  const halfW = widthMm / 2;
  const halfL = lengthMm / 2;
  const yLocal = effectiveCoverMm;

  // X-direction moment (momentX) কভার করার rebar আসলে Z-দিকে চলে (X-span-এর perpendicular দিকে বেন্ডিং রেজিস্ট করতে বার সেই span বরাবর বসে)
  const spacingForXSpan = spacingFromAsPerMeter(report.flexuralDesignX.governingAsMm2, barDiameterMm);
  const spacingForZSpan = spacingFromAsPerMeter(report.flexuralDesignZ.governingAsMm2, barDiameterMm);

  const meshBars: RebarSegment[] = [];

  // বার widthMm (X) বরাবর প্রসারিত, lengthMm (Z) দিকে repeat — momentZ ডিজাইন থেকে স্পেসিং
  const countZ = Math.max(2, Math.floor(lengthMm / spacingForZSpan) + 1);
  for (let i = 0; i < countZ; i++) {
    const z = -halfL + Math.min(i * spacingForZSpan, lengthMm);
    meshBars.push({
      id: `${elementId}-x-${i}`,
      startLocal: [-halfW, yLocal, z],
      endLocal: [halfW, yLocal, z],
      diameterMm: barDiameterMm,
      role: "mesh-x",
    });
  }

  // বার lengthMm (Z) বরাবর প্রসারিত, widthMm (X) দিকে repeat — momentX ডিজাইন থেকে স্পেসিং
  const countX = Math.max(2, Math.floor(widthMm / spacingForXSpan) + 1);
  for (let i = 0; i < countX; i++) {
    const x = -halfW + Math.min(i * spacingForXSpan, widthMm);
    meshBars.push({
      id: `${elementId}-z-${i}`,
      startLocal: [x, yLocal, -halfL],
      endLocal: [x, yLocal, halfL],
      diameterMm: barDiameterMm,
      role: "mesh-y",
    });
  }

  const xBars = meshBars.filter((b) => b.id.includes("-x-"));
  const zBars = meshBars.filter((b) => b.id.includes("-z-"));

  const schedule: BarScheduleRow[] = [
    {
      barMark: `${elementLabel}-X`,
      diameterMm: barDiameterMm,
      count: xBars.length,
      shape: "straight",
      cutLengthMm: widthMm,
      totalLengthMm: widthMm * xBars.length,
    },
    {
      barMark: `${elementLabel}-Z`,
      diameterMm: barDiameterMm,
      count: zBars.length,
      shape: "straight",
      cutLengthMm: lengthMm,
      totalLengthMm: lengthMm * zBars.length,
    },
  ];

  return {
    elementId,
    elementLabel,
    category: "footing",
    generatedAt: new Date().toISOString(),
    sourceDesignStatus: report.overallStatus,
    longitudinalBars: [],
    transverseBars: [],
    meshBars,
    schedule,
    warnings: report.allWarnings,
  };
}
