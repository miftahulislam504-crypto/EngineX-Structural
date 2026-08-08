/**
 * SlabOutlineSketch — Phase 11h
 *
 * S-10/S-11/S-15/S-16 (Typical/Roof Floor Slab Reinf. Layout Plan, E-W/
 * N-S) এর জন্য — slab element এর vertices (quantitySummary.ts থেকে
 * কনফার্ম: `{x, z}[]`, horizontal XZ প্লেন) কে grid coordinate এর একই
 * স্কেলে outline হিসেবে আঁকে।
 *
 * <Polygon> primitive @react-pdf/renderer এ export হয় কিনা এই আপলোডে
 * (কোনো node_modules নেই) verify করা যায়নি — তাই নিরাপদে <Path>
 * ব্যবহার করা হয়েছে (BarShapeSketch.tsx তে ইতিমধ্যে কনফার্ম করা কাজ
 * করে), M/L/Z command দিয়ে বন্ধ পলিগন বানিয়ে।
 *
 * বার-ডিরেকশন (E-W vs N-S) অনুযায়ী আলাদা rebar layout এই data model এ
 * সংরক্ষিত না (sheetIndex.ts এর S-10/S-11/S-15/S-16 limitationNote
 * দেখুন) — তাই এই sketch শুধু outline+label দেখায়, bar run আঁকে না।
 */

import { Svg, Path, Text as SvgText, View, StyleSheet, Text } from "@react-pdf/renderer";
import { Fragment } from "react";
import { pdfColors, pdfFontSize } from "@/lib/documentation/pdf/theme";
import type { StructuralGrid } from "@/lib/types/geometry";

export interface SlabPolygon {
  label: string;
  vertices: { x: number; z: number }[];
}

export interface SlabOutlineSketchProps {
  grids: StructuralGrid[];
  slabs: SlabPolygon[];
  width?: number;
  height?: number;
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", marginTop: 6, marginBottom: 6 },
  caption: { fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 4 },
});

export function SlabOutlineSketch({ grids, slabs, width = 720, height = 380 }: SlabOutlineSketchProps) {
  if (grids.length === 0 || slabs.length === 0) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.caption}>No grid or slab data available for this project.</Text>
      </View>
    );
  }

  const directions = Array.from(new Set(grids.map((g) => g.direction)));
  const axisA = grids.filter((g) => g.direction === directions[0]);
  const axisB = directions[1] ? grids.filter((g) => g.direction === directions[1]) : [];

  const allSlabX = slabs.flatMap((s) => s.vertices.map((v) => v.x));
  const allSlabZ = slabs.flatMap((s) => s.vertices.map((v) => v.z));
  const allCoordsA = [...axisA.map((g) => g.coordinate), ...allSlabX];
  const allCoordsB = [...axisB.map((g) => g.coordinate), ...allSlabZ];
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
    return margin + drawH - (coordB - minB) * scaleB;
  }

  function polygonPath(vertices: { x: number; z: number }[]): string {
    if (vertices.length === 0) return "";
    const [first, ...rest] = vertices;
    const start = `M ${toX(first.x)} ${toY(first.z)}`;
    const lines = rest.map((v) => `L ${toX(v.x)} ${toY(v.z)}`).join(" ");
    return `${start} ${lines} Z`;
  }

  return (
    <View style={styles.wrapper}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {axisA.map((g) => (
          <Fragment key={`ga-${g.label}`}>
            <Path
              d={`M ${toX(g.coordinate)} ${margin} L ${toX(g.coordinate)} ${margin + drawH}`}
              stroke={pdfColors.hairline}
              strokeWidth={0.6}
              strokeDasharray="2,2"
            />
            <SvgText x={toX(g.coordinate)} y={margin - 6} style={{ fontSize: 7 }} fill={pdfColors.inkMuted} textAnchor="middle">
              {g.label}
            </SvgText>
          </Fragment>
        ))}
        {axisB.map((g) => (
          <Fragment key={`gb-${g.label}`}>
            <Path
              d={`M ${margin} ${toY(g.coordinate)} L ${margin + drawW} ${toY(g.coordinate)}`}
              stroke={pdfColors.hairline}
              strokeWidth={0.6}
              strokeDasharray="2,2"
            />
            <SvgText x={margin - 8} y={toY(g.coordinate) + 3} style={{ fontSize: 7 }} fill={pdfColors.inkMuted} textAnchor="end">
              {g.label}
            </SvgText>
          </Fragment>
        ))}

        {slabs.map((slab, i) => {
          const cx = slab.vertices.reduce((sum, v) => sum + toX(v.x), 0) / slab.vertices.length;
          const cy = slab.vertices.reduce((sum, v) => sum + toY(v.z), 0) / slab.vertices.length;
          return (
            <Fragment key={i}>
              <Path d={polygonPath(slab.vertices)} stroke={pdfColors.statusInfo} strokeWidth={1.2} fill="none" />
              <SvgText x={cx} y={cy} style={{ fontSize: 7 }} fill={pdfColors.ink} textAnchor="middle">
                {slab.label}
              </SvgText>
            </Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
