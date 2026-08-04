/**
 * RC Column — Axial-Moment (P-M) Interaction
 * Phase 6b — ACI 318-19 §22.4 (Axial Strength or Combined Flexural
 * and Axial Strength)। একটা সরলীকৃত rectangular section, symmetric
 * reinforcement (সমান বার উভয় face এ, সবচেয়ে প্রচলিত column
 * ডিটেইলিং) ধরে uniaxial P-M interaction diagram বানানো হয় — strain
 * compatibility (plane-sections-remain-plane) ও Whitney stress
 * block ব্যবহার করে, neutral-axis depth c কে scan করে একটা সিরিজ
 * (P,M) point বের করে।
 *
 * সরলীকরণ: বর্তমানে শুধু uniaxial bending (একটা অক্ষে moment) সমর্থিত
 * — biaxial (Bresler reciprocal load method, ACI §22.4.2.1) পরের
 * রিফাইনমেন্টে যোগ হবে। Circular section এর জন্য rectangular-
 * equivalent approximation ব্যবহার করা হয়েছে (সমমানের moment of
 * inertia দিয়ে একটা "square-equivalent" width বসিয়ে, rigorous
 * নয় কিন্তু প্রাথমিক ডিজাইনের জন্য যুক্তিসঙ্গত অনুমান — সঠিক circular
 * interaction ellipse ভবিষ্যতে যোগ হবে)।
 */

const NUM_SCAN_POINTS = 20;

export interface PmInteractionInput {
  widthMm: number; // b (bending axis-এর লম্ব দিক)
  totalDepthMm: number; // h (bending axis বরাবর দিক)
  fcMPa: number;
  fyMPa: number;
  totalAsMm2: number; // মোট longitudinal steel area (সব বার একসাথে)
  numBarLayers: number; // reinforcement layer সংখ্যা (সাধারণত 2 — একদিকে tension, একদিকে compression face)
  coverToBarCentroidMm: number; // extreme fiber → nearest layer bar centroid
}

export interface PmInteractionPoint {
  phiPnKN: number; // design axial capacity, φPn
  phiMnKNm: number; // design moment capacity, φMn
  phi: number; // ব্যবহৃত strength-reduction factor (tension/compression-controlled অনুযায়ী পরিবর্তিত হয়)
}

/** ACI 318-19 §21.2.2 — strain compatibility থেকে φ (tied column, spiral না ধরে — spiral হলে φ কিছুটা বেশি)। */
function computePhiFromStrain(netTensileStrain: number): number {
  const eps_ty = 0.002; // Grade 60 rebar approx yield strain (fy/Es, 414/200000)
  if (netTensileStrain <= eps_ty) return 0.65; // compression-controlled (tied)
  if (netTensileStrain >= 0.005) return 0.9; // tension-controlled
  // transition zone — linear interpolation, ACI §21.2.2
  return 0.65 + ((netTensileStrain - eps_ty) / (0.005 - eps_ty)) * (0.9 - 0.65);
}

function computeBeta1(fcMPa: number): number {
  if (fcMPa <= 28) return 0.85;
  if (fcMPa >= 55) return 0.65;
  return 0.85 - (0.05 * (fcMPa - 28)) / 7;
}

/**
 * একটা নির্দিষ্ট neutral-axis depth c এর জন্য (P, M) বের করে —
 * strain compatibility (εcu=0.003 concrete crushing strain) ও
 * Whitney stress block ব্যবহার করে। দুই-layer reinforcement (top +
 * bottom, symmetric) ধরে নেওয়া হয়েছে।
 */
