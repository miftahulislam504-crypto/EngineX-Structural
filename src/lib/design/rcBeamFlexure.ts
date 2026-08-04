/**
 * RC Beam — Flexural Design
 * Phase 6a — ACI 318-19 Chapter 9 (Beams) / BNBC 2020 Part 6 Chapter 8
 * (উভয় কোড মূলত একই strength-design পদ্ধতি অনুসরণ করে — Whitney
 * rectangular stress block, φ=0.9 tension-controlled ধরে নেওয়া হয়েছে
 * v1-এ, কারণ strain-compatibility থেকে প্রকৃত φ নির্ণয় একটা পরের
 * ধাপে যোগ করার মতো পরিশীলন — অধিকাংশ সাধারণ RC beam-ই tension-
 * controlled হয়, তাই এটা যুক্তিসঙ্গত প্রাথমিক অনুমান)।
 *
 * ইনপুট মুহূর্ত Analysis Engine (Phase 4) থেকে আসা factored moment
 * (ইউজার লোড কম্বিনেশন থেকে already factored ধরে নেওয়া হয়, কারণ
 * Load Combination Generator, Phase 3-এ, LRFD-স্টাইল ফ্যাক্টর প্রয়োগ
 * করেই কম্বিনেশন বানায়)।
 *
 * এই মডিউল rebar area হিসাব করে (design), এবং প্রদত্ত rebar area এর
 * capacity যাচাই করে (check) — দুটোই দরকার: প্রথমটা ইঞ্জিনিয়ারকে
 * কতটুকু rebar লাগবে বলে দেয়, দ্বিতীয়টা ইঞ্জিনিয়ার নিজে যা বেছেছেন
 * তা যথেষ্ট কিনা যাচাই করে।
 */

export interface FlexuralDesignInput {
  factoredMomentKNm: number; // Mu, kN·m (magnitude; sign দিয়ে বোঝা যায় top/bottom rebar দরকার)
  widthMm: number; // b
  totalDepthMm: number; // h (overall depth)
  effectiveCoverMm: number; // d' — extreme tension fiber থেকে rebar centroid পর্যন্ত দূরত্ব (cover + stirrup + bar/2 এর সমষ্টি, ইঞ্জিনিয়ার input দেন)
  fcMPa: number; // f'c
  fyMPa: number; // rebar fy
  compressionCoverMm?: number; // extreme compression fiber → compression steel centroid, doubly-reinforced হিসাবে প্রয়োজন — না দিলে effectiveCoverMm এর সমান ধরা হয় (symmetric cover, সাধারণ practice)
}

export interface FlexuralDesignResult {
  effectiveDepthMm: number; // d = h - d'
  requiredAsMm2: number; // As required
  minAsMm2: number; // ACI 318-19 §9.6.1.2 minimum reinforcement
  maxAsMm2: number; // ACI 318-19 §21.2 (tension-controlled limit, ρmax বাস্তবতা)
  isDoublyReinforced: boolean; // singly reinforced দিয়ে Mu ধরা সম্ভব না হলে true
  governingAsMm2: number; // min/max বিবেচনা করে প্রকৃত required As (tension steel, doubly-reinforced হলে As1+As2)
  compressionAsMm2: number; // As' — doubly-reinforced হলে প্রয়োজনীয় compression steel, না হলে 0
  warnings: string[];
}

/**
 * ACI 318-19 §9.6.1.2 / BNBC 2020 — minimum flexural reinforcement:
 * As,min = max( (0.25√f'c / fy) × b × d , (1.4 / fy) × b × d )
 * (f'c, fy MPa এককে; ফলাফল mm²)
 */
export function computeMinFlexuralAs(
  widthMm: number,
  effectiveDepthMm: number,
  fcMPa: number,
  fyMPa: number
): number {
  const option1 = ((0.25 * Math.sqrt(fcMPa)) / fyMPa) * widthMm * effectiveDepthMm;
  const option2 = (1.4 / fyMPa) * widthMm * effectiveDepthMm;
  return Math.max(option1, option2);
}

/**
 * সরলীকৃত maximum As — tension-controlled সীমা নিশ্চিত করতে (ACI
 * 318-19 §21.2.2 অনুযায়ী net tensile strain εt ≥ 0.005)। এই v1-এ
 * strain-compatibility থেকে সরাসরি না বের করে, প্রচলিত ব্যবহারিক
 * সীমা ρmax ≈ 0.85β1(f'c/fy)(0.003/(0.003+0.005)) ব্যবহার করা হয়েছে
 * — যা tension-controlled boundary (εt=0.005) এর জন্য প্রমিত সূত্র।
 */
