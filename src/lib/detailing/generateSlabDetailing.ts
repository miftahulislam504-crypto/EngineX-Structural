/**
 * Slab Detailing Generator
 * Phase 10 — RcSlabDesignReport (Phase 6c) + polygon footprint থেকে
 * two-way mesh reinforcement (bottom bars for positive moment, top
 * bars for negative moment at supports) বানায়।
 *
 * Local coordinate convention:
 *   slab-এর axis-aligned bounding box (local plane, XZ) কে ব্যবহার
 *   করা হয়েছে বার বসানোর জন্য — সাধারণ rectangular/near-rectangular
 *   panel এর জন্য এটা যথেষ্ট বাস্তবসম্মত (arbitrary polygon-এ bar
 *   clipping একটা future refinement, v1-এ bounding-box coverage)।
 *   y: bottom fiber (0) বা top fiber (thicknessMm) — mesh layer অনুযায়ী
 *
 * Bar spacing required-As-per-meter থেকে বের করা হয়: একটা নির্বাচিত
 * bar diameter দিয়ে required spacing = (barArea × 1000) / (As-per-meter)।
 */

import type { RcSlabDesignReport } from "@/lib/design/rcSlabDesign";
import { getRebarSize } from "@/lib/design/rebarSizes";
import type { DetailingResult, RebarSegment, BarScheduleRow } from "@/lib/detailing/types";
import type { Point3D } from "@/lib/types/element";

export interface SlabDetailingInput {
  elementId: string;
  elementLabel: string;
  vertices: Point3D[];
  thicknessMm: number;
  effectiveCoverMm: number;
  barDiameterMm: number; // মেশ বার diameter — ইঞ্জিনিয়ার-নির্বাচিত বা ডিফল্ট 12mm
  report: RcSlabDesignReport;
}

/** Slab polygon-এর local (planar) bounding box বের করে — vertices প্রায় coplanar ধরা হয়, XZ-dominant প্লেন অনুমান করে। */
function planarBoundingBox(vertices: Point3D[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const xs = vertices.map((v) => v.x);
  const zs = vertices.map((v) => v.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

function requiredSpacingMm(asPerMeterMm2: number, barDiameterMm: number): number {
  if (asPerMeterMm2 <= 0) return 300; // nominal max spacing fallback
  const barArea = getRebarSize(barDiameterMm).areaMm2;
  const spacing = (barArea * 1000) / asPerMeterMm2;
  return Math.max(75, Math.min(spacing, 300)); // ACI 318-19 §7.7.2.3 সাধারণ max spacing 2×thickness বা 450mm — এখানে ব্যবহারিক 300mm cap
}

export function generateSlabDetailing(input: SlabDetailingInput): DetailingResult {
  const { elementId, elementLabel, vertices, thicknessMm, effectiveCoverMm, barDiameterMm, report } = input;

  const warnings: string[] = [];
  const bbox = planarBoundingBox(vertices);
  const spanX = bbox.maxX - bbox.minX;
  const spanZ = bbox.maxZ - bbox.minZ;

  if (spanX <= 0 || spanZ <= 0) {
    warnings.push("Slab polygon bounding box অবৈধ (zero span) — detailing mesh generate করা যায়নি।");
    return {
      elementId,
      elementLabel,
      category: "slab",
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

  const bottomSpacing = requiredSpacingMm(positiveAs, barDiameterMm);
  const topSpacing = negativeAs > 0 ? requiredSpacingMm(negativeAs, barDiameterMm) : null;

  const meshBars: RebarSegment[] = [];

  function addMeshLayer(yLocal: number, spacingMm: number, layerTag: string) {
    // mesh-x: X দিকে চলা বার, Z বরাবর repeat
    const countZ = Math.max(2, Math.floor(spanZ / spacingMm) + 1);
    for (let i = 0; i < countZ; i++) {
      const z = bbox.minZ + Math.min(i * spacingMm, spanZ);
      meshBars.push({
        id: `${elementId}-${layerTag}-x-${i}`,
        startLocal: [bbox.minX, yLocal, z],
        endLocal: [bbox.maxX, yLocal, z],
        diameterMm: barDiameterMm,
        role: "mesh-x",
      });
    }
    // mesh-z: Z দিকে চলা বার, X বরাবর repeat
    const countX = Math.max(2, Math.floor(spanX / spacingMm) + 1);
    for (let i = 0; i < countX; i++) {
      const x = bbox.minX + Math.min(i * spacingMm, spanX);
      meshBars.push({
        id: `${elementId}-${layerTag}-z-${i}`,
        startLocal: [x, yLocal, bbox.minZ],
        endLocal: [x, yLocal, bbox.maxZ],
        diameterMm: barDiameterMm,
        role: "mesh-y",
      });
    }
  }

  addMeshLayer(yBottom, bottomSpacing, "bot");
  if (topSpacing !== null) addMeshLayer(yTop, topSpacing, "top");

  const schedule: BarScheduleRow[] = [];
  const bottomBars = meshBars.filter((b) => b.id.includes("-bot-"));
  if (bottomBars.length > 0) {
    const totalLen = bottomBars.reduce((sum, b) => {
      const dx = b.endLocal[0] - b.startLocal[0];
      const dz = b.endLocal[2] - b.startLocal[2];
      return sum + Math.sqrt(dx * dx + dz * dz);
    }, 0);
    schedule.push({
      barMark: `${elementLabel}-BOT-MESH`,
      diameterMm: barDiameterMm,
      count: bottomBars.length,
      shape: "straight",
      cutLengthMm: totalLen / bottomBars.length,
      totalLengthMm: totalLen,
    });
  }
  const topBars = meshBars.filter((b) => b.id.includes("-top-"));
  if (topBars.length > 0) {
    const totalLen = topBars.reduce((sum, b) => {
      const dx = b.endLocal[0] - b.startLocal[0];
      const dz = b.endLocal[2] - b.startLocal[2];
      return sum + Math.sqrt(dx * dx + dz * dz);
    }, 0);
    schedule.push({
      barMark: `${elementLabel}-TOP-MESH`,
      diameterMm: barDiameterMm,
      count: topBars.length,
      shape: "straight",
      cutLengthMm: totalLen / topBars.length,
      totalLengthMm: totalLen,
    });
  }

  return {
    elementId,
    elementLabel,
    category: "slab",
    generatedAt: new Date().toISOString(),
    sourceDesignStatus: report.overallStatus,
    longitudinalBars: [],
    transverseBars: [],
    meshBars,
    schedule,
    warnings: [...warnings, ...report.allWarnings],
  };
}
