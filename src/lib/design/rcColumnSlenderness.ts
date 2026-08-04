/**
 * RC Column — Slenderness Check & Moment Magnification
 * Phase 6b — ACI 318-19 §6.2.5 (Slenderness Effects, Moment
 * Magnification Method — non-sway frame)।
 *
 * সরলীকরণ: এই v1-এ শুধু non-sway (braced) frame ধরে নেওয়া হয়েছে —
 * sway frame এর জন্য ACI §6.6.4.3 এ ভিন্ন (এবং জটিলতর, δs magnifier
 * পুরো story-র সব column একসাথে বিবেচনা করে) পদ্ধতি লাগে, যা একটা
 * পরের রিফাইনমেন্টে যোগ হবে। যদি ইঞ্জিনিয়ার sway frame এর কথা জানান
 * (isSwayFrame=true), এই মডিউল একটা conservative warning দেয় এবং
 * δns (non-sway magnifier) প্রয়োগ করে, কিন্তু সেটা sway effect-কে
 * সম্পূর্ণ capture করে না — তাই ফলাফল অবিশ্বাস্য (unconservative)
 * হতে পারে sway frame এ, যা explicit warning এ বলা আছে।
 *
 * effectiveLengthFactor (k) — ACI Table-ভিত্তিক approximate মান
 * ইঞ্জিনিয়ার নিজে সরবরাহ করেন (end restraint condition অনুযায়ী,
 * যেমন pin-pin=1.0, fixed-fixed(non-sway)≈0.65-0.8) — end-condition
 * থেকে স্বয়ংক্রিয় k নির্ণয় এই v1-এ নেই (connectionType থেকে সরাসরি
 * derive করা reliable না, কারণ এটা পুরো frame-এর stiffness ratio-র
 * ফাংশন, শুধু একটা connection-এর না)।
 */

export interface SlendernessCheckInput {
  unsupportedLengthMm: number; // Lu — clear height between points of lateral support
  effectiveLengthFactor: number; // k
  radiusOfGyrationMm: number; // r — rectangular এর জন্য সাধারণত 0.3×dimension, circular এর জন্য 0.25×diameter (ACI §6.2.5.1)
  isSwayFrame: boolean;
  m1KNm: number; // smaller factored end moment (magnitude, ACI sign convention পরে প্রয়োগ হবে)
  m2KNm: number; // larger factored end moment (magnitude), ≥ m1
  isSingleCurvature: boolean; // true হলে m1/m2 ঋণাত্মক অনুপাত (single curvature = বেশি magnification দরকার)
  factoredAxialLoadKN: number; // Pu
  criticalBucklingLoadKN: number; // Pc = π²EI/(k·Lu)² — Buckling Analysis (Phase 4) থেকে, বা ACI approximate EI সূত্র থেকে ইঞ্জিনিয়ার সরবরাহ করেন
}

export interface SlendernessCheckResult {
  klOverR: number; // kLu/r
  slendernessLimit: number; // ACI §6.2.5.1 এর সীমা (34 - 12(M1/M2) নন-সোয়ে, 22 সোয়ে)
  isSlenderColumn: boolean; // kLu/r > সীমা হলে slenderness বিবেচনা করতে হবে
  magnifiedMomentKNm: number; // δns × M2 (magnified design moment)
  magnificationFactor: number; // δns
  warnings: string[];
}

/**
 * ACI 318-19 §6.2.5.1 — slenderness ignore করা যায় যদি:
 *   Non-sway: kLu/r ≤ 34 − 12(M1/M2), সর্বোচ্চ 40
 *   Sway: kLu/r ≤ 22
 * M1/M2 অনুপাত single curvature হলে ঋণাত্মক (একই দিকে বাঁক)।
 */
