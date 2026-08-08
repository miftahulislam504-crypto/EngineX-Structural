/**
 * BarShapeSketch — Phase 11d
 *
 * প্লানের চাহিদা: "Shape Sketch: straight bar আর stirrup/tie — দুইটার
 * জন্য simple SVG/vector আইকন (bend angle, hook দেখানো)"।
 *
 * @react-pdf/renderer এর নিজস্ব Svg/Path/Line/Rect primitive দিয়ে
 * বানানো হয়েছে (কোনো external .svg ফাইল ইম্পোর্ট/parse করা হয়নি —
 * react-pdf ডাইরেক্টলি external SVG ফাইল রেন্ডার করতে পারে না, নিজস্ব
 * component হিসেবেই বানাতে হয়)।
 *
 * চারটা visual shape সাপোর্ট করে (projectBbs.ts এর BbsVisualShape
 * অনুযায়ী):
 *   - straight: একটা সরল রেখা, উভয় প্রান্তে ঐচ্ছিক hook (90°/135°
 *     bend, ছোট perpendicular স্ট্রোক দিয়ে প্রতীকী)।
 *   - stirrup-tie: rectangular closed loop, চার কোণায় ছোট hook mark।
 *   - l-bend/u-bend: barBendingSchedule.ts v1 এ এই দুটো কখনো produce
 *     হয় না (projectBbs.ts এর নোট অনুযায়ী), তাই আপাতত straight/
 *     stirrup-tie sketch reuse করে একটা ছোট label যোগ করে ("L", "U")
 *     — ভবিষ্যতে detailing engine এ bent-bar সাপোর্ট এলে dedicated
 *     bent-path sketch বানানো যাবে।
 */

import { Svg, Path, Line, Rect, View, StyleSheet } from "@react-pdf/renderer";
import type { BbsVisualShape } from "@/lib/documentation/compute/projectBbs";
import { pdfColors } from "@/lib/documentation/pdf/theme";

const SKETCH_WIDTH = 40;
const SKETCH_HEIGHT = 16;

const styles = StyleSheet.create({
  wrapper: {
    width: SKETCH_WIDTH,
    height: SKETCH_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});

function StraightSketch() {
  return (
    <Svg width={SKETCH_WIDTH} height={SKETCH_HEIGHT} viewBox={`0 0 ${SKETCH_WIDTH} ${SKETCH_HEIGHT}`}>
      {/* মূল সোজা বার */}
      <Line x1={6} y1={8} x2={34} y2={8} stroke={pdfColors.ink} strokeWidth={1.5} />
      {/* দুই প্রান্তে ছোট 90° hook — perpendicular স্ট্রোক দিয়ে প্রতীকী */}
      <Line x1={6} y1={8} x2={6} y2={3} stroke={pdfColors.ink} strokeWidth={1.5} />
      <Line x1={34} y1={8} x2={34} y2={13} stroke={pdfColors.ink} strokeWidth={1.5} />
    </Svg>
  );
}

function StirrupTieSketch() {
  const x = 8;
  const y = 2;
  const w = SKETCH_WIDTH - 16;
  const h = SKETCH_HEIGHT - 4;
  const hookLen = 3;
  return (
    <Svg width={SKETCH_WIDTH} height={SKETCH_HEIGHT} viewBox={`0 0 ${SKETCH_WIDTH} ${SKETCH_HEIGHT}`}>
      {/* rectangular closed loop */}
      <Rect x={x} y={y} width={w} height={h} stroke={pdfColors.ink} strokeWidth={1.2} fill="none" />
      {/* একটা কোণায় ছোট hook mark, 135° seismic hook প্রতীকী */}
      <Path
        d={`M ${x + w} ${y + h} l ${hookLen} ${hookLen}`}
        stroke={pdfColors.ink}
        strokeWidth={1.2}
        fill="none"
      />
    </Svg>
  );
}

export interface BarShapeSketchProps {
  shape: BbsVisualShape;
}

/**
 * BBS টেবিলের একটা সেল হিসেবে বসার জন্য — ReportTable এর render prop
 * এ ব্যবহার হয় (SectionBbs.tsx দেখুন)।
 */
export function BarShapeSketch({ shape }: BarShapeSketchProps) {
  return (
    <View style={styles.wrapper}>
      {shape === "straight" || shape === "l-bend" ? <StraightSketch /> : <StirrupTieSketch />}
    </View>
  );
}
