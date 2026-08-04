/**
 * Section Detail — Cross-Section Rebar Placement
 * Phase 10e — Detailing ইঞ্জিনের পঞ্চম ধাপ।
 *
 * 10a (layoutBeamBars/layoutColumnBars/layoutDistributedBars) bar
 * diameter/count/layer/spacing বের করে, কিন্তু সেগুলো abstract সংখ্যা —
 * "৩টা ১৬mmØ বার" বলে দেয়, কিন্তু কোথায় বসবে (x,y) বলে না। এই ফাইল সেই
 * abstract layout-কে section-এর ভিতরে concrete (x,y) কো-অর্ডিনেটে রূপান্তর
 * করে, যাতে MICON রেফারেন্সের "Cross Section GB-01 (A-A)"-এর মতো একটা
 * 2D/3D rendering layer আঁকতে পারে (সেই rendering স্তরটা এই ফেজে না,
 * পরের কাজ — এখানে শুধু structured geometric data)।
 *
 * কো-অর্ডিনেট কনভেনশন: origin section-এর bottom-left কোণায় (x→right,
 * y→up), unit mm। Column-এর জন্য bottom face-কে "face 0" ধরা হয়েছে,
 * ঘড়ির কাঁটার বিপরীত দিকে (counter-clockwise) face 1(right)/2(top)/
 * 3(left)।
 */

import { minClearSpacingMm, type BeamBarLayoutResult, type ColumnBarLayoutResult } from "@/lib/design/rebarLayout";

export interface BarPosition {
  xMm: number;
  yMm: number;
  diameterMm: number;
}

// ---------------------------------------------------------------------------
// একটা layer-এর বার এক row-তে সমান দূরত্বে বসানোর shared helper
// ---------------------------------------------------------------------------
function positionsInLayer(count: number, barDiameterMm: number, leftEdgeXMm: number, rightEdgeXMm: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(leftEdgeXMm + rightEdgeXMm) / 2];
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(leftEdgeXMm + (i * (rightEdgeXMm - leftEdgeXMm)) / (count - 1));
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Beam cross-section
// ---------------------------------------------------------------------------
export interface BeamSectionDetailInput {
  beamLayout: BeamBarLayoutResult;
  widthMm: number;
  totalDepthMm: number;
  clearCoverMm: number;
  stirrupDiameterMm: number;
  maxAggregateSizeMm?: number;
}

export interface BeamSectionDetail {
  elementLabel: string;
  widthMm: number;
  totalDepthMm: number;
  stirrupOutline: { xMm: number; yMm: number; widthMm: number; heightMm: number }; // stirrup rectangle, bottom-left কোণা থেকে
  tensionBars: BarPosition[]; // নিচের ফেসের কাছে (y ছোট)
  compressionBars: BarPosition[]; // উপরের ফেসের কাছে (y বড়), না থাকলে খালি array
  warnings: string[];
}

