/**
 * Phase 10q — Stress/Strain Contour, honest displacement-magnitude
 * proxy।
 *
 * সততার সাথে সীমাবদ্ধতা: আমাদের shell element (Slab/Wall/Shear-Wall/
 * Core-Wall) এর কোনো real stress/strain recovery নেই backend এ (Phase
 * 4a এর standing limitation — shell.cpp শুধু displacement solve করে,
 * moment/stress post-processing নেই)। তাই এই "contour" আসল stress না
 * — এটা প্রতিটা shell element এর গড় nodal displacement magnitude
 * (|u| = √(ux²+uy²+uz²)) কে রং এ ম্যাপ করে, যেটা একটা মোটামুটি proxy:
 * বেশি deform করা এলাকা সাধারণত বেশি strained হয় (সম্পূর্ণ ভুল না,
 * কিন্তু thickness/material/boundary condition অগ্রাহ্য করে) — এটা
 * ETABS/SAP2000 এর real stress contour এর বিকল্প না, শুধু "কোথায়
 * বেশি নড়ছে" এর একটা visual indicator।
 *
 * Scale: blue (কম displacement) → green → yellow → red (বেশি
 * displacement, ঐ element এর group এর মধ্যে relative — absolute
 * threshold না, কারণ কোনো "সঠিক" stress limit এখানে বোঝানো হচ্ছে না,
 * শুধু "কোনটা বেশি নড়ছে অন্যদের তুলনায়" সেটা)।
 */

const STOPS: { t: number; rgb: [number, number, number] }[] = [
  { t: 0.0, rgb: [0x3b, 0x82, 0xf6] }, // blue
  { t: 0.33, rgb: [0x22, 0xc5, 0x5e] }, // green
  { t: 0.66, rgb: [0xea, 0xb3, 0x08] }, // yellow
  { t: 1.0, rgb: [0xef, 0x44, 0x44] }, // red
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function toHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

/**
 * normalizedMagnitude 0..1 এর মধ্যে হতে হবে (caller কে dataset এর
 * min/max দিয়ে normalize করে দিতে হবে — এই function নিজে normalize
 * করে না, কারণ এটা একটা single-element helper, পুরো dataset এর max
 * জানে না)।
 */
export function stressProxyToColor(normalizedMagnitude: number): string {
  const t = Math.max(0, Math.min(1, normalizedMagnitude));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const localT = (t - a.t) / (b.t - a.t || 1);
      return toHex([
        lerp(a.rgb[0], b.rgb[0], localT),
        lerp(a.rgb[1], b.rgb[1], localT),
        lerp(a.rgb[2], b.rgb[2], localT),
      ]);
    }
  }
  return toHex(STOPS[STOPS.length - 1].rgb);
}
