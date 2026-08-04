/**
 * BNBC 2020 Design Response Spectrum Generator (frontend পোর্ট)
 *
 * এটা backend এর app/response_spectrum.py এর build_bnbc_2020_spectrum()
 * ফাংশনের হুবহু TypeScript পোর্ট — একই zone/site table, একই সূত্র। মূল
 * ব্যবহার RSA (backend, Phase 4) এর জন্য, কিন্তু Phase 8f Performance-
 * Based Design এ Demand Spectrum হিসেবেও এই একই BNBC 2020 elastic
 * design spectrum ব্যবহার করা হচ্ছে (ATC-40 এর demand spectrum
 * সাধারণত এই ধরনের code-based elastic spectrum দিয়েই শুরু হয়, তারপর
 * effective damping দিয়ে reduce করা হয় — যা এই অ্যাপে এখনো করা হয় না,
 * performanceBasedDesign.ts এর docstring এ ব্যাখ্যা করা)।
 *
 * সততার সাথে সীমাবদ্ধতা (backend module এর থেকে অবিকল একই):
 *   BNBC 2020-এর পূর্ণাঙ্গ Table 6.2.16/6.2.17 এ Fa/Fv আসলে Ss/S1 এর
 *   মান অনুযায়ী নানা ধাপে ভিন্ন (non-linear table lookup) — এখানে
 *   ব্যবহৃত মান টেবিলের কাছাকাছি single-representative মান (moderate
 *   Ss/S1 রেঞ্জের জন্য)।
 *
 * এই ফাইল ও backend এর response_spectrum.py **স্বাধীনভাবে বজায় রাখা
 * হচ্ছে** (আলাদা ভাষা/প্রসেস, shared import সম্ভব না এই architecture
 * এ) — এটা একটা known duplication, single-source-of-truth না। ভবিষ্যতে
 * BNBC টেবিল আপডেট হলে দুই জায়গাতেই আলাদাভাবে আপডেট করতে হবে। এই
 * duplication সিদ্ধান্তটা ইচ্ছাকৃতভাবে backend module এর একই প্যাটার্ন
 * অনুসরণ করছে, নতুন কোনো ঝুঁকি যোগ করছে না।
 */

import type { SeismicZone, SiteClass } from "@/lib/loads/seismicLoad";

const ZONE_SS_S1: Record<SeismicZone, [number, number]> = {
  "1": [0.3, 0.12],
  "2": [0.5, 0.2],
  "3": [0.7, 0.28],
  "4": [0.9, 0.36],
};

const SITE_FA: Record<SiteClass, number> = {
  SA: 0.8,
  SB: 1.0,
  SC: 1.2,
  SD: 1.6,
  SE: 2.5,
};

const SITE_FV: Record<SiteClass, number> = {
  SA: 0.8,
  SB: 1.0,
  SC: 1.6,
  SD: 2.4,
  SE: 3.5,
};

export interface DemandSpectrumPoint {
  periodSeconds: number;
  spectralAccelerationG: number;
}

/**
 * BNBC 2020 design response spectrum (T, Sa) point তালিকা তৈরি করে —
 * backend এর build_bnbc_2020_spectrum() এর সাথে সংখ্যাগতভাবে অভিন্ন।
 */
export function buildBnbc2020DemandSpectrum(
  seismicZone: SeismicZone,
  siteClass: SiteClass,
  numPoints = 60,
  maxPeriodSeconds = 4.0
): DemandSpectrumPoint[] {
  const [ss, s1] = ZONE_SS_S1[seismicZone];
  const fa = SITE_FA[siteClass];
  const fv = SITE_FV[siteClass];

  const sms = fa * ss;
  const sm1 = fv * s1;
  const sds = (2.0 / 3.0) * sms;
  const sd1 = (2.0 / 3.0) * sm1;

  if (sds < 1e-9) {
    return [
      { periodSeconds: 0, spectralAccelerationG: 0 },
      { periodSeconds: maxPeriodSeconds, spectralAccelerationG: 0 },
    ];
  }

  const t0 = 0.2 * (sd1 / sds);
  const ts = sd1 / sds;

  function saAt(t: number): number {
    if (t < 1e-9) return sds * 0.4;
    if (t < t0) return sds * (0.4 + 0.6 * (t / t0));
    if (t <= ts) return sds;
    return sd1 / t;
  }

  const points: DemandSpectrumPoint[] = [];
  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * maxPeriodSeconds;
    points.push({ periodSeconds: t, spectralAccelerationG: saAt(t) });
  }
  return points;
}