function computePointAtNeutralAxisDepth(
  c: number,
  input: PmInteractionInput
): { P: number; M: number; phi: number } {
  const { widthMm: b, totalDepthMm: h, fcMPa, fyMPa, totalAsMm2, coverToBarCentroidMm } = input;
  const Es = 200000; // MPa, rebar elastic modulus
  const epsCu = 0.003;
  const beta1 = computeBeta1(fcMPa);

  const d = h - coverToBarCentroidMm; // tension-layer effective depth
  const dPrime = coverToBarCentroidMm; // compression-layer depth from extreme compression fiber
  const AsLayer = totalAsMm2 / 2; // symmetric — অর্ধেক প্রতিটা face এ

  // Concrete compression force (Whitney block)
  const a = Math.min(beta1 * c, h);
  const Cc = 0.85 * fcMPa * b * a;

  // Compression-side steel (কাছের face, depth d')
  const epsS1 = (epsCu * (c - dPrime)) / c;
  const fs1 = clamp(epsS1 * Es, -fyMPa, fyMPa);
  // কম্প্রেশন স্টিলের জায়গায় ইতিমধ্যে কনক্রিট আছে ধরে সেই স্থানচ্যুতি বাদ দেওয়া (Whitney block এর মধ্যে পড়লে)
  const Fs1 = AsLayer * fs1 - (a >= dPrime ? AsLayer * 0.85 * fcMPa : 0);

  // Tension-side steel (দূরের face, depth d)
  const epsS2 = (epsCu * (d - c)) / c;
  const fs2 = clamp(epsS2 * Es, -fyMPa, fyMPa);
  const Fs2 = AsLayer * fs2;

  // P = ΣForces (কম্প্রেশন positive কনভেনশন)
  const P = (Cc + Fs1 - Fs2) / 1000; // N → kN

  // M = plastic centroid (h/2 ধরা হয়েছে, symmetric section এ যুক্তিসঙ্গত) এর সাপেক্ষে moment
  const centroid = h / 2;
  const M =
    (Cc * (centroid - a / 2) + Fs1 * (centroid - dPrime) + Fs2 * (d - centroid)) / 1e6; // N·mm → kN·m

  const netTensileStrain = epsS2; // দূরতম tension layer এর strain
  const phi = computePhiFromStrain(netTensileStrain);

  return { P, M: Math.abs(M), phi };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * ACI 318-19 §22.4.2.1 — tied column সর্বোচ্চ axial capacity:
 *   φPn,max = φ × 0.80 × [0.85·f'c·(Ag − Ast) + fy·Ast], φ = 0.65 (tied, compression-controlled)
 */
function computeMaxAxialCap(input: PmInteractionInput): number {
  const { widthMm, totalDepthMm, fcMPa, fyMPa, totalAsMm2 } = input;
  const Ag = widthMm * totalDepthMm;
  const Pn0 = 0.85 * fcMPa * (Ag - totalAsMm2) + fyMPa * totalAsMm2; // N
  const phiTied = 0.65;
  return (phiTied * 0.8 * Pn0) / 1000; // N → kN
}

/**
 * পুরো P-M interaction diagram বানায় — neutral axis depth c কে
 * pure-compression (c→∞ practically, খুব বড় মান) থেকে pure-tension
 * (c→0) পর্যন্ত scan করে NUM_SCAN_POINTS টা (φPn, φMn) point বের করে।
 * এই ফাংশনটাই মূল আউটপুট — একটা curve, যা UI তে plot করা যায় এবং
 * checkColumnAdequacy দিয়ে যাচাই করা যায়।
 *
 * ACI 318-19 §22.4.2.1 — tied column এর সর্বোচ্চ axial capacity
 * সীমাবদ্ধ: φPn,max = 0.80 × φPn0 (pure axial capacity), কারণ practical
 * column-এ সবসময় কিছুটা accidental eccentricity থাকে বলে ধরে নেওয়া
 * হয় — কখনো ideal pure-axial অবস্থায় ডিজাইন করা হয় না। এই cap
 * প্রয়োগ না করলে ভারী-axial-load column ভুলভাবে "adequate" দেখাতে
 * পারে।
 */
export function buildPmInteractionDiagram(input: PmInteractionInput): PmInteractionPoint[] {
  const { totalDepthMm: h } = input;
  const points: PmInteractionPoint[] = [];

  const maxAxialCapKN = computeMaxAxialCap(input);

  // c এর ব্যাপ্তি: 0.1h (প্রায় pure tension) থেকে 3h (প্রায় pure compression) পর্যন্ত,
  // non-linear (finer near balanced point এর কাছাকাছি না গিয়ে সরল uniform scan —
  // v1 এ যথেষ্ট রেজোলিউশনের জন্য uniform grid ব্যবহার করা হয়েছে)।
  const cMin = 0.05 * h;
  const cMax = 3 * h;

  for (let i = 0; i <= NUM_SCAN_POINTS; i++) {
    const c = cMin + ((cMax - cMin) * i) / NUM_SCAN_POINTS;
    const { P, M, phi } = computePointAtNeutralAxisDepth(c, input);
    const cappedPhiPn = Math.min(phi * P, maxAxialCapKN);
    points.push({ phiPnKN: cappedPhiPn, phiMnKNm: phi * M, phi });
  }

  // Pure axial (c → ∞ সীমা, cMax দিয়েই approximate) থেকে P কমতে কমতে
  // M বাড়ে, তারপর balanced point পার হয়ে M কমে — points কে phiPnKN
  // অনুযায়ী descending sort করলে ব্যবহারযোগ্য একটা envelope পাওয়া যায়।
  points.sort((a, b) => b.phiPnKN - a.phiPnKN);

  return points;
}

export interface ColumnAdequacyResult {
  adequate: boolean;
  interpolatedPhiMnKNm: number; // এই Pu লেভেলে diagram থেকে interpolate করা capacity
  utilizationRatio: number; // Mu / interpolatedPhiMn
  warnings: string[];
}

/**
 * প্রদত্ত (Pu, Mu) point interaction diagram এর ভেতরে পড়ে কিনা যাচাই
 * করে — একই axial load level এ diagram থেকে capacity moment
 * interpolate করে তুলনা করা হয়।
 */
export function checkColumnAdequacy(
  diagram: PmInteractionPoint[],
  factoredAxialLoadKN: number,
  factoredMomentKNm: number
): ColumnAdequacyResult {
  const warnings: string[] = [];
  const Pu = factoredAxialLoadKN;
  const Mu = Math.abs(factoredMomentKNm);

  if (diagram.length === 0) {
    return { adequate: false, interpolatedPhiMnKNm: 0, utilizationRatio: Infinity, warnings: ["Empty interaction diagram."] };
  }

  const maxP = diagram[0].phiPnKN;
  const minP = diagram[diagram.length - 1].phiPnKN;

  if (Pu > maxP) {
    warnings.push(
      `Factored axial load Pu (${Pu.toFixed(0)} kN) exceeds the maximum axial capacity on the interaction diagram (${maxP.toFixed(0)} kN) — column is overloaded in pure compression; increase section size or reinforcement.`
    );
    return { adequate: false, interpolatedPhiMnKNm: 0, utilizationRatio: Infinity, warnings };
  }
  if (Pu < minP) {
    warnings.push(
      `Factored axial load Pu (${Pu.toFixed(0)} kN) is below the diagram's tension range (${minP.toFixed(0)} kN) — check for net tension in the column, which needs a dedicated tension check.`
    );
  }

  // linear interpolation between the two bracketing points on the (sorted-descending) diagram
  let lower = diagram[diagram.length - 1];
  let upper = diagram[0];
  for (let i = 0; i < diagram.length - 1; i++) {
    if (diagram[i].phiPnKN >= Pu && diagram[i + 1].phiPnKN <= Pu) {
      upper = diagram[i];
      lower = diagram[i + 1];
      break;
    }
  }

  const span = upper.phiPnKN - lower.phiPnKN;
  const t = span !== 0 ? (Pu - lower.phiPnKN) / span : 0;
  const interpolatedPhiMn = lower.phiMnKNm + t * (upper.phiMnKNm - lower.phiMnKNm);

  const ratio = interpolatedPhiMn > 0 ? Mu / interpolatedPhiMn : Number.POSITIVE_INFINITY;
  const adequate = Number.isFinite(ratio) && ratio <= 1.0;

  if (!adequate) {
    if (!Number.isFinite(Mu)) {
      warnings.push(
        "The design moment is undefined (the column is unstable per the slenderness/magnification check above) — this moment demand cannot be checked against the interaction diagram until the instability is resolved."
      );
    } else {
      warnings.push(
        `Factored moment Mu (${Mu.toFixed(1)} kN·m) exceeds the interpolated design capacity φMn (${interpolatedPhiMn.toFixed(1)} kN·m) at this axial load level — increase reinforcement or section size.`
      );
    }
  }

  return { adequate, interpolatedPhiMnKNm: interpolatedPhiMn, utilizationRatio: ratio, warnings };
}
