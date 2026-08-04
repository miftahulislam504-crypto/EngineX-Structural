/**
 * Pile — Axial Capacity (Simplified Static Formula)
 * Phase 6e — সরলীকৃত static formula (α-method এর মতো, cohesive soil
 * এ skin friction, bearing capacity factor দিয়ে end bearing)।
 *
 * এটা একটা geotechnical calculation না rigorous অর্থে — বাস্তব pile
 * design এ soil boring log, SPT N-value, বা CPT ডেটা থেকে geotechnical
 * ইঞ্জিনিয়ার ultimate capacity নির্ধারণ করেন। এই মডিউল preliminary
 * structural-side sizing এর জন্য, যেখানে ইঞ্জিনিয়ার ইতিমধ্যে geotech
 * রিপোর্ট থেকে unit skin friction (fs) ও end bearing pressure (qp)
 * সরবরাহ করেন — এই app কোনো soil investigation করে না।
 */

export type PileShape = "circular" | "square";

export interface PileCapacityInput {
  shape: PileShape;
  diameterOrWidthMm: number; // circular হলে diameter, square হলে side dimension
  embeddedLengthMm: number; // pile এর মাটির ভেতরে থাকা length
  unitSkinFrictionKPa: number; // fs — geotechnical report থেকে (average, uniform soil ধরে — layered soil হলে ইঞ্জিনিয়ার একটা weighted average দেবেন)
  endBearingPressureKPa: number; // qp — pile tip এ allowable/ultimate bearing (geotechnical report থেকে)
  factorOfSafety?: number; // ডিফল্ট 2.5 (static formula তে প্রচলিত FS, allowable capacity বের করতে)
}

export interface PileCapacityResult {
  perimeterMm: number;
  crossSectionAreaMm2: number;
  skinFrictionCapacityKN: number; // Qs = fs × perimeter × embedded length
  endBearingCapacityKN: number; // Qp = qp × cross-section area
  ultimateCapacityKN: number; // Qu = Qs + Qp
  allowableCapacityKN: number; // Qa = Qu / FS
  warnings: string[];
}

export function computePileAxialCapacity(input: PileCapacityInput): PileCapacityResult {
  const { shape, diameterOrWidthMm, embeddedLengthMm, unitSkinFrictionKPa, endBearingPressureKPa, factorOfSafety } =
    input;
  const warnings: string[] = [];
  const FS = factorOfSafety ?? 2.5;

  let perimeter: number;
  let area: number;
  if (shape === "circular") {
    perimeter = Math.PI * diameterOrWidthMm;
    area = (Math.PI / 4) * diameterOrWidthMm ** 2;
  } else {
    perimeter = 4 * diameterOrWidthMm;
    area = diameterOrWidthMm ** 2;
  }

  const perimeterM = perimeter / 1000;
  const embeddedLengthM = embeddedLengthMm / 1000;
  const areaM2 = area / 1e6;

  const Qs = unitSkinFrictionKPa * perimeterM * embeddedLengthM;
  const Qp = endBearingPressureKPa * areaM2;
  const Qu = Qs + Qp;
  const Qa = Qu / FS;

  if (FS < 2.0) {
    warnings.push(
      `Factor of safety (${FS.toFixed(1)}) is below the commonly used minimum of 2.0 for static pile formulas — confirm this is acceptable per the geotechnical report.`
    );
  }

  return {
    perimeterMm: perimeter,
    crossSectionAreaMm2: area,
    skinFrictionCapacityKN: Qs,
    endBearingCapacityKN: Qp,
    ultimateCapacityKN: Qu,
    allowableCapacityKN: Qa,
    warnings,
  };
}

export interface PileAdequacyResult {
  allowableCapacityKN: number;
  utilizationRatio: number;
  adequate: boolean;
  warnings: string[];
}

export function checkPileAdequacy(
  servicePointLoadKN: number,
  capacity: PileCapacityResult
): PileAdequacyResult {
  const warnings = [...capacity.warnings];
  const load = Math.abs(servicePointLoadKN);
  const ratio = capacity.allowableCapacityKN > 0 ? load / capacity.allowableCapacityKN : Number.POSITIVE_INFINITY;
  const adequate = Number.isFinite(ratio) && ratio <= 1.0;

  if (!adequate) {
    warnings.push(
      `Service load (${load.toFixed(1)} kN) exceeds allowable pile capacity (${capacity.allowableCapacityKN.toFixed(1)} kN) — increase pile diameter, length, or use multiple piles (pile group).`
    );
  }

  return { allowableCapacityKN: capacity.allowableCapacityKN, utilizationRatio: ratio, adequate, warnings };
}
