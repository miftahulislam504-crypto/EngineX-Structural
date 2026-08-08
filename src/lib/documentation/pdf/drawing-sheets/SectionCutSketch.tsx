/**
 * SectionCutSketch — Phase 11h
 *
 * নতুন shared infrastructure — S.T-06~07/09~10/17~18 (Grade Beam/Typical
 * Floor Beam/Roof Beam "Details" sheet) এর জন্য দরকার, কিন্তু 11a-11g
 * এ কোনো cross-section drawing primitive বানানো হয়নি (BarShapeSketch.tsx,
 * Phase 11d, শুধু individual bar shape আইকন — member cross-section
 * outline+bar-placement আঁকে না)। এই কোডবেসে এটাই প্রথম "real geometry
 * থেকে scaled section drawing" — আগের সব PDF output ট্যাবুলার ছিল।
 *
 * ডেটা সোর্স, honest ভিত্তিতে —
 *   - member outline (width × depth): DesignResult.detail.input থেকে
 *     (widthMm/totalDepthMm — detailTypes.ts এ BeamCalcSheet/ColumnCalcSheet
 *     এ ইতিমধ্যে কনফার্ম করা, উপরে দেখুন)।
 *   - bar top/bottom position: আপডেট (ব্যবহারকারীর অনুরোধে, Details
 *     sheet এর accuracy সবচেয়ে গুরুত্বপূর্ণ) — এখন দুই ধাপে চেষ্টা করে:
 *     (1) DetailingResult.longitudinalBars/transverseBars যদি runtime এ
 *     সত্যিই থাকে (defensive optional read, detailing/types.ts এখনও এই
 *     আপলোডে নেই বলে compile-time নিশ্চিত না) — থাকলে সরাসরি সেখান থেকে
 *     position ব্যবহার হয়; (2) না থাকলে schedule (BarScheduleRow[]) এর
 *     barMark এ position suffix খোঁজে — এটা arbitrary অনুমান না,
 *     ব্যবহারকারীর দেওয়া আসল MICON রেফারেন্স ড্রয়িং এ ঠিক এই কনভেনশন
 *     ব্যবহৃত হয়েছে ("Ext." = Extra Top, "Exb."/"Extra Bottom" = Extra
 *     Bottom, "St." = Stirrup/Tie) — তাই barMark এ "T"/"TOP"/"EXT"
 *     দিয়ে শুরু/থাকলে top, "B"/"BTM"/"BOT"/"EXB" থাকলে bottom ধরা
 *     হয়েছে। কোনো mark এ position hint না পাওয়া গেলে (নিশ্চিত করা
 *     যায় না), সেই row কে "unclassified" গণনা করে caption এ আলাদাভাবে
 *     জানানো হয় — জোর করে top বা bottom এ ফেলে দেওয়া হয় না।
 *   - bar-count এ position হিন্ট না পেলে (worst case): fallback হিসেবে
 *     আগের even-split approximation ব্যবহার হয়, কিন্তু caption এ স্পষ্ট
 *     "approximate — position not resolvable" নোট দেখানো হয় যাতে কখনো
 *     ভুল করে নির্ভরযোগ্য মনে না হয়।
 *
 * এই sketch কোনোভাবেই আসল shop-drawing মানের bar-cutting/bend-detail
 * প্রতিস্থাপন করে না — bar count/diameter/top-bottom split এখন সঠিক
 * ডেটা (বা ডেটা থেকে নিশ্চিত inference) থেকে, কিন্তু bar এর within-row
 * exact spacing (cover থেকে ঠিক কত mm) approximate (evenly spaced ধরে
 * নেওয়া, exact spacing algorithm এই কোডবেসে কোথাও নেই)।
 */

import { Svg, Rect, Circle, Line, Text as SvgText, Text, View, StyleSheet } from "@react-pdf/renderer";
import { pdfColors, pdfFontSize } from "@/lib/documentation/pdf/theme";
import type { DetailingResult } from "@/lib/detailing/types";

export interface SectionCutSketchProps {
  /** mm — DesignResult.detail.input.widthMm। */
  widthMm: number;
  /** mm — DesignResult.detail.input.totalDepthMm। */
  depthMm: number;
  detailing: DetailingResult | null;
  /** সেকশনের ক্যাপশন, যেমন "Section A-A" বা "GB-01 (12"x15")"। */
  label?: string;
}