export function computeBeamSectionDetail(input: BeamSectionDetailInput): BeamSectionDetail {
  const warnings: string[] = [...input.beamLayout.warnings];
  const leftEdgeXMm = input.clearCoverMm + input.stirrupDiameterMm;
  const rightEdgeXMm = input.widthMm - leftEdgeXMm;

  function layoutBarsFromFace(group: BeamBarLayoutResult["tension"], distanceFromFaceMm: number): BarPosition[] {
    const positions: BarPosition[] = [];
    let currentYMm = distanceFromFaceMm + group.barDiameterMm / 2;
    for (const countInLayer of group.layers) {
      const xs = positionsInLayer(
        countInLayer,
        group.barDiameterMm,
        leftEdgeXMm + group.barDiameterMm / 2,
        rightEdgeXMm - group.barDiameterMm / 2,
      );
      for (const xMm of xs) {
        positions.push({ xMm, yMm: currentYMm, diameterMm: group.barDiameterMm });
      }
      const verticalSpacingMm = minClearSpacingMm(group.barDiameterMm, input.maxAggregateSizeMm) + group.barDiameterMm;
      currentYMm += verticalSpacingMm;
    }
    return positions;
  }

  const tensionBars = layoutBarsFromFace(input.beamLayout.tension, input.clearCoverMm + input.stirrupDiameterMm);
  const compressionBarsRaw = input.beamLayout.compression
    ? layoutBarsFromFace(input.beamLayout.compression, input.clearCoverMm + input.stirrupDiameterMm)
    : [];
  // compression বার উপরের ফেস থেকে গণনা করা হয়েছিল (distance-from-face y), সেটাকে top-থেকে-নিচে flip করে section-এর গ্লোবাল y-তে বসানো হলো
  const compressionBars = compressionBarsRaw.map((p) => ({ ...p, yMm: input.totalDepthMm - p.yMm }));

  if (compressionBars.length > 0 && tensionBars.length > 0) {
    const minGapMm = Math.min(...compressionBars.map((c) => c.yMm)) - Math.max(...tensionBars.map((t) => t.yMm));
    if (minGapMm < input.stirrupDiameterMm) {
      warnings.push(
        `Tension আর compression bar layer একে অপরের খুব কাছাকাছি (gap ${minGapMm.toFixed(0)}mm) — beam depth পুনর্বিবেচনা করুন।`,
      );
    }
  }

  return {
    elementLabel: input.beamLayout.elementLabel,
    widthMm: input.widthMm,
    totalDepthMm: input.totalDepthMm,
    stirrupOutline: {
      xMm: input.clearCoverMm,
      yMm: input.clearCoverMm,
      widthMm: input.widthMm - 2 * input.clearCoverMm,
      heightMm: input.totalDepthMm - 2 * input.clearCoverMm,
    },
    tensionBars,
    compressionBars,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Column cross-section — perimeter বার-কে (x,y)-তে রূপান্তর
// ---------------------------------------------------------------------------
export interface ColumnSectionDetailInput {
  columnLayout: ColumnBarLayoutResult;
  widthMm: number; // b (x-অক্ষ)
  totalDepthMm: number; // h (y-অক্ষ)
  clearCoverMm: number;
  tieDiameterMm: number;
}

export interface ColumnSectionDetail {
  elementLabel: string;
  widthMm: number;
  totalDepthMm: number;
  tieOutline: { xMm: number; yMm: number; widthMm: number; heightMm: number };
  bars: BarPosition[]; // ৪ কোণা + প্রতি face-এর extra বার, পুরো perimeter জুড়ে
  warnings: string[];
}

export function computeColumnSectionDetail(input: ColumnSectionDetailInput): ColumnSectionDetail {
  const { columnLayout } = input;
  const db = columnLayout.barDiameterMm;
  const insetMm = input.clearCoverMm + input.tieDiameterMm + db / 2;

  const xMin = insetMm;
  const xMax = input.widthMm - insetMm;
  const yMin = insetMm;
  const yMax = input.totalDepthMm - insetMm;

  const bars: BarPosition[] = [
    { xMm: xMin, yMm: yMin, diameterMm: db }, // corner: bottom-left
    { xMm: xMax, yMm: yMin, diameterMm: db }, // bottom-right
    { xMm: xMax, yMm: yMax, diameterMm: db }, // top-right
    { xMm: xMin, yMm: yMax, diameterMm: db }, // top-left
  ];

  // faceBarCountEachFace = [width face ১ (bottom), depth face ১ (right), width face ২ (top), depth face ২ (left)]
  const [bottomExtra, rightExtra, topExtra, leftExtra] = columnLayout.faceBarCountEachFace;

  function distributeAlongFace(countBetweenCorners: number, fromX: number, fromY: number, toX: number, toY: number) {
    for (let i = 1; i <= countBetweenCorners; i++) {
      const t = i / (countBetweenCorners + 1); // কোণার বার বাদ দিয়ে সমান ব্যবধানে বসানো
      bars.push({ xMm: fromX + t * (toX - fromX), yMm: fromY + t * (toY - fromY), diameterMm: db });
    }
  }

  distributeAlongFace(bottomExtra, xMin, yMin, xMax, yMin); // bottom face: bottom-left → bottom-right
  distributeAlongFace(rightExtra, xMax, yMin, xMax, yMax); // right face: bottom-right → top-right
  distributeAlongFace(topExtra, xMax, yMax, xMin, yMax); // top face: top-right → top-left
  distributeAlongFace(leftExtra, xMin, yMax, xMin, yMin); // left face: top-left → bottom-left

  return {
    elementLabel: columnLayout.elementLabel,
    widthMm: input.widthMm,
    totalDepthMm: input.totalDepthMm,
    tieOutline: {
      xMm: input.clearCoverMm,
      yMm: input.clearCoverMm,
      widthMm: input.widthMm - 2 * input.clearCoverMm,
      heightMm: input.totalDepthMm - 2 * input.clearCoverMm,
    },
    bars,
    warnings: [...columnLayout.warnings],
  };
}

// ---------------------------------------------------------------------------
// Footing vertical section — top/bottom mesh + column stub
// ---------------------------------------------------------------------------
export interface FootingSectionDetailInput {
  elementLabel: string;
  footingWidthMm: number; // section-এর প্রস্থ (plan dimension, এক দিক)
  footingThicknessMm: number;
  clearCoverMm: number;
  columnWidthMm: number; // section-এ দৃশ্যমান column stub-এর প্রস্থ, কেন্দ্রে বসানো
  bottomBarDiameterMm: number;
  bottomBarSpacingMm: number; // 10a-এর layoutDistributedBars() থেকে
  topBarDiameterMm?: number;
  topBarSpacingMm?: number;
}

export interface FootingSectionDetail {
  elementLabel: string;
  footingWidthMm: number;
  footingThicknessMm: number;
  columnOutline: { xMm: number; widthMm: number };
  bottomBars: BarPosition[];
  topBars: BarPosition[];
  warnings: string[];
}

export function computeFootingSectionDetail(input: FootingSectionDetailInput): FootingSectionDetail {
  const warnings: string[] = [];

  function barXPositions(barDiameterMm: number, spacingMm: number): number[] {
    if (spacingMm <= 0) return [];
    const usableWidthMm = input.footingWidthMm - 2 * (input.clearCoverMm + barDiameterMm / 2);
    if (usableWidthMm <= 0) {
      warnings.push("Footing width cover-এর তুলনায় খুব ছোট — bar position বসানো যায়নি।");
      return [];
    }
    const count = Math.floor(usableWidthMm / spacingMm) + 1;
    const startXMm = input.clearCoverMm + barDiameterMm / 2;
    const positions: number[] = [];
    for (let i = 0; i < count; i++) {
      positions.push(startXMm + i * spacingMm);
    }
    return positions;
  }

  const bottomYMm = input.clearCoverMm + input.bottomBarDiameterMm / 2;
  const bottomBars: BarPosition[] = barXPositions(input.bottomBarDiameterMm, input.bottomBarSpacingMm).map((xMm) => ({
    xMm,
    yMm: bottomYMm,
    diameterMm: input.bottomBarDiameterMm,
  }));

  let topBars: BarPosition[] = [];
  if (input.topBarDiameterMm && input.topBarSpacingMm) {
    const topYMm = input.footingThicknessMm - input.clearCoverMm - input.topBarDiameterMm / 2;
    topBars = barXPositions(input.topBarDiameterMm, input.topBarSpacingMm).map((xMm) => ({
      xMm,
      yMm: topYMm,
      diameterMm: input.topBarDiameterMm as number,
    }));
  }

  return {
    elementLabel: input.elementLabel,
    footingWidthMm: input.footingWidthMm,
    footingThicknessMm: input.footingThicknessMm,
    columnOutline: { xMm: (input.footingWidthMm - input.columnWidthMm) / 2, widthMm: input.columnWidthMm },
    bottomBars,
    topBars,
    warnings,
  };
}
