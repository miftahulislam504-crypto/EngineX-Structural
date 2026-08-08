/**
 * GridLayoutSketch — Phase 11h
 *
 * নতুন shared infrastructure, দ্বিতীয় piece (প্রথমটা SectionCutSketch.tsx)
 * — S.T-02/04/06~07/08/16 (Column/Footing/Grade Beam/Typical Floor Beam/
 * Roof Beam "Layout Plan") এর জন্য। উদ্দেশ্য: GeometryCore.grids
 * (স্থানাঙ্ক-সহ, SectionC_GeneralInformation.tsx থেকে কনফার্ম করা
 * StructuralGrid { label, direction, coordinate }) আর line-element
 * (beam/column, StructuralElement এর startPoint/endPoint, quantitySummary.ts
 * থেকে কনফার্ম করা) — এই দুটো দিয়ে একটা true-to-scale (grid coordinate
 * অনুপাতে) plan sketch আঁকে।
 *
 * honest gap — element.ts আসলে StructuralElement কে category অনুযায়ী
 * discriminated union হিসেবে রাখে (quantitySummary.ts থেকে কনফার্ম):
 * beam/column-ই শুধু startPoint/endPoint (line geometry); slab/
 * mat-foundation vertices পলিগন; isolated footing width/length/thickness
 * রাখে কিন্তু কোনো position/center field এই আপলোডে কোথাও ব্যবহৃত/কনফার্ম
 * হয়নি (grep করে দেখা হয়েছে — কোনো element.position/x/y/z hit নেই)।
 * column-to-footing সম্পর্কও কোনো explicit field (যেমন supportedColumnId)
 * এই কোডবেসে নেই। তাই এই component **শুধু line element (beam/column)**
 * প্লট করে, সঠিক real coordinate দিয়ে — footing/slab কে প্লটে বসানোর
 * চেষ্টা করে না (position অনুমান করে ভুল sketch দেখানোর চেয়ে বাদ দেওয়া
 * ভালো, উপরের memory/conversation এর সিদ্ধান্ত অনুযায়ী)। Footing Layout
 * Plan (S.T-04) sheet তাই এই component ব্যবহার করবে শুধু grid+column
 * marker দেখাতে (কলামের নিচেই সাধারণত footing থাকে, বাস্তবে), সাথে একটা
 * explicit নোট যে footing outline/size নিজে নিজে বসানো হয়নি।
 *
 * grid.direction — শুধু ".localeCompare()" দিয়ে sort করা হয় বাকি
 * কোডবেসে (SectionC_GeneralInformation.tsx), তার literal value ("X"/"Y"
 * নাকি অন্য কিছু) কোথাও কনফার্ম হয়নি। তাই এই component direction এর
 * exact string ধরে নেয় না — grid গুলোকে coordinate অনুযায়ী দুই axis এ
 * ভাগ করতে group-by-unique-direction-value ব্যবহার করা হয়েছে (প্রথম
 * unique value পাওয়া axis vertical লাইন হিসেবে, দ্বিতীয়টা horizontal —
 * এটাও একটা অনুমান, কিন্তু grid label থেকেই ছবিতে দেখা যাবে কোনটা কী,
 * ভুল হলে easily visually-obvious থাকবে, silent data corruption না)।
 *
 * startPoint/endPoint field name — "startPoint"/"endPoint" নাম দুটো
 * এই আপলোডে কোথাও verbatim দেখা যায়নি (শুধু quantitySummary.ts এর
 * কমেন্টে উল্লেখ আছে, প্রকৃত element.ts এই আপলোডে নেই)। তাই
 * `as unknown as {...}` cast দিয়ে defensively পড়া হয়েছে — field
 * না থাকলে/ভিন্ন নাম হলে চুপচাপ undefined হয়ে সেই element স্কিপ হবে
 * (crash না করে), ভুল geometry আঁকার চেয়ে নিরাপদ।
 */

import { Svg, Line, Circle, Text as SvgText, View, StyleSheet, Text } from "@react-pdf/renderer";
import { Fragment } from "react";
import { pdfColors, pdfFontSize } from "@/lib/documentation/pdf/theme";
import type { StructuralGrid } from "@/lib/types/geometry";
import type { StructuralElement } from "@/lib/types/element";

export interface PlanLineElement {
  element: StructuralElement;
  label: string;
  /** true হলে filled circle marker (column, point-like), false হলে line stroke (beam)। */
  isColumn: boolean;
}

