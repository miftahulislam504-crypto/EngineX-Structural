/**
 * RC Column — Reinforcement Ratio & Tie Spacing
 * Phase 6b — ACI 318-19 §10.6.1.1 (longitudinal reinforcement limits)
 * ও §25.7.2 (tie/transverse reinforcement spacing, tied columns —
 * spiral column এর জন্য §25.7.3, এই v1-এ শুধু tied column সমর্থিত,
 * যা বাংলাদেশে সাধারণ RC building practice এ সবচেয়ে বেশি ব্যবহৃত)।
 */

export interface ReinforcementRatioCheckInput {
  totalAsMm2: number;
  grossAreaMm2: number; // Ag — সম্পূর্ণ concrete cross-section area (rectangular: b×h, circular: πD²/4)
}

export interface ReinforcementRatioCheckResult {
  ratio: number; // ρg = As/Ag
  minRatio: number; // ACI §10.6.1.1 — 0.01
  maxRatio: number; // ACI §10.6.1.1 — 0.08 (practically স্প্লাইস region এ 0.04 রাখার পরামর্শ দেওয়া হয়, কিন্তু কোড সীমা 0.08)
  adequate: boolean;
  warnings: string[];
}

export function checkLongitudinalReinforcementRatio(
  input: ReinforcementRatioCheckInput
): ReinforcementRatioCheckResult {
  const { totalAsMm2, grossAreaMm2 } = input;
  const warnings: string[] = [];

  const ratio = grossAreaMm2 > 0 ? totalAsMm2 / grossAreaMm2 : 0;
  const minRatio = 0.01;
  const maxRatio = 0.08;

  const adequate = ratio >= minRatio && ratio <= maxRatio;

  if (ratio < minRatio) {
    warnings.push(
      `Longitudinal reinforcement ratio ρg=${(ratio * 100).toFixed(2)}% is below the ACI 318-19 §10.6.1.1 minimum (1.0%) — add more or larger longitudinal bars.`
    );
  }
  if (ratio > maxRatio) {
    warnings.push(
      `Longitudinal reinforcement ratio ρg=${(ratio * 100).toFixed(2)}% exceeds the ACI 318-19 §10.6.1.1 maximum (8.0%) — reduce bar count/size or increase section size (congestion at splices is also a practical concern above ~4%).`
    );
  } else if (ratio > 0.04) {
    warnings.push(
      `Longitudinal reinforcement ratio ρg=${(ratio * 100).toFixed(2)}% exceeds the commonly recommended practical limit (4.0%) — bar congestion at lap splices is likely; consider a larger section.`
    );
  }

  return { ratio, minRatio, maxRatio, adequate, warnings };
}

export interface TieSpacingCheckInput {
  longitudinalBarDiameterMm: number;
  tieDiameterMm: number;
  minColumnDimensionMm: number; // rectangular: min(width, depth); circular: diameter
  providedSpacingMm?: number; // ইঞ্জিনিয়ার যদি ইতিমধ্যে spacing বেছে থাকেন
}

export interface TieSpacingCheckResult {
  maxSpacingMm: number; // ACI §25.7.2.1 — min(16×db_long, 48×db_tie, min column dimension)
  providedSpacingMm: number | null;
  adequate: boolean | null; // providedSpacingMm না দিলে null (শুধু max limit জানানো হচ্ছে)
  warnings: string[];
}

/**
 * ACI 318-19 §25.7.2.1 — tie spacing সর্বোচ্চ সীমা:
 *   min( 16×(longitudinal bar diameter), 48×(tie bar diameter), least column dimension )
 */
export function checkTieSpacing(input: TieSpacingCheckInput): TieSpacingCheckResult {
  const { longitudinalBarDiameterMm, tieDiameterMm, minColumnDimensionMm, providedSpacingMm } = input;
  const warnings: string[] = [];

  const maxSpacing = Math.min(16 * longitudinalBarDiameterMm, 48 * tieDiameterMm, minColumnDimensionMm);

  let adequate: boolean | null = null;
  if (providedSpacingMm !== undefined) {
    adequate = providedSpacingMm <= maxSpacing;
    if (!adequate) {
      warnings.push(
        `Provided tie spacing (${providedSpacingMm.toFixed(0)}mm) exceeds the ACI 318-19 §25.7.2.1 maximum (${maxSpacing.toFixed(0)}mm) — reduce spacing.`
      );
    }
  }

  return {
    maxSpacingMm: maxSpacing,
    providedSpacingMm: providedSpacingMm ?? null,
    adequate,
    warnings,
  };
}
