/**
 * Mat/Raft Foundation — Per-Column Punching Shear
 * Phase 7c — প্রতিটা কলামের নিচে punching shear চেক, rcSlabPunchingShear.ts
 * সরাসরি পুনঃব্যবহার (isolated/combined footing-এর একই প্যাটার্ন)।
 * columnPosition ("interior"/"edge"/"corner") ইঞ্জিনিয়ার নির্ধারণ করেন
 * (মাটের প্ল্যানে কলামের অবস্থান অনুযায়ী) — এই মডিউল নিজে থেকে
 * geometry থেকে অনুমান করে না (mat plan arbitrary polygon হতে পারে,
 * তাই automatic edge-detection এই v1 তে যোগ করা হয়নি)।
 */

import { checkPunchingShear, type ColumnPosition, type PunchingShearResult } from "@/lib/design/rcSlabPunchingShear";

export interface MatColumnPunchingInput {
  columnWidthMm: number;
  columnDepthMm: number;
  effectiveDepthMm: number;
  fcMPa: number;
  columnPosition: ColumnPosition;
  factoredColumnLoadKN: number;
}

export function checkMatColumnPunchingShear(input: MatColumnPunchingInput): PunchingShearResult {
  return checkPunchingShear({
    columnWidthMm: input.columnWidthMm,
    columnDepthMm: input.columnDepthMm,
    slabEffectiveDepthMm: input.effectiveDepthMm,
    fcMPa: input.fcMPa,
    columnPosition: input.columnPosition,
    factoredShearKN: input.factoredColumnLoadKN,
  });
}