export interface GridLayoutSketchProps {
  grids: StructuralGrid[];
  elements: PlanLineElement[];
  /** drawing area — landscape A3 sheet এ পুরো প্রস্থ নেওয়ার জন্য যথেষ্ট বড় ডিফল্ট। */
  width?: number;
  height?: number;
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    marginTop: 6,
    marginBottom: 6,
  },
  caption: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    marginTop: 4,
  },
});

export function GridLayoutSketch({ grids, elements, width = 720, height = 380 }: GridLayoutSketchProps) {
  if (grids.length === 0) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.caption}>No grid data available for this project.</Text>
      </View>
    );
  }

  // coordinate অনুযায়ী দুই axis এ ভাগ — উপরের docblock এর "direction
  // literal অজানা" নোট অনুযায়ী, actual string value না ধরে group-by।
  const directions = Array.from(new Set(grids.map((g) => g.direction)));
  const axisA = grids.filter((g) => g.direction === directions[0]);
  const axisB = directions[1] ? grids.filter((g) => g.direction === directions[1]) : [];

  const allCoordsA = axisA.map((g) => g.coordinate);
  const allCoordsB = axisB.map((g) => g.coordinate);
  const minA = Math.min(...allCoordsA, 0);
  const maxA = Math.max(...allCoordsA, 1);
  const minB = Math.min(...allCoordsB, 0);
  const maxB = Math.max(...allCoordsB, 1);

  const margin = 40;
  const drawW = width - margin * 2;
  const drawH = height - margin * 2;
  const scaleA = drawW / Math.max(maxA - minA, 0.001);
  const scaleB = drawH / Math.max(maxB - minB, 0.001);

  function toX(coordA: number): number {
    return margin + (coordA - minA) * scaleA;
  }
  function toY(coordB: number): number {
    // SVG y নিচের দিকে বাড়ে, plan-view এ সাধারণত উপরের দিকে বাড়ানো
    // স্বাভাবিক — তাই invert করা হয়েছে।
    return margin + drawH - (coordB - minB) * scaleB;
  }

  return (
    <View style={styles.wrapper}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* axis-A grid lines (vertical) */}
        {axisA.map((g) => (
          <Fragment key={`ga-${g.label}`}>
            <Line
              x1={toX(g.coordinate)}
              y1={margin}
              x2={toX(g.coordinate)}
              y2={margin + drawH}
              stroke={pdfColors.hairline}
              strokeWidth={0.6}
              strokeDasharray="2,2"
            />
            <SvgText x={toX(g.coordinate)} y={margin - 6} fontSize={7} fill={pdfColors.inkMuted} textAnchor="middle">
              {g.label}
            </SvgText>
          </Fragment>
        ))}

        {/* axis-B grid lines (horizontal) */}
        {axisB.map((g) => (
          <Fragment key={`gb-${g.label}`}>
            <Line
              x1={margin}
              y1={toY(g.coordinate)}
              x2={margin + drawW}
              y2={toY(g.coordinate)}
              stroke={pdfColors.hairline}
              strokeWidth={0.6}
              strokeDasharray="2,2"
            />
            <SvgText x={margin - 8} y={toY(g.coordinate) + 3} fontSize={7} fill={pdfColors.inkMuted} textAnchor="end">
              {g.label}
            </SvgText>
          </Fragment>
        ))}

        {/* elements — real coordinate থেকে, beam=line stroke, column=filled circle marker */}
        {elements.map((item, i) => {
          const el = item.element as unknown as { startPoint?: { x: number; z: number }; endPoint?: { x: number; z: number } };
          if (!el.startPoint || !el.endPoint) return null;
          const x1 = toX(el.startPoint.x);
          const y1 = toY(el.startPoint.z);
          const x2 = toX(el.endPoint.x);
          const y2 = toY(el.endPoint.z);

          if (item.isColumn) {
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            return (
              <Fragment key={i}>
                <Circle cx={cx} cy={cy} r={4} fill={pdfColors.ink} />
                <SvgText x={cx + 6} y={cy - 4} fontSize={6.5} fill={pdfColors.ink}>
                  {item.label}
                </SvgText>
              </Fragment>
            );
          }
          return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={pdfColors.statusInfo} strokeWidth={1.5} />;
        })}
      </Svg>
    </View>
  );
}
