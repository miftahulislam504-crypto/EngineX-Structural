/**
 * ColumnCrossSectionSketch — Report-Audit Phase B4 (2026-08-20)
 *
 * SectionCutSketch.tsx (Beam) থেকে ইচ্ছাকৃতভাবে আলাদা component —
 * সেটা top/bottom bar split ধরে নেয় (moment-critical face concept),
 * কিন্তু Column bar perimeter জুড়ে থাকে (corner + face bars), single
 * tie rectangle, top/bottom কোনো অর্থবহ পার্থক্য নেই। জোর করে reuse
 * করলে ভুল visual metaphor হতো।
 *
 * ডেটা সোর্স — generateColumnDetailing.ts এর longitudinalBars (প্রতিটা
 * bar এর real local (x, z) perimeter position, RebarSegment.startLocal)
 * ও transverseBars[0] (RebarLoop, tie rectangle outline)। এটা
 * DetailingResult থেকে আসে (findDetailingResult() দিয়ে elementId lookup,
 * elementLabel.ts এ কনফার্ম) — design result (RcColumnDesignReport) থেকে
 * bar arrangement আবার re-derive করা হয়নি, কারণ সেই heuristic
 * (selectColumnBarArrangement, required-As ভিত্তিক) ইঞ্জিনিয়ারের
 * চূড়ান্ত bar selection (finalReinforcementSummary) থেকে ভিন্ন হতে
 * পারে — persisted DetailingResult না থাকলে honest fallback ("No
 * detailing data"), অনুমান করে ভুল bar count দেখানো হয় না।
 */

import { Svg, Rect, Circle, Line, Text as SvgText, Text, View, StyleSheet } from "@react-pdf/renderer";
import { pdfColors, pdfFontSize } from "@/lib/documentation/pdf/theme";
import type { DetailingResult } from "@/lib/detailing/types";

export interface ColumnCrossSectionSketchProps {
  /** mm — DesignResult.detail.input.widthMm (local X প্রস্থ)। */
  widthMm: number;
  /** mm — DesignResult.detail.input.totalDepthMm (local Z গভীরতা)। */
  depthMm: number;
  detailing: DetailingResult | null;
  label?: string;
}

const DRAW_WIDTH = 150;
const DRAW_HEIGHT = 150;
const styles = StyleSheet.create({
  wrapper: { alignItems: "center" },
  caption: { fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 2 },
});

export function ColumnCrossSectionSketch({ widthMm, depthMm, detailing, label }: ColumnCrossSectionSketchProps) {
  const margin = 22;
  const boxW = DRAW_WIDTH - margin * 2;
  const boxH = DRAW_HEIGHT - margin * 2 - 14;
  const aspectScale = Math.min(boxW / widthMm, boxH / depthMm);
  const rectW = widthMm * aspectScale;
  const rectH = depthMm * aspectScale;
  const rectX = (DRAW_WIDTH - rectW) / 2;
  const rectY = margin;
  const cx = rectX + rectW / 2;
  const cy = rectY + rectH / 2;

  const longitudinalBars = detailing?.longitudinalBars ?? [];
  const tie = detailing?.transverseBars?.[0] ?? null;
  const barRadius = 2.4;

  return (
    <View style={styles.wrapper}>
      <Svg width={DRAW_WIDTH} height={DRAW_HEIGHT} viewBox={`0 0 ${DRAW_WIDTH} ${DRAW_HEIGHT}`}>
        {/* Column outline */}
        <Rect x={rectX} y={rectY} width={rectW} height={rectH} stroke={pdfColors.ink} strokeWidth={1.3} fill="none" />

        {/* Tie — real polyline থেকে (generateColumnDetailing.ts এ rectangular hoop, local x/z কে drawing coordinate এ ম্যাপ করা) */}
        {tie && (
          <Line
            x1={cx + tie.pointsLocal[0][0] * aspectScale}
            y1={cy - tie.pointsLocal[0][2] * aspectScale}
            x2={cx + tie.pointsLocal[1][0] * aspectScale}
            y2={cy - tie.pointsLocal[1][2] * aspectScale}
            stroke={pdfColors.ink}
            strokeWidth={0.9}
          />
        )}
        {tie &&
          tie.pointsLocal.slice(0, -1).map((p, i) => {
            const next = tie.pointsLocal[i + 1];
            return (
              <Line
                key={i}
                x1={cx + p[0] * aspectScale}
                y1={cy - p[2] * aspectScale}
                x2={cx + next[0] * aspectScale}
                y2={cy - next[2] * aspectScale}
                stroke={pdfColors.ink}
                strokeWidth={0.9}
              />
            );
          })}

        {/* Longitudinal bars — real perimeter position (startLocal[0]=x, startLocal[2]=z) */}
        {longitudinalBars.map((bar) => (
          <Circle
            key={bar.id}
            cx={cx + bar.startLocal[0] * aspectScale}
            cy={cy - bar.startLocal[2] * aspectScale}
            r={barRadius}
            fill={pdfColors.ink}
          />
        ))}

        {/* dimension line — width, নিচে */}
        <Line x1={rectX} y1={rectY + rectH + 6} x2={rectX + rectW} y2={rectY + rectH + 6} stroke={pdfColors.inkMuted} strokeWidth={0.5} />
        <SvgText x={DRAW_WIDTH / 2} y={rectY + rectH + 13} style={{ fontSize: 6 }} fill={pdfColors.inkMuted} textAnchor="middle">
          {widthMm}mm x {depthMm}mm
        </SvgText>
      </Svg>
      {label && <Text style={styles.caption}>{label}</Text>}
      {!detailing ? (
        <Text style={styles.caption}>No detailing data</Text>
      ) : (
        <Text style={styles.caption}>
          {longitudinalBars.length} longitudinal bar(s) @ {longitudinalBars[0]?.diameterMm ?? "—"}mm
          {tie ? ` · ${tie.diameterMm}mm tie` : ""}
        </Text>
      )}
    </View>
  );
}
