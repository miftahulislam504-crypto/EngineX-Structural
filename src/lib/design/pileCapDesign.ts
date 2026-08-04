/**
 * Pile Cap — Flexural & Shear Design (Discrete Pile Reactions)
 * Phase 7d — Pile cap-এর উপর load একটা distributed soil pressure না
 * (isolated/combined/strip footing-এর মতো), বরং প্রতিটা pile থেকে
 * আসা discrete point reaction। তাই ACI 318-19 §13.2.7.2 অনুযায়ী,
 * moment ও shear হিসাব করার সময় শুধু critical section-এর বাইরের
 * pile গুলোর reaction যোগ করা হয় (pile centroid যদি ঠিক critical
 * section-এর উপর পড়ে, ACI অনুযায়ী পুরো reaction টাই ধরা হয় — সরল
 * রক্ষণশীল অনুমান হিসেবে, "on the line" pile-কে "outside" ধরা হয়েছে)।
 * footingFlexure.ts/footingShear.ts-এর soil-pressure-ভিত্তিক সূত্র
 * এখানে পুনঃব্যবহারযোগ্য না বলেই এই আলাদা মডিউল।
 */

import { designFlexuralReinforcement, type FlexuralDesignResult } from "@/lib/design/rcBeamFlexure";
import { checkPunchingShear, type ColumnPosition, type PunchingShearResult } from "@/lib/design/rcSlabPunchingShear";

export interface PileCapPileReaction {
  label: string;
  xM: number; // pile cap local coordinate, cap centroid থেকে
  zM: number;
  factoredReactionKN: number; // Pu, ঐ pile-এর factored reaction (pileGroupCapacity.ts এর distributePileCapLoad থেকে)
}

export interface PileCapFlexuralInput {
  piles: PileCapPileReaction[];
  columnWidthMm: number; // যে দিকে moment/shear চেক হচ্ছে তার লম্ব দিকে column dimension
  columnFaceOffsetMm: number; // cap centroid থেকে column face পর্যন্ত দূরত্ব (moment/shear direction-এ), সাধারণত columnWidthMm/2
  direction: "x" | "z"; // কোন local axis বরাবর critical section (cap-এর দুই প্রধান দিকের একটা)
}

export interface PileCapMomentResult {
  criticalSectionPositionMm: number; // column face-এ (moment/shear direction এ অবস্থান)
  momentKNm: number; // moment = Σ(reaction × distance beyond critical section) — পুরো cap width জুড়ে total moment, per-meter-strip না
  contributingPiles: string[];
  warnings: string[];
}

/**
 * Moment: column face-এ critical section ধরে, তার বাইরের pile
 * গুলোর reaction × lever-arm যোগ করা হয় (ACI §13.2.7.2 flexure critical
 * section = column face)।
 */
export function computePileCapMoment(input: PileCapFlexuralInput): PileCapMomentResult {
  const { piles, columnFaceOffsetMm, direction } = input;
  const warnings: string[] = [];

  let moment = 0;
  const contributingPiles: string[] = [];

  for (const pile of piles) {
    const positionMm = (direction === "x" ? pile.xM : pile.zM) * 1000;
    const distanceBeyondFaceMm = Math.abs(positionMm) - columnFaceOffsetMm;
    if (distanceBeyondFaceMm > 0) {
      const armM = distanceBeyondFaceMm / 1000;
      moment += pile.factoredReactionKN * armM;
      contributingPiles.push(pile.label);
    }
  }

  if (contributingPiles.length === 0) {
    warnings.push(
      "No piles fall outside the column-face critical section in this direction — moment is zero here; verify pile layout and column position."
    );
  }

  return { criticalSectionPositionMm: columnFaceOffsetMm, momentKNm: moment, contributingPiles, warnings };
}

export interface PileCapFlexuralDesignInput {
  moment: PileCapMomentResult;
  capWidthMm: number; // moment direction এর লম্ব দিকে cap dimension — বেন্ডিং strip width হিসেবে ব্যবহৃত
  thicknessMm: number;
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
}

/**
 * rcBeamFlexure.ts এর designFlexuralReinforcement পুনঃব্যবহার — bw
 * হিসেবে পুরো cap width (perpendicular direction) পাস করা হয়, কারণ
 * computePileCapMoment ইতিমধ্যে total moment দেয় (per-meter-strip না,
 * combinedFootingFlexure.ts এর longitudinal design এর মতোই প্যাটার্ন)।
 */
