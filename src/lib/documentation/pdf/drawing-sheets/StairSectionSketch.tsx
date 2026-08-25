/**
 * StairSectionSketch — Stair implementation gap-closing pass (২০২৬-০৮)
 *
 * SectionCutSketch.tsx (Phase 11h) সদস্য cross-section (width × depth,
 * bar placement) আঁকে — একটা stair flight-এর vertical *elevation*
 * (waist slab + sawtooth ধাপ প্রোফাইল, riser/going dimension) আঁকার
 * জন্য উপযুক্ত না, তাই আলাদা ফাইল, কিন্তু একই SVG primitive/color/
 * font convention অনুসরণ করে (pdfColors, Helvetica caption)।
 *
 * ডেটা সোর্স, honest ভিত্তিতে:
 *   - waist slab slope line (bottom-to-top): stairGeometry.ts এর
 *     StairFlightGeometry (horizontalRunM, verticalRiseM, slopeLengthM,
 *     slopeAngleRad) — element.vertices থেকে সরাসরি derive, কোনো ধরে
 *     নেওয়া নেই।
 *   - waist slab thickness: element.thickness (mm) — perpendicular to
 *     slope রেখা হিসেবে আঁকা হয়েছে, waist slab-এর প্রকৃত geometric
 *     সংজ্ঞা অনুযায়ী (vertical thickness না)।
 *   - ধাপের সংখ্যা: element.numberOfSteps (StairElement, ২০২৬-০৮ এ
 *     mapStair() থেকে সরাসরি বসে — Draw-এর DrawStairFlight এ ছিল)।
 *     undefined হলে সঠিক sawtooth আঁকা যায় না (riser height জানা থাকলেও
 *     ঠিক কয়টা ধাপ তা নিশ্চিত না) — সেক্ষেত্রে শুধু waist slab-এর plain
 *     slope রেখা আঁকা হয় (কোনো ধাপ ছাড়া), caption এ স্পষ্ট জানানো হয়
 *     যে ধাপ সংখ্যা অজানা বলে schematic, সঠিক sawtooth অনুমান করে দেখানো
 *     হয়নি।
 *   - প্রতিটা ধাপের going (অনুভূমিক দৈর্ঘ্য): horizontalRunM ÷
 *     numberOfSteps দিয়ে সমান ভাগ করা হয়েছে (numberOfSteps-টা steps না
 *     risers ধরে — অর্থাৎ flight-এর শেষ riser উপরের landing/floor-এর
 *     নিজস্ব edge-এ মিলিয়ে যায়, going বিভাজন risers-এর সংখ্যার সমান
 *     ভাগে — এটাই standard stair convention, riser সংখ্যা = going
 *     সংখ্যা + ১ ধরারও একটা প্রচলিত বিকল্প আছে কিন্তু DrawStairFlight-এ
 *     আলাদা treadCount ফিল্ড না থাকায় numberOfSteps-কেই risers/goings
 *     উভয়ের approximate সংখ্যা ধরা হয়েছে, minor visual approximation,
 *     dimension label-এ riser height এর প্রকৃত সংখ্যা (element.riserHeightM)
 *     সঠিকভাবেই আলাদা দেখানো হয়)।
 */

import { Svg, Path, Line, Text as SvgText, Text, View, StyleSheet } from "@react-pdf/renderer";
import { pdfColors, pdfFontSize } from "@/lib/documentation/pdf/theme";
import type { StairFlightGeometry } from "@/lib/design/stairGeometry";

export interface StairSectionSketchProps {
  geometry: StairFlightGeometry;
  thicknessMm: number;
  numberOfSteps?: number;
  riserHeightM?: number;
  label?: string;
}

const DRAW_WIDTH = 220;
const DRAW_HEIGHT = 130;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
  },
  caption: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    marginTop: 2,
  },
});