const DRAW_WIDTH = 130;
const DRAW_HEIGHT = 110;
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

interface BarGroup {
  count: number;
  diameterMm: number;
}

interface ClassifiedBars {
  top: BarGroup[];
  bottom: BarGroup[];
  unclassified: BarGroup[];
  stirrupDiameterMm: number | null;
  /** true হলে longitudinalBars/transverseBars (structured, position-confirmed) থেকে পাওয়া গেছে — false হলে schedule barMark হিউরিস্টিক থেকে। */
  fromStructuredFields: boolean;
}

/**
 * DetailingResult.longitudinalBars/transverseBars runtime এ সত্যিই থাকলে
 * তার position ("top"/"bottom" জাতীয় ফিল্ড) ব্যবহার করার চেষ্টা — সম্পূর্ণ
 * defensive, কারণ compile-time এ এই ফিল্ডের shape নিশ্চিত না (উপরের
 * docblock দেখুন)। প্রত্যাশিত shape না মিললে চুপচাপ null রিটার্ন করে
 * caller schedule heuristic এ fall back করে।
 */
function tryStructuredBars(detailing: DetailingResult): ClassifiedBars | null {
  const anyDetailing = detailing as unknown as {
    longitudinalBars?: { position?: string; count?: number; diameterMm?: number }[];
    transverseBars?: { diameterMm?: number }[];
  };
  const longBars = anyDetailing.longitudinalBars;
  if (!longBars || longBars.length === 0) return null;

  const top: BarGroup[] = [];
  const bottom: BarGroup[] = [];
  const unclassified: BarGroup[] = [];
  for (const bar of longBars) {
    if (typeof bar.count !== "number" || typeof bar.diameterMm !== "number") return null; // shape mismatch, bail to heuristic
    const group: BarGroup = { count: bar.count, diameterMm: bar.diameterMm };
    const pos = (bar.position ?? "").toLowerCase();
    if (pos.includes("top")) top.push(group);
    else if (pos.includes("bottom") || pos.includes("btm")) bottom.push(group);
    else unclassified.push(group);
  }

  const stirrupDiameterMm = anyDetailing.transverseBars?.[0]?.diameterMm ?? null;
  return { top, bottom, unclassified, stirrupDiameterMm, fromStructuredFields: true };
}

/**
 * schedule (BarScheduleRow[]) এর barMark এ position suffix খুঁজে top/
 * bottom আলাদা করে — MICON রেফারেন্স ড্রয়িং এর "Ext."/"Exb." কনভেনশন
 * অনুসারে (উপরের docblock দেখুন)।
 */
function classifyFromSchedule(detailing: DetailingResult): ClassifiedBars {
  const top: BarGroup[] = [];
  const bottom: BarGroup[] = [];
  const unclassified: BarGroup[] = [];
  let stirrupDiameterMm: number | null = null;

  for (const row of detailing.schedule) {
    if (row.shape === "stirrup" || row.shape === "tie") {
      stirrupDiameterMm = row.diameterMm;
      continue;
    }
    const mark = row.barMark.toUpperCase();
    const group: BarGroup = { count: row.count, diameterMm: row.diameterMm };
    if (mark.includes("EXT") || mark.startsWith("T") || mark.includes("TOP")) {
      top.push(group);
    } else if (mark.includes("EXB") || mark.startsWith("B") || mark.includes("BOT") || mark.includes("BTM")) {
      bottom.push(group);
    } else {
      unclassified.push(group);
    }
  }

  return { top, bottom, unclassified, stirrupDiameterMm, fromStructuredFields: false };
}

function classifyBars(detailing: DetailingResult | null): ClassifiedBars | null {
  if (!detailing) return null;
  return tryStructuredBars(detailing) ?? classifyFromSchedule(detailing);
}

function sumCount(groups: BarGroup[]): number {
  return groups.reduce((sum, g) => sum + g.count, 0);
}

function describeGroups(groups: BarGroup[]): string {
  return groups.map((g) => `${g.count}-${g.diameterMm}\u00d8`).join(" + ");
}

