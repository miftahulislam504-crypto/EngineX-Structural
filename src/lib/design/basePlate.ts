/**
 * Steel Column Base Plate — Concentric Axial Design
 * Phase 6g — AISC Design Guide 1 (Base Plate and Anchor Rod Design) এর
 * সরলীকৃত সংস্করণ, শুধু concentric axial load (কোনো significant moment
 * ছাড়া, সবচেয়ে প্রচলিত সাধারণ column base কেস)। Moment-সহ base plate
 * (eccentric loading, anchor rod tension) এই v1-এ নেই — একটা জটিলতর
 * পরের সংযোজন যেখানে anchor bolt pattern ও plate bending উভয়ই বিবেচনা
 * করতে হয়।
 */

export interface BasePlateInput {
  columnDepthMm: number; // d (steel column section depth)
  columnFlangeWidthMm: number; // bf
  concreteFcMPa: number; // f'c of the supporting concrete (footing/pedestal)
  concreteAreaRatioA2OverA1?: number; // A2/A1, pedestal area / plate area — না দিলে 1.0 (conservative, কোনো confinement বৃদ্ধি না)
  plateFyMPa: number; // base plate steel yield strength
  factoredAxialLoadKN: number; // Pu
}

export interface BasePlateResult {
  requiredAreaMm2: number;
  plateLengthMm: number; // N (রাউন্ড আপ করা, সাধারণত column depth এর চেয়ে বড়)
  plateWidthMm: number; // B
  requiredThicknessMm: number;
  bearingCapacityKPa: number; // φc·(0.85·f'c·√(A2/A1))
  warnings: string[];
}

/**
 * AISC DG1 — bearing capacity: φc·Pp = φc·0.85·f'c·A1·√(A2/A1) ≤ φc·1.7·f'c·A1
 * φc = 0.65 (concrete bearing, ACI convention)। Plate dimension (N,B)
 * প্রথমে column dimension + একটা reasonable overhang (Δ = 0.5(0.95d −
 * 0.8bf), AISC DG1 এর প্রচলিত সরলীকৃত approach) দিয়ে estimate করে,
 * তারপর required area থেকে সমন্বয়। thickness — cantilever yield-line
 * পদ্ধতি (AISC DG1 Eq. 3.3.11)।
 */
export function designBasePlate(input: BasePlateInput): BasePlateResult {
  const {
    columnDepthMm: d,
    columnFlangeWidthMm: bf,
    concreteFcMPa,
    concreteAreaRatioA2OverA1,
    plateFyMPa,
    factoredAxialLoadKN,
  } = input;
  const warnings: string[] = [];
  const phiC = 0.65;
  const A2OverA1 = concreteAreaRatioA2OverA1 ?? 1.0;

  const sqrtRatio = Math.min(Math.sqrt(A2OverA1), 2.0); // AISC DG1 — √(A2/A1) সর্বোচ্চ 2.0 পর্যন্ত সীমাবদ্ধ
  const bearingPressureMPa = Math.min(phiC * 0.85 * concreteFcMPa * sqrtRatio, phiC * 1.7 * concreteFcMPa);

  const Pu = Math.abs(factoredAxialLoadKN);
  const requiredAreaMm2 = (Pu * 1000) / bearingPressureMPa;

  // AISC DG1 — N ≈ √(Area) + Δ, Δ = 0.5(0.95d − 0.8bf) (উভয় দিকে
  // সমান overhang assumption দিয়ে শুরু, বাস্তবে N সাধারণত B এর চেয়ে
  // সামান্য বড় রাখা হয় কারণ d > bf প্রায়ই)।
  const delta = 0.5 * (0.95 * d - 0.8 * bf);
  let N = Math.sqrt(requiredAreaMm2) + delta;
  let B = requiredAreaMm2 / N;

  // Round up to practical 10mm increments
  N = Math.ceil(N / 10) * 10;
  B = Math.ceil(B / 10) * 10;

  // AISC DG1 Eq. 3.3.11 — thickness (cantilever yield-line method):
  //   tp = l·√(2·Pu / (0.9·Fy·B·N)), l = max(m, n, λn')
  //   m = (N − 0.95d)/2, n = (B − 0.8bf)/2 (সরলীকৃত, λn' বাদ — বেশিরভাগ
  //   সাধারণ কেসে m/n governs করে)
  const m = (N - 0.95 * d) / 2;
  const n = (B - 0.8 * bf) / 2;
  const l = Math.max(m, n, 0);

  const requiredThickness = l * Math.sqrt((2 * Pu * 1000) / (0.9 * plateFyMPa * B * N));

  if (requiredThickness < 12) {
    warnings.push(
      "Calculated plate thickness is below a commonly used practical minimum of ~12mm — verify against project-specific minimum plate thickness practice."
    );
  }

  warnings.push(
    "This is a concentric-axial-load base plate check only (AISC Design Guide 1, simplified) — no moment/eccentricity, anchor rod design, or plate bending under combined load is included. For columns with significant moment at the base, a full eccentric base plate design is needed."
  );

  return {
    requiredAreaMm2,
    plateLengthMm: N,
    plateWidthMm: B,
    requiredThicknessMm: requiredThickness,
    bearingCapacityKPa: bearingPressureMPa * 1000, // MPa → kPa
    warnings,
  };
}
