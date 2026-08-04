/**
 * RC Beam — Crack Width Check
 * Phase 6a — ACI 318-19 §24.3 (Distribution of Flexural Reinforcement)।
 * ACI 318-19 সরাসরি একটা সংখ্যাসূচক crack-width সীমা mandate করে না
 * (পুরনো ACI 318-99-এ z-factor পদ্ধতি ছিল) — বরং maximum bar spacing
 * সীমাবদ্ধ করে crack control নিশ্চিত করে (§24.3.2)। এই মডিউল সেই
 * বর্তমান ACI 318-19 পদ্ধতি অনুসরণ করে (spacing-based), পাশাপাশি
 * তথ্যগত হিসেবে Gergely-Lutz সূত্র থেকে আনুমানিক crack width (mm)ও
 * দেখায় (ইঞ্জিনিয়াররা প্রায়ই এই সংখ্যাটাই আশা করেন, যদিও এটা কোনো
 * code-mandated চেক না, বরং একটা informational cross-check)।
 */

export interface CrackControlCheckInput {
  barSpacingMm: number; // provided center-to-center spacing of tension rebar
  clearCoverMm: number; // tension face থেকে nearest bar surface পর্যন্ত clear cover
  fyMPa: number;
  serviceStressMPa?: number; // fs — service-level stress rebar এ; না দিলে 0.6fy অনুমান করা হয় (ACI §24.3.2.1 permitted approximation)
}

export interface CrackControlCheckResult {
  serviceStressMPa: number; // ব্যবহৃত fs (input বা 0.6fy অনুমান)
  maxSpacingMm: number; // ACI §24.3.2 অনুযায়ী অনুমোদিত সর্বোচ্চ spacing
  adequate: boolean;
  warnings: string[];
}

/**
 * ACI 318-19 §24.3.2 — maximum bar spacing (mm, SI units):
 *   s = min( 380×(280/fs) − 2.5×cc , 300×(280/fs) )
 * fs MPa এককে (service stress), cc = clear cover মিলিমিটারে।
 * fs না দেওয়া হলে ACI §24.3.2.1 এর permitted approximation fs = (2/3)fy
 * ব্যবহার করা হয় (কিছু রেফারেন্সে 0.6fy ও দেখা যায় — এখানে ACI-এর
 * নিজস্ব approximation ধরা হয়েছে)।
 */
export function checkCrackControlSpacing(input: CrackControlCheckInput): CrackControlCheckResult {
  const { barSpacingMm, clearCoverMm, fyMPa, serviceStressMPa } = input;
  const warnings: string[] = [];

  const fs = serviceStressMPa ?? (2 / 3) * fyMPa;

  const option1 = 380 * (280 / fs) - 2.5 * clearCoverMm;
  const option2 = 300 * (280 / fs);
  const maxSpacing = Math.min(option1, option2);

  const adequate = barSpacingMm <= maxSpacing;

  if (!adequate) {
    warnings.push(
      `Provided bar spacing (${barSpacingMm.toFixed(0)}mm) exceeds the ACI 318-19 §24.3.2 limit (${maxSpacing.toFixed(0)}mm) for crack control — reduce spacing (use more, smaller-diameter bars) or increase cover control.`
    );
  }

  return {
    serviceStressMPa: fs,
    maxSpacingMm: maxSpacing,
    adequate,
    warnings,
  };
}
