/**
 * Phase 10o — DCR (Demand/Capacity Ratio) Heat Map color scale।
 *
 * ETABS/SAP2000 এর প্রচলিত convention অনুসরণ করা হয়েছে: green (safe,
 * ratio অনেক কম) → yellow (ratio 1.0 এর কাছাকাছি, adequate কিন্তু
 * margin কম) → red (ratio ≥ 1.0, inadequate — over-utilized)। এটা একটা
 * continuous (piecewise-linear) gradient, discrete bucket না, যাতে
 * ছোট পার্থক্যও visually ধরা পড়ে।
 *
 * ratio 0 এ pure green (#22c55e), ratio 0.7 এ yellow (#eab308) এ
 * transition শুরু (কারণ 0.7+ একটা সাধারণ engineering "watch zone"
 * থ্রেশহোল্ড), ratio 1.0+ এ pure red (#ef4444, "inadequate")। 1.0 এর
 * উপরে আরও বাড়লেও red-ই থাকে (saturate করে, আরও গাঢ় হয় না — কারণ
 * "কতটা worse" এর চেয়ে "inadequate কিনা" এটাই মূল বার্তা এই heat map
 * এর উদ্দেশ্য)।
 */

const COLOR_SAFE: [number, number, number] = [0x22, 0xc5, 0x5e]; // green
const COLOR_WATCH: [number, number, number] = [0xea, 0xb3, 0x08]; // yellow
const COLOR_OVER: [number, number, number] = [0xef, 0x44, 0x44]; // red

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function toHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((c) => Math.round(c).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** একটা DCR ratio কে heat-map hex color এ রূপান্তর করে (green→yellow→red)। */
export function dcrRatioToColor(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio < 0) return toHex(COLOR_SAFE);
  if (ratio <= 0.7) {
    const t = ratio / 0.7;
    return toHex([
      lerp(COLOR_SAFE[0], COLOR_WATCH[0], t),
      lerp(COLOR_SAFE[1], COLOR_WATCH[1], t),
      lerp(COLOR_SAFE[2], COLOR_WATCH[2], t),
    ]);
  }
  if (ratio <= 1.0) {
    const t = (ratio - 0.7) / 0.3;
    return toHex([
      lerp(COLOR_WATCH[0], COLOR_OVER[0], t),
      lerp(COLOR_WATCH[1], COLOR_OVER[1], t),
      lerp(COLOR_WATCH[2], COLOR_OVER[2], t),
    ]);
  }
  return toHex(COLOR_OVER);
}
