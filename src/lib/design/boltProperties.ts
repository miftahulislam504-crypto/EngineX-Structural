/**
 * Bolt Strength Database (ASTM A325 / A490)
 * Phase 6g — AISC 360-16 Table J3.2। সবচেয়ে প্রচলিত দুইটা high-strength
 * bolt grade — A325 (সাধারণ) ও A490 (উচ্চ-শক্তি, ভারী লোড)। Fnv
 * (nominal shear stress) থ্রেড bolt shear plane এর ভেতরে/বাইরে থাকা
 * অনুযায়ী ভিন্ন (N = threads included, X = threads excluded) —
 * সাধারণ প্র্যাকটিসে conservative ধরে N (threads included in shear
 * plane) ডিফল্ট রাখা হয়েছে।
 */

export type BoltGrade = "A325" | "A490";

export interface BoltProperties {
  fnvMPa: number; // nominal shear stress (threads included, "N" condition) — AISC Table J3.2
  fntMPa: number; // nominal tensile stress — AISC Table J3.2
}

export const BOLT_PROPERTIES: Record<BoltGrade, BoltProperties> = {
  A325: { fnvMPa: 372, fntMPa: 620 }, // AISC Table J3.2 (SI): Fnv=372 MPa (N), Fnt=620 MPa
  A490: { fnvMPa: 457, fntMPa: 780 }, // Fnv=457 MPa (N), Fnt=780 MPa
};

export const STANDARD_BOLT_DIAMETERS_MM = [12.7, 15.9, 19.1, 22.2, 25.4, 28.6]; // 1/2", 5/8", 3/4", 7/8", 1", 1-1/8"

export function boltAreaMm2(diameterMm: number): number {
  return (Math.PI / 4) * diameterMm * diameterMm;
}