export function checkColumnSlenderness(input: SlendernessCheckInput): SlendernessCheckResult {
  const {
    unsupportedLengthMm,
    effectiveLengthFactor,
    radiusOfGyrationMm,
    isSwayFrame,
    m1KNm,
    m2KNm,
    isSingleCurvature,
    factoredAxialLoadKN,
    criticalBucklingLoadKN,
  } = input;

  const warnings: string[] = [];

  const klOverR = (effectiveLengthFactor * unsupportedLengthMm) / radiusOfGyrationMm;

  const m1OverM2 = m2KNm > 0 ? m1KNm / m2KNm : 0;
  const signedRatio = isSingleCurvature ? -m1OverM2 : m1OverM2;

  let slendernessLimit: number;
  if (isSwayFrame) {
    slendernessLimit = 22;
    warnings.push(
      "This is flagged as a sway frame — this module applies a non-sway magnifier (δns) only, which does not fully capture sway (δs) effects per ACI 318-19 §6.6.4.3. Treat the magnified moment as a preliminary estimate, not a final design value, for sway frames."
    );
  } else {
    slendernessLimit = Math.min(34 - 12 * signedRatio, 40);
  }

  const isSlenderColumn = klOverR > slendernessLimit;

  if (!isSlenderColumn) {
    return {
      klOverR,
      slendernessLimit,
      isSlenderColumn: false,
      magnifiedMomentKNm: m2KNm,
      magnificationFactor: 1.0,
      warnings,
    };
  }

  // ACI 318-19 §6.6.4.5.2 — Cm (equivalent moment factor)
  const Cm = isSingleCurvature ? 0.6 - 0.4 * (-m1OverM2) : 0.6 - 0.4 * m1OverM2;
  const CmClamped = Math.max(Cm, 0.4);

  const phi = 0.75; // ACI §6.6.4.5.2 — stiffness reduction factor φK এর জন্য প্রযোজ্য φ

  if (criticalBucklingLoadKN <= 0) {
    warnings.push("Critical buckling load (Pc) is zero or negative — cannot compute a valid magnification factor.");
    return {
      klOverR,
      slendernessLimit,
      isSlenderColumn: true,
      magnifiedMomentKNm: m2KNm,
      magnificationFactor: 1.0,
      warnings,
    };
  }

  // Pu ≥ φPc হলে denominator শূন্য বা ঋণাত্মক হয়ে যায় (column
  // ইউলার-বাকলিং সীমার কাছে বা তার বাইরে) — এই অবস্থায় moment
  // magnification method নিজেই আর প্রযোজ্য না (ACI 318-19 এই সীমা
  // ছাড়িয়ে গেলে কোনো magnifier সংজ্ঞায়িত করে না), তাই Infinity/
  // negative propagate না করে একটা explicit bounded "unstable"
  // ফলাফল দেওয়া হচ্ছে — ইঞ্জিনিয়ারকে স্পষ্টভাবে জানানো, UI তে
  // অর্থহীন সংখ্যা দেখানোর বদলে।
  if (factoredAxialLoadKN >= phi * criticalBucklingLoadKN) {
    warnings.push(
      "Factored axial load Pu exceeds φPc — the column is unstable at this load per the moment magnification method (the magnifier is undefined beyond this point); increase section size, reduce unsupported length, or reduce axial load."
    );
    return {
      klOverR,
      slendernessLimit,
      isSlenderColumn: true,
      magnifiedMomentKNm: Number.POSITIVE_INFINITY,
      magnificationFactor: Number.POSITIVE_INFINITY,
      warnings,
    };
  }

  const delta = CmClamped / (1 - factoredAxialLoadKN / (phi * criticalBucklingLoadKN));
  const deltaClamped = Math.max(delta, 1.0); // δns কখনো 1.0 এর কম হতে পারে না (ACI §6.6.4.5.2)

  if (deltaClamped > 1.4) {
    warnings.push(
      `Moment magnification factor δns=${deltaClamped.toFixed(2)} is large (>1.4) — ACI 318-19 recommends a more rigorous second-order analysis (e.g. the app's own P-Delta analysis) rather than relying on the approximate magnification method.`
    );
  }

  return {
    klOverR,
    slendernessLimit,
    isSlenderColumn: true,
    magnifiedMomentKNm: deltaClamped * m2KNm,
    magnificationFactor: deltaClamped,
    warnings,
  };
}

/** Rectangular section এর radius of gyration আনুমানিক মান (ACI §6.2.5.1 permitted approximation: r ≈ 0.3h)। */
export function approximateRadiusOfGyrationRectangular(dimensionMm: number): number {
  return 0.3 * dimensionMm;
}

/** Circular section এর radius of gyration আনুমানিক মান (ACI §6.2.5.1: r ≈ 0.25D)। */
export function approximateRadiusOfGyrationCircular(diameterMm: number): number {
  return 0.25 * diameterMm;
}