export function computeMaxFlexuralAs(
  widthMm: number,
  effectiveDepthMm: number,
  fcMPa: number,
  fyMPa: number
): number {
  const beta1 = computeBeta1(fcMPa);
  const rhoMax = 0.85 * beta1 * (fcMPa / fyMPa) * (0.003 / (0.003 + 0.005));
  return rhoMax * widthMm * effectiveDepthMm;
}

/** ACI 318-19 §22.2.2.4.3 — β1 factor, f'c এর উপর নির্ভরশীল (stress block depth ratio)। */
function computeBeta1(fcMPa: number): number {
  if (fcMPa <= 28) return 0.85;
  if (fcMPa >= 55) return 0.65;
  return 0.85 - (0.05 * (fcMPa - 28)) / 7;
}

/**
 * Whitney rectangular stress block ভিত্তিক flexural design — singly
 * reinforced ধরে required As বের করে (quadratic সমীকরণ সমাধান করে,
 * কারণ a = As·fy/(0.85·f'c·b) নিজেই As এর ফাংশন)।
 *
 * φMn = Mu থেকে:
 *   Mu = φ·As·fy·(d − a/2), যেখানে a = As·fy / (0.85·f'c·b)
 * As এর জন্য সমাধান করলে একটা quadratic আসে (Ru = Mu/(φbd²) পদ্ধতি
 * ব্যবহার করা হয়েছে, যা হাতে-হিসাবের প্রচলিত পদ্ধতি ও সংখ্যাগতভাবে
 * স্থিতিশীল — সরাসরি As এর quadratic সমাধানের চেয়ে edge-case এ কম
 * numerically fragile)।
 */
export function designFlexuralReinforcement(input: FlexuralDesignInput): FlexuralDesignResult {
  const { factoredMomentKNm, widthMm, totalDepthMm, effectiveCoverMm, fcMPa, fyMPa } = input;
  const compressionCover = input.compressionCoverMm ?? effectiveCoverMm;
  const warnings: string[] = [];

  const d = totalDepthMm - effectiveCoverMm;
  const dPrime = compressionCover;
  const MuNmm = Math.abs(factoredMomentKNm) * 1e6; // kN·m → N·mm
  const phi = 0.9; // tension-controlled ধরে নেওয়া হয়েছে (উপরের ফাইল-হেডার নোট দেখুন)

  const minAs = computeMinFlexuralAs(widthMm, d, fcMPa, fyMPa);
  const maxAs = computeMaxFlexuralAs(widthMm, d, fcMPa, fyMPa);

  if (d <= 0) {
    return {
      effectiveDepthMm: d,
      requiredAsMm2: 0,
      minAsMm2: minAs,
      maxAsMm2: maxAs,
      isDoublyReinforced: false,
      governingAsMm2: 0,
      compressionAsMm2: 0,
      warnings: ["Effective depth (d = h − cover) is zero or negative — check section dimensions and cover input."],
    };
  }

  if (MuNmm <= 1e-6) {
    // কার্যত zero moment — nominal/min reinforcement যথেষ্ট
    return {
      effectiveDepthMm: d,
      requiredAsMm2: 0,
      minAsMm2: minAs,
      maxAsMm2: maxAs,
      isDoublyReinforced: false,
      governingAsMm2: minAs,
      compressionAsMm2: 0,
      warnings: [],
    };
  }

  // Ru পদ্ধতি: Ru = Mu / (φ·b·d²), তারপর ρ = (0.85·f'c/fy)·[1 − √(1 − 2Ru/(0.85·f'c))]
  const Ru = MuNmm / (phi * widthMm * d * d);
  const term = 1 - (2 * Ru) / (0.85 * fcMPa);

  let isDoublyReinforced = false;
  let requiredAs: number;
  let compressionAs = 0;

  if (term < 0) {
    // Singly reinforced section দিয়ে এই মুহূর্ত ধরা সম্ভব না — doubly
    // reinforced ডিজাইন প্রয়োজন। ক্লাসিক্যাল ACI পদ্ধতি: max
    // singly-reinforced moment (Mu1, ρmax দিয়ে) আলাদা করে, বাকি
    // মুহূর্ত (Mu2) compression steel + সমপরিমাণ অতিরিক্ত tension
    // steel দিয়ে resist করানো হয়।
    isDoublyReinforced = true;

    const beta1 = computeBeta1(fcMPa);
    const a1 = beta1 * (0.003 / (0.003 + 0.005)) * d; // stress-block depth ρmax (tension-controlled boundary) এর সাথে সঙ্গতিপূর্ণ
    const As1 = maxAs; // ρmax থেকে গণনাকৃত maxAs-ই As1 (single-reinforced অংশ)
    const Mu1Nmm = phi * As1 * fyMPa * (d - a1 / 2);
    const Mu2Nmm = MuNmm - Mu1Nmm;

    if (Mu2Nmm <= 0) {
      // তাত্ত্বিকভাবে এই branch এ আসার কথা না (term<0 মানে Mu>Mu1
      // হওয়ার কথা), কিন্তু defensive: negative হলে শুধু As1 ব্যবহার
      requiredAs = As1;
      warnings.push(
        "Doubly-reinforced calculation produced a non-positive residual moment (Mu2) — falling back to the maximum singly-reinforced As; verify inputs."
      );
    } else {
      // compression steel strain যাচাই — yield করেছে কিনা (εcu=0.003
      // ধরে, c = a1/β1 থেকে compression steel strain বের করা হয়)
      const c = a1 / beta1;
      const epsSPrime = c > 0 ? (0.003 * (c - dPrime)) / c : 0;
      const epsY = fyMPa / 200000;
      const fsPrime = epsSPrime >= epsY ? fyMPa : Math.max(0, epsSPrime * 200000);

      if (fsPrime < fyMPa) {
        warnings.push(
          `Compression steel does not reach yield at this neutral-axis depth (f's=${fsPrime.toFixed(0)} MPa < fy=${fyMPa} MPa) — the As2/As' calculation below uses this reduced stress, which is more conservative than assuming yield, but a strain-compatibility cross-check is recommended for this case.`
        );
      }

      const As2 = Mu2Nmm / (phi * fyMPa * (d - dPrime));
      compressionAs = fsPrime > 0 ? (As2 * fyMPa) / fsPrime : As2;
      requiredAs = As1 + As2;
    }

    warnings.push(
      "This section requires doubly-reinforced design (moment exceeds the singly-reinforced tension-controlled capacity) — compression steel (As') has been computed using the classical ACI two-part method; verify against a strain-compatibility check for critical members."
    );
  } else {
    const rho = ((0.85 * fcMPa) / fyMPa) * (1 - Math.sqrt(term));
    requiredAs = rho * widthMm * d;
  }

  const governingAs = Math.max(requiredAs, minAs);

  if (!isDoublyReinforced && governingAs > maxAs) {
    warnings.push(
      `Required As (${governingAs.toFixed(0)} mm²) exceeds the tension-controlled limit (${maxAs.toFixed(0)} mm²) — section may not be tension-controlled; consider a larger section or doubly reinforced design.`
    );
  }

  if (!isDoublyReinforced && requiredAs < minAs) {
    warnings.push(
      `Moment-based As (${requiredAs.toFixed(0)} mm²) is below the code minimum (${minAs.toFixed(0)} mm²) — minimum reinforcement governs.`
    );
  }

  return {
    effectiveDepthMm: d,
    requiredAsMm2: requiredAs,
    minAsMm2: minAs,
    maxAsMm2: maxAs,
    isDoublyReinforced,
    governingAsMm2: Math.min(governingAs, isDoublyReinforced ? governingAs : Number.POSITIVE_INFINITY),
    compressionAsMm2: compressionAs,
    warnings,
  };
}