export function StairSectionSketch({ geometry, thicknessMm, numberOfSteps, riserHeightM, label }: StairSectionSketchProps) {
  const margin = 20;
  const boxW = DRAW_WIDTH - margin * 2;
  const boxH = DRAW_HEIGHT - margin * 2 - 16;

  const scale = Math.min(boxW / geometry.horizontalRunM, boxH / geometry.verticalRiseM);
  const runPx = geometry.horizontalRunM * scale;
  const risePx = geometry.verticalRiseM * scale;
  const thicknessPx = (thicknessMm / 1000) * scale;

  const originX = margin;
  const bottomY = margin + boxH; // নিচের প্রান্ত — SVG y নিচের দিকে বাড়ে, তাই bottom বেশি y
  const topY = bottomY - risePx;
  const topX = originX + runPx;

  // waist slab-এর নিচের ও উপরের রেখা (slope বরাবর, thickness perpendicular
  // অফসেট করে) — dx/dy slope line-এর unit normal
  const dx = topX - originX;
  const dy = topY - bottomY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * thicknessPx;
  const ny = (dx / len) * thicknessPx;

  const bottomLineStart = { x: originX, y: bottomY };
  const bottomLineEnd = { x: topX, y: topY };
  const topLineStart = { x: originX + nx, y: bottomY + ny };
  const topLineEnd = { x: topX + nx, y: topY + ny };

  const hasSteps = Number.isFinite(numberOfSteps) && (numberOfSteps as number) > 0;
  const stepCount = hasSteps ? Math.round(numberOfSteps as number) : 0;

  // sawtooth ধাপ পথ — waist slab-এর উপরের রেখা (topLineStart→topLineEnd)
  // বরাবর প্রতিটা going-এ vertical riser + horizontal tread যোগ করে।
  let sawtoothPath = "";
  if (hasSteps) {
    const stepRunPx = runPx / stepCount;
    const stepRisePx = risePx / stepCount;
    let cx = topLineStart.x;
    let cy = topLineStart.y;
    sawtoothPath = `M ${cx} ${cy}`;
    for (let i = 0; i < stepCount; i++) {
      cy -= stepRisePx; // riser — উপরে
      sawtoothPath += ` L ${cx} ${cy}`;
      cx += stepRunPx; // tread — অনুভূমিক
      sawtoothPath += ` L ${cx} ${cy}`;
    }
  }

  return (
    <View style={styles.wrapper}>
      <Svg width={DRAW_WIDTH} height={DRAW_HEIGHT} viewBox={`0 0 ${DRAW_WIDTH} ${DRAW_HEIGHT}`}>
        {/* waist slab নিচের রেখা */}
        <Line
          x1={bottomLineStart.x}
          y1={bottomLineStart.y}
          x2={bottomLineEnd.x}
          y2={bottomLineEnd.y}
          stroke={pdfColors.ink}
          strokeWidth={1.3}
        />
        {/* waist slab শুরু/শেষ প্রান্ত (thickness বরাবর) */}
        <Line
          x1={bottomLineStart.x}
          y1={bottomLineStart.y}
          x2={topLineStart.x}
          y2={topLineStart.y}
          stroke={pdfColors.ink}
          strokeWidth={1}
        />
        <Line
          x1={bottomLineEnd.x}
          y1={bottomLineEnd.y}
          x2={topLineEnd.x}
          y2={topLineEnd.y}
          stroke={pdfColors.ink}
          strokeWidth={1}
        />
        {/* উপরের রেখা — ধাপ থাকলে sawtooth, না থাকলে plain slope */}
        {hasSteps ? (
          <Path d={sawtoothPath} stroke={pdfColors.ink} strokeWidth={1.3} fill="none" />
        ) : (
          <Line
            x1={topLineStart.x}
            y1={topLineStart.y}
            x2={topLineEnd.x}
            y2={topLineEnd.y}
            stroke={pdfColors.ink}
            strokeWidth={1.3}
            strokeDasharray="3,2"
          />
        )}

        {/* rise dimension — বামে */}
        <Line x1={originX - 6} y1={bottomY} x2={originX - 6} y2={topY} stroke={pdfColors.inkMuted} strokeWidth={0.5} />
        <SvgText
          x={originX - 9}
          y={(bottomY + topY) / 2}
          style={{ fontSize: 6 }}
          fill={pdfColors.inkMuted}
          textAnchor="end"
        >
          {geometry.verticalRiseM.toFixed(2)}m
        </SvgText>

        {/* run dimension — নিচে */}
        <Line x1={originX} y1={bottomY + 8} x2={topX} y2={bottomY + 8} stroke={pdfColors.inkMuted} strokeWidth={0.5} />
        <SvgText x={(originX + topX) / 2} y={bottomY + 15} style={{ fontSize: 6 }} fill={pdfColors.inkMuted} textAnchor="middle">
          {geometry.horizontalRunM.toFixed(2)}m
        </SvgText>
      </Svg>
      {label && <Text style={styles.caption}>{label}</Text>}
      <Text style={styles.caption}>
        Slope {geometry.slopeLengthM.toFixed(2)}m @ {((geometry.slopeAngleRad * 180) / Math.PI).toFixed(0)}° · Waist{" "}
        {thicknessMm}mm
        {riserHeightM ? ` · Riser ${Math.round(riserHeightM * 1000)}mm` : ""}
        {hasSteps ? ` · ${stepCount} risers` : ""}
      </Text>
      {!hasSteps && (
        <Text style={styles.caption}>Step count unknown — waist slab slope shown schematically, without sawtooth.</Text>
      )}
    </View>
  );
}
