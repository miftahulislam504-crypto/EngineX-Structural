/**
 * Bolted Shear Connection Design
 * Phase 6g — AISC 360-16 §J3 (Bolts and Threaded Parts)। একটা
 * সরলীকৃত group check — সব bolt সমান ভাগে shear নেয় (elastic/simple
 * uniform distribution, eccentric-connection instant-center পদ্ধতি
 * এই v1-এ নেই — সেটা concentric shear connection এর জন্য standard
 * conservative অনুমান, কিন্তু বড় eccentricity সহ bracket connection
 * এ rigorous না)।
 *
 * চেক করা তিনটা limit state:
 *   1. Bolt shear rupture (§J3.6)
 *   2. Bolt bearing on connected material (§J3.10)
 *   3. Bolt tearout on connected material (§J3.10)
 * Block shear (§J4.3) এই v1-এ নেই (একটা পরের রিফাইনমেন্ট — plate/
 * beam-web geometry-নির্ভর জটিলতর চেক)।
 */

import { BOLT_PROPERTIES, boltAreaMm2, type BoltGrade } from "@/lib/design/boltProperties";

export interface BoltedShearConnectionInput {
  boltGrade: BoltGrade;
  boltDiameterMm: number;
  numberOfBolts: number;
  numberOfShearPlanes: 1 | 2; // single shear (1) বা double shear (2, splice plate উভয়পাশে)
  plateThicknessMm: number; // সংযুক্ত material এর thinnest ply (governing, bearing/tearout এর জন্য)
  plateFuMPa: number; // সংযুক্ত material এর ultimate tensile strength
  edgeDistanceMm: number; // bolt center থেকে plate edge পর্যন্ত (tearout এর জন্য critical, load-direction বরাবর)
  boltSpacingMm: number; // consecutive bolt-দের মধ্যে center-to-center spacing (একাধিক bolt থাকলে, তারো tearout প্রভাবিত করে)
  factoredShearKN: number; // Vu — connection এর মোট factored shear demand
}

export interface BoltedShearConnectionResult {
  phiRnBoltShearKN: number; // মোট bolt-group shear rupture capacity
  phiRnBearingKN: number; // মোট bearing/tearout capacity (governing bolt এর ভিত্তিতে × bolt count)
  governingCapacityKN: number; // দুইটার মধ্যে ছোটটা
  utilizationRatio: number;
  adequate: boolean;
  warnings: string[];
}

/**
 * AISC 360-16 §J3.6 — bolt shear rupture: φRn = φ·Fnv·Ab (φ=0.75)।
 * Double shear হলে effective শক্তি দ্বিগুণ (দুইটা shear plane)।
 */
function computeBoltShearCapacityPerBolt(
  boltGrade: BoltGrade,
  boltDiameterMm: number,
  numberOfShearPlanes: 1 | 2
): number {
  const phi = 0.75;
  const Ab = boltAreaMm2(boltDiameterMm);
  const Fnv = BOLT_PROPERTIES[boltGrade].fnvMPa;
  const RnN = Fnv * Ab * numberOfShearPlanes;
  return (phi * RnN) / 1000; // N → kN
}

/**
 * AISC 360-16 §J3.10 — bearing/tearout at bolt hole, governing (ছোটটা) নেওয়া হয়:
 *   Bearing: φRn = φ·2.4·d·t·Fu (φ=0.75, deformation at service load একটা সীমার মধ্যে ধরে)
 *   Tearout: φRn = φ·1.2·lc·t·Fu, lc = clear distance (edge distance − hole radius, বা spacing − hole diameter, যেটা প্রযোজ্য)
 * Standard hole diameter = bolt diameter + 2mm (AISC-প্রচলিত practical allowance) ধরা হয়েছে।
 */
function computeBearingTearoutCapacityPerBolt(
  boltDiameterMm: number,
  plateThicknessMm: number,
  plateFuMPa: number,
  edgeDistanceMm: number,
  boltSpacingMm: number,
  numberOfBolts: number
): { bearingKN: number; tearoutKN: number } {
  const phi = 0.75;
  const holeDiameter = boltDiameterMm + 2;

  const bearingN = 2.4 * boltDiameterMm * plateThicknessMm * plateFuMPa;
  const phiBearing = (phi * bearingN) / 1000;

  // clear distance — একাধিক bolt থাকলে interior bolt এর জন্য spacing
  // governing হতে পারে (edge distance এর চেয়ে ছোট হলে), তাই দুটোর
  // মধ্যে ছোটটা ধরা হয়েছে conservative ভাবে।
  const lcEdge = edgeDistanceMm - holeDiameter / 2;
  const lcSpacing = numberOfBolts > 1 ? boltSpacingMm - holeDiameter : Number.POSITIVE_INFINITY;
  const lc = Math.min(lcEdge, lcSpacing);

  const tearoutN = 1.2 * Math.max(lc, 0) * plateThicknessMm * plateFuMPa;
  const phiTearout = (phi * tearoutN) / 1000;

  return { bearingKN: phiBearing, tearoutKN: phiTearout };
}

export function designBoltedShearConnection(input: BoltedShearConnectionInput): BoltedShearConnectionResult {
  const warnings: string[] = [];
  const {
    boltGrade,
    boltDiameterMm,
    numberOfBolts,
    numberOfShearPlanes,
    plateThicknessMm,
    plateFuMPa,
    edgeDistanceMm,
    boltSpacingMm,
    factoredShearKN,
  } = input;

  const shearPerBolt = computeBoltShearCapacityPerBolt(boltGrade, boltDiameterMm, numberOfShearPlanes);
  const phiRnBoltShear = shearPerBolt * numberOfBolts;

  const { bearingKN, tearoutKN } = computeBearingTearoutCapacityPerBolt(
    boltDiameterMm,
    plateThicknessMm,
    plateFuMPa,
    edgeDistanceMm,
    boltSpacingMm,
    numberOfBolts
  );
  const governingBearingPerBolt = Math.min(bearingKN, tearoutKN);
  const phiRnBearing = governingBearingPerBolt * numberOfBolts;

  if (tearoutKN < bearingKN) {
    warnings.push(
      "Tearout governs over bearing for this bolt — consider increasing edge distance or bolt spacing to improve capacity."
    );
  }

  const governingCapacity = Math.min(phiRnBoltShear, phiRnBearing);
  const Vu = Math.abs(factoredShearKN);
  const ratio = governingCapacity > 0 ? Vu / governingCapacity : Number.POSITIVE_INFINITY;
  const adequate = Number.isFinite(ratio) && ratio <= 1.0;

  if (!adequate) {
    warnings.push(
      `Factored shear Vu (${Vu.toFixed(1)} kN) exceeds the governing connection capacity (${governingCapacity.toFixed(1)} kN) — add more bolts, increase bolt diameter, or increase plate thickness.`
    );
  }

  warnings.push(
    "This check covers bolt shear rupture and bearing/tearout only — block shear (AISC §J4.3) is not yet automated and should be checked separately, especially for coped beam connections."
  );

  return {
    phiRnBoltShearKN: phiRnBoltShear,
    phiRnBearingKN: phiRnBearing,
    governingCapacityKN: governingCapacity,
    utilizationRatio: ratio,
    adequate,
    warnings,
  };
}