export function SectionCutSketch({ widthMm, depthMm, detailing, label }: SectionCutSketchProps) {
  const classified = classifyBars(detailing);

  const margin = 18;
  const boxW = DRAW_WIDTH - margin * 2;
  const boxH = DRAW_HEIGHT - margin * 2 - 14;
  const aspectScale = Math.min(boxW / widthMm, boxH / depthMm);
  const rectW = widthMm * aspectScale;
  const rectH = depthMm * aspectScale;
  const rectX = (DRAW_WIDTH - rectW) / 2;
  const rectY = margin;

  const stirrupInset = 5;
  const barRadius = 2.2;

  // unclassified bar থাকলে (position নিশ্চিত করা যায়নি), সেগুলোকে
  // approximate even-split এ top/bottom এ ভাগ করা হয় — কিন্তু caption এ
  // স্পষ্ট জানানো হয় (নিচে), যাতে ভুল করে নির্ভরযোগ্য না মনে হয়।
  const unclassifiedTopCount = classified ? Math.ceil(sumCount(classified.unclassified) / 2) : 0;
  const unclassifiedBottomCount = classified ? sumCount(classified.unclassified) - unclassifiedTopCount : 0;

  const topCount = classified ? sumCount(classified.top) + unclassifiedTopCount : 0;
  const bottomCount = classified ? sumCount(classified.bottom) + unclassifiedBottomCount : 0;

  function barPositions(count: number): number[] {
    if (count <= 0) return [];
    if (count === 1) return [rectX + rectW / 2];
    const usable = rectW - stirrupInset * 2 - barRadius * 2;
    const step = usable / (count - 1);
    return Array.from({ length: count }, (_, i) => rectX + stirrupInset + barRadius + i * step);
  }

  const hasUnclassified = classified ? classified.unclassified.length > 0 : false;

  return (
    <View style={styles.wrapper}>
      <Svg width={DRAW_WIDTH} height={DRAW_HEIGHT} viewBox={`0 0 ${DRAW_WIDTH} ${DRAW_HEIGHT}`}>
        {/* member outline */}
        <Rect x={rectX} y={rectY} width={rectW} height={rectH} stroke={pdfColors.ink} strokeWidth={1.3} fill="none" />

        {/* stirrup — outline থেকে একটু ভিতরে inset, real cover approximate করে */}
        {classified?.stirrupDiameterMm != null && (
          <Rect
            x={rectX + stirrupInset}
            y={rectY + stirrupInset}
            width={rectW - stirrupInset * 2}
            height={rectH - stirrupInset * 2}
            stroke={pdfColors.ink}
            strokeWidth={0.9}
            fill="none"
          />
        )}

        {/* top longitudinal bars */}
        {barPositions(topCount).map((x, i) => (
          <Circle key={`t${i}`} cx={x} cy={rectY + stirrupInset + barRadius + 1} r={barRadius} fill={pdfColors.ink} />
        ))}

        {/* bottom longitudinal bars */}
        {barPositions(bottomCount).map((x, i) => (
          <Circle
            key={`b${i}`}
            cx={x}
            cy={rectY + rectH - stirrupInset - barRadius - 1}
            r={barRadius}
            fill={pdfColors.ink}
          />
        ))}

        {/* dimension line — width, নিচে */}
        <Line x1={rectX} y1={rectY + rectH + 6} x2={rectX + rectW} y2={rectY + rectH + 6} stroke={pdfColors.inkMuted} strokeWidth={0.5} />
        <SvgText x={DRAW_WIDTH / 2} y={rectY + rectH + 13} style={{ fontSize: 6 }} fill={pdfColors.inkMuted} textAnchor="middle">
          {widthMm}mm
        </SvgText>
      </Svg>
      {label && <Text style={styles.caption}>{label}</Text>}
      {!classified ? (
        <Text style={styles.caption}>No detailing data</Text>
      ) : (
        <>
          <Text style={styles.caption}>
            Top: {classified.top.length > 0 ? describeGroups(classified.top) : "—"} · Bottom:{" "}
            {classified.bottom.length > 0 ? describeGroups(classified.bottom) : "—"}
            {classified.stirrupDiameterMm != null ? ` · ${classified.stirrupDiameterMm}\u00d8 stirrup` : ""}
          </Text>
          {hasUnclassified && (
            <Text style={styles.caption}>
              {sumCount(classified.unclassified)} bar(s) had no resolvable top/bottom position —
              split evenly here as an approximation.
            </Text>
          )}
          {!classified.fromStructuredFields && (
            <Text style={styles.caption}>Position inferred from bar mark, not structured data.</Text>
          )}
        </>
      )}
    </View>
  );
}
