/**
 * Steel Section Design Properties (W-Shape)
 * Phase 6c — AISC 360-16 design এর জন্য প্রয়োজনীয় properties যা
 * lib/types/section.ts এর SectionProperties এ নেই (Sx, Zx, ry, rx,
 * flange/web slenderness ratio)। section.ts এর computeSectionProperties()
 * একটা established, hand-verified (AISC W12x26 এর বিরুদ্ধে) ফাংশন —
 * সেটাকে না ছুঁয়ে এই আলাদা মডিউলে design-specific properties যোগ করা
 * হলো, যাতে core geometry ফাইলের ঝুঁকি না বাড়ে।
 *
 * সবগুলো সূত্রই section.ts এর w-shape case এর মতোই perfect-rectangle
 * approximation (fillet/root radius বাদে) — একই সীমাবদ্ধতা প্রযোজ্য
 * (AISC published টেবিলের তুলনায় ~1-2% পার্থক্য, preliminary design এ
 * গ্রহণযোগ্য)।
 */

import type { WShapeSection } from "@/lib/types/section";

export interface SteelDesignProperties {
  areaMm2: number;
  ixxMm4: number;
  iyyMm4: number;
  sxMm3: number; // elastic section modulus, strong axis = Ixx / (d/2)
  zxMm3: number; // plastic section modulus, strong axis
  ryMm: number; // weak-axis radius of gyration = √(Iyy/A)
  rxMm: number; // strong-axis radius of gyration = √(Ixx/A)
  flangeSlenderness: number; // bf/(2tf) — local buckling check (AISC Table B4.1a)
  webSlenderness: number; // h/tw (h ≈ clear web depth) — local buckling check
  jMm4: number; // St. Venant torsional constant, open thin-walled approximation (Σbᵢtᵢᵢᵢᵢᵢᵢᵢ³/3) — AISC F2-6 এ প্রয়োজন
  hoMm: number; // distance between flange centroids = d - tf — AISC F2-6 এ প্রয়োজন
  cwMm6: number; // warping constant, doubly-symmetric I-shape: Cw = Iy·ho²/4 — AISC F2-7
  rtsMm: number; // effective radius of gyration for LTB, rts² = √(Iy·Cw)/Sx — AISC F2-7 (ry দিয়ে approximate করা ভুল, নিচের ফাইল-হেডার নোট দেখুন)
}

export function computeSteelWShapeDesignProperties(section: WShapeSection): SteelDesignProperties {
  const { depth: d, flangeWidth: bf, flangeThickness: tf, webThickness: tw } = section;
  const webDepth = d - 2 * tf;

  const area = 2 * bf * tf + webDepth * tw;

  const flangeIxx = 2 * ((bf * tf ** 3) / 12 + bf * tf * ((d - tf) / 2) ** 2);
  const webIxx = (tw * webDepth ** 3) / 12;
  const ixx = flangeIxx + webIxx;

  const flangeIyy = 2 * ((tf * bf ** 3) / 12);
  const webIyy = (webDepth * tw ** 3) / 12;
  const iyy = flangeIyy + webIyy;

  const sx = ixx / (d / 2);

  // Zx (plastic section modulus) — flange ও web কে rectangle ধরে
  // first-moment-of-area পদ্ধতিতে: Zx = ΣAi·|yi| (উপরের অর্ধেক ও
  // নিচের অর্ধেক প্রতিটা অংশের centroid থেকে neutral axis পর্যন্ত
  // দূরত্ব সহ)।
  const flangeZx = 2 * (bf * tf * ((d - tf) / 2));
  const webZx = 2 * ((tw * (webDepth / 2) ** 2) / 2);
  const zx = flangeZx + webZx;

  const ry = Math.sqrt(iyy / area);
  const rx = Math.sqrt(ixx / area);

  const flangeSlenderness = bf / (2 * tf);
  const webSlenderness = webDepth / tw;

  // St. Venant torsional constant — open thin-walled section
  // approximation (২টা flange rectangle + web rectangle এর যোগফল),
  // section.ts এর w-shape case এ ব্যবহৃত একই সূত্র।
  const j = (2 * bf * tf ** 3) / 3 + (webDepth * tw ** 3) / 3;

  // AISC F2-7 এর ho ও Cw — doubly-symmetric I-shape এর জন্য:
  //   ho = d - tf (flange centroid থেকে flange centroid দূরত্ব)
  //   Cw = Iy·ho² / 4
  const ho = d - tf;
  const cw = (iyy * ho ** 2) / 4;

  // rts² = √(Iy·Cw) / Sx — AISC F2-7 (ry দিয়ে approximate করলে Lr বহুগুণ
  // ভুল হয়ে যায়, নিচের rcColumnPmInteraction.ts এর মতো একটা পূর্ণাঙ্গ
  // সূত্র প্রয়োজন — steelBeamFlexure.ts এর হেডার নোট দেখুন)
  const rts = Math.sqrt(Math.sqrt(iyy * cw) / sx);

  return {
    areaMm2: area,
    ixxMm4: ixx,
    iyyMm4: iyy,
    sxMm3: sx,
    zxMm3: zx,
    ryMm: ry,
    rxMm: rx,
    flangeSlenderness,
    webSlenderness,
    jMm4: j,
    hoMm: ho,
    cwMm6: cw,
    rtsMm: rts,
  };
}