export interface FlexuralCapacityCheckInput {
  providedAsMm2: number;
  widthMm: number;
  effectiveDepthMm: number;
  fcMPa: number;
  fyMPa: number;
}

export interface FlexuralCapacityCheckResult {
  phiMnKNm: number; // design moment capacity, φMn
  utilizationRatio: number; // Mu / φMn (caller supplies Mu separately via checkFlexuralAdequacy)
}

/** প্রদত্ত (ইঞ্জিনিয়ার-নির্বাচিত) As দিয়ে φMn (design moment capacity) হিসাব করে। */
export function computeFlexuralCapacity(input: FlexuralCapacityCheckInput): number {
  const { providedAsMm2, widthMm, effectiveDepthMm, fcMPa, fyMPa } = input;
  const phi = 0.9;
  const a = (providedAsMm2 * fyMPa) / (0.85 * fcMPa * widthMm);
  const MnNmm = providedAsMm2 * fyMPa * (effectiveDepthMm - a / 2);
  return (phi * MnNmm) / 1e6; // N·mm → kN·m
}

/**
 * φMn ≥ Mu কিনা যাচাই করে utilization ratio ফেরত দেয় — ratio ≤ 1.0
 * হলে adequate, > 1.0 হলে under-designed।
 */
export function checkFlexuralAdequacy(
  factoredMomentKNm: number,
  capacityInput: FlexuralCapacityCheckInput
): { phiMnKNm: number; utilizationRatio: number; adequate: boolean } {
  const phiMn = computeFlexuralCapacity(capacityInput);
  const Mu = Math.abs(factoredMomentKNm);
  const ratio = phiMn > 0 ? Mu / phiMn : Number.POSITIVE_INFINITY;
  return { phiMnKNm: phiMn, utilizationRatio: ratio, adequate: ratio <= 1.0 };
}