export function designPileCapFlexuralReinforcement(input: PileCapFlexuralDesignInput): FlexuralDesignResult {
  const { moment, capWidthMm, thicknessMm, effectiveCoverMm, fcMPa, fyMPa } = input;

  return designFlexuralReinforcement({
    factoredMomentKNm: moment.momentKNm,
    widthMm: capWidthMm,
    totalDepthMm: thicknessMm,
    effectiveCoverMm,
    fcMPa,
    fyMPa,
  });
}

export interface PileCapOneWayShearInput {
  piles: PileCapPileReaction[];
  columnWidthMm: number;
  effectiveDepthMm: number;
  direction: "x" | "z";
  capWidthMm: number; // perpendicular direction dimension — φVc হিসাবের জন্য bw
  fcMPa: number;
}

export interface PileCapOneWayShearResult {
  criticalSectionPositionMm: number; // column face + d
  factoredShearKN: number; // Vu — critical section-এর বাইরের pile reaction যোগফল
  phiVcKN: number;
  utilizationRatio: number;
  adequate: boolean;
  contributingPiles: string[];
  warnings: string[];
}

/**
 * One-way shear — critical section column face থেকে d দূরে (ACI
 * §13.2.7.2, footingShear.ts এর isolated-footing wide-beam shear-এর
 * pile-reaction সংস্করণ)। Vc = 0.17λ√f'c·bw·d সূত্র অভিন্ন, শুধু Vu
 * discrete pile reaction যোগ করে বের করা হয় (distributed pressure ×
 * area না)।
 */
export function checkPileCapOneWayShear(input: PileCapOneWayShearInput): PileCapOneWayShearResult {
  const { piles, columnWidthMm, effectiveDepthMm, direction, capWidthMm, fcMPa } = input;
  const warnings: string[] = [];
  const phi = 0.75;

  const criticalSectionPositionMm = columnWidthMm / 2 + effectiveDepthMm;

  let Vu = 0;
  const contributingPiles: string[] = [];
  for (const pile of piles) {
    const positionMm = (direction === "x" ? pile.xM : pile.zM) * 1000;
    if (Math.abs(positionMm) > criticalSectionPositionMm) {
      Vu += pile.factoredReactionKN;
      contributingPiles.push(pile.label);
    }
  }

  const VcN = 0.17 * Math.sqrt(fcMPa) * capWidthMm * effectiveDepthMm;
  const phiVc = (phi * VcN) / 1000; // N → kN

  const ratio = phiVc > 0 ? Vu / phiVc : Number.POSITIVE_INFINITY;
  const adequate = Number.isFinite(ratio) && ratio <= 1.0;

  if (!adequate) {
    warnings.push(
      `One-way shear Vu (${Vu.toFixed(1)} kN) exceeds capacity φVc (${phiVc.toFixed(1)} kN) — increase pile cap thickness.`
    );
  }

  return {
    criticalSectionPositionMm,
    factoredShearKN: Vu,
    phiVcKN: phiVc,
    utilizationRatio: ratio,
    adequate,
    contributingPiles,
    warnings,
  };
}

export interface PileCapPunchingShearInput {
  columnWidthMm: number;
  columnDepthMm: number;
  effectiveDepthMm: number;
  fcMPa: number;
  columnPosition: ColumnPosition;
  totalFactoredColumnLoadKN: number; // pile cap এর ক্ষেত্রে punching shear demand = কলাম থেকে total load (সব pile reaction-এর যোগফলের সমান, individual pile না)
}

/** Pile cap punching shear — rcSlabPunchingShear.ts এর একই ACI §22.6 সূত্র পুনঃব্যবহার। */
export function checkPileCapPunchingShear(input: PileCapPunchingShearInput): PunchingShearResult {
  return checkPunchingShear({
    columnWidthMm: input.columnWidthMm,
    columnDepthMm: input.columnDepthMm,
    slabEffectiveDepthMm: input.effectiveDepthMm,
    fcMPa: input.fcMPa,
    columnPosition: input.columnPosition,
    factoredShearKN: input.totalFactoredColumnLoadKN,
  });
}
