/**
 * Pile Group — Group Efficiency & Rigid-Cap Load Distribution
 * Phase 7d — pile group-এ ব্যক্তিগত pile capacity (Phase 6e এর
 * pileCapacity.ts থেকে) গ্রুপ efficiency দ্বারা reduce করা হয়
 * (কাছাকাছি pile গুলো একে অপরের skin friction zone-এ overlap করে,
 * তাই n × single-pile-capacity এর চেয়ে গ্রুপ capacity কম) —
 * Converse-Labarre সমীকরণ ব্যবহার করা হয়েছে (cohesive soil-এ ব্যাপকভাবে
 * ব্যবহৃত একটা classical, conservative approximation)। তারপর pile
 * cap-কে rigid ধরে (Phase 7c mat foundation-এর একই rigid-method
 * অনুমান), প্রতিটা pile-এর reaction P/n ± Mx·y/Σy² ± Mz·x/Σx² সূত্রে
 * বের করা হয়।
 */

export interface PileGroupGeometryInput {
  pileDiameterOrWidthMm: number;
  pileSpacingCenterToCenterMm: number; // uniform grid spacing ধরা হয়েছে (rows ও columns উভয় দিকে একই)
  numberOfRows: number;
  numberOfColumns: number;
}

export interface PileGroupEfficiencyResult {
  numberOfPiles: number;
  efficiencyFactor: number; // Converse-Labarre η, 0-1
  warnings: string[];
}

/**
 * Converse-Labarre: η = 1 - θ×[(n-1)m + (m-1)n] / (90×m×n)
 * θ (degrees) = arctan(d/s), d = pile diameter, s = center-to-center
 * spacing, m = rows, n = columns।
 */
export function computePileGroupEfficiency(input: PileGroupGeometryInput): PileGroupEfficiencyResult {
  const { pileDiameterOrWidthMm, pileSpacingCenterToCenterMm, numberOfRows, numberOfColumns } = input;
  const warnings: string[] = [];

  const numberOfPiles = numberOfRows * numberOfColumns;

  if (numberOfPiles <= 0 || pileSpacingCenterToCenterMm <= 0) {
    warnings.push("Pile group must have at least one row/column and a positive spacing.");
    return { numberOfPiles, efficiencyFactor: 0, warnings };
  }

  const thetaDeg = (Math.atan(pileDiameterOrWidthMm / pileSpacingCenterToCenterMm) * 180) / Math.PI;
  const m = numberOfRows;
  const n = numberOfColumns;

  let efficiency = 1;
  if (m > 1 || n > 1) {
    efficiency = 1 - (thetaDeg * ((n - 1) * m + (m - 1) * n)) / (90 * m * n);
  }

  if (efficiency < 0.6) {
    warnings.push(
      `Group efficiency (${(efficiency * 100).toFixed(0)}%) is quite low — piles may be spaced too closely; consider increasing spacing (typical minimum is 2.5-3 pile diameters center-to-center).`
    );
  }

  const spacingToDiameterRatio = pileSpacingCenterToCenterMm / pileDiameterOrWidthMm;
  if (spacingToDiameterRatio < 2.5) {
    warnings.push(
      `Spacing-to-diameter ratio (${spacingToDiameterRatio.toFixed(1)}) is below the typical minimum of 2.5-3.0 — verify against the geotechnical report and applicable code minimum spacing requirement.`
    );
  }

  return { numberOfPiles, efficiencyFactor: Math.max(0, efficiency), warnings };
}

export interface PilePosition {
  label: string;
  xM: number; // pile cap local coordinate (plan), pile group centroid থেকে না — cap-এর কোনো reference origin থেকে, caller consistent রাখবে
  zM: number;
}

export interface PileCapLoadDistributionInput {
  piles: PilePosition[];
  totalFactoredLoadKN: number; // Pu, cap-এর উপর কলাম থেকে আসা মোট axial load
  momentXKNm?: number; // cap centroid এর সাপেক্ষে, X-axis সম্পর্কে (Z-দিকের eccentricity থেকে)
  momentZKNm?: number; // Z-axis সম্পর্কে (X-দিকের eccentricity থেকে)
}

export interface PileReactionResult {
  label: string;
  reactionKN: number;
}

export interface PileCapLoadDistributionResult {
  centroidXM: number;
  centroidZM: number;
  perPileReaction: PileReactionResult[];
  maxReactionKN: number;
  minReactionKN: number;
  isUplift: boolean; // minReaction < 0 হলে (rigid-cap linear-reaction মডেল ভেঙে যায় — কোনো pile tension এ, যা সাধারণত pile-এর জন্য avoid করা হয়)
  warnings: string[];
}

/**
 * Rigid pile-cap সূত্র: R_i = P/n ± Mx·z_i/Σz² ± Mz·x_i/Σx²
 * (moment of inertia of pile group about its own centroid, প্রতিটা
 * pile কে point ধরে — distributed pile cross-section area না)।
 */
export function distributePileCapLoad(input: PileCapLoadDistributionInput): PileCapLoadDistributionResult {
  const { piles, totalFactoredLoadKN, momentXKNm = 0, momentZKNm = 0 } = input;
  const warnings: string[] = [];

  if (piles.length === 0) {
    warnings.push("Pile group must contain at least one pile.");
    return {
      centroidXM: 0,
      centroidZM: 0,
      perPileReaction: [],
      maxReactionKN: 0,
      minReactionKN: 0,
      isUplift: false,
      warnings,
    };
  }

  const centroidX = piles.reduce((sum, p) => sum + p.xM, 0) / piles.length;
  const centroidZ = piles.reduce((sum, p) => sum + p.zM, 0) / piles.length;

  const sumX2 = piles.reduce((sum, p) => sum + (p.xM - centroidX) ** 2, 0);
  const sumZ2 = piles.reduce((sum, p) => sum + (p.zM - centroidZ) ** 2, 0);

  const n = piles.length;
  const perPileReaction: PileReactionResult[] = piles.map((p) => {
    const dx = p.xM - centroidX;
    const dz = p.zM - centroidZ;
    const reaction =
      totalFactoredLoadKN / n +
      (sumZ2 > 0 ? (momentXKNm * dz) / sumZ2 : 0) +
      (sumX2 > 0 ? (momentZKNm * dx) / sumX2 : 0);
    return { label: p.label, reactionKN: reaction };
  });

  const maxReaction = Math.max(...perPileReaction.map((p) => p.reactionKN));
  const minReaction = Math.min(...perPileReaction.map((p) => p.reactionKN));
  const isUplift = minReaction < 0;

  if (isUplift) {
    warnings.push(
      "One or more piles show a negative (uplift/tension) reaction under the rigid-cap distribution — verify the piles can resist tension (tension piles/anchorage), or re-arrange the group to reduce eccentricity."
    );
  }

  return {
    centroidXM: centroidX,
    centroidZM: centroidZ,
    perPileReaction,
    maxReactionKN: maxReaction,
    minReactionKN: minReaction,
    isUplift,
    warnings,
  };
}
