/**
 * BeamColumnJointDetailSheet — Report-Audit Phase B5 (S-23, 2026-08-20)
 *
 * honest scope note (গুরুত্বপূর্ণ, সততার সাথে বলা দরকার): এই কোডবেসে
 * কোনো ACI 318-19 Chapter 15/18 জাতীয় formal beam-column JOINT SHEAR
 * capacity check নেই (grep করে যাচাই করা হয়েছে — jointShear,
 * BeamColumnJoint, বা কোনো joint-শব্দযুক্ত design ফাংশন কোথাও পাওয়া
 * যায়নি)। সেই ধরনের নতুন design calculator বানানো একটা সম্পূর্ণ নতুন
 * design-engine feature হবে, Report-Audit Plan এর ঘোষিত scope
 * ("ডকুমেন্টেশন gap পূরণ, বিদ্যমান ডেটা থেকে") এর বাইরে — তাই এখানে
 * কোনো joint-shear-adequacy PASS/FAIL invent করা হয়নি।
 *
 * এর বদলে এই sheet যা দেখায় তা সম্পূর্ণ বিদ্যমান, real ডেটা থেকে:
 * প্রতিটা column এর ACI §18.7.5.1 seismic confinement end-zone
 * (layoutColumnTieZones, lib/design/stirrupTieZones.ts — এই ফাংশনও
 * এখন পর্যন্ত শুধু UI panel এ ব্যবহৃত হতো, কখনো PDF এ আসেনি) —
 * beam-column joint এর ঠিক উপরে/নিচে column tie যেই tighter spacing
 * এ থাকা দরকার সেটাই মূল "joint detail" যা এই application এর ডেটা
 * দিয়ে সততার সাথে দেখানো সম্ভব।
 *
 * useSeismicConfinement — সবসময় true পাস করা হয়েছে (conservative
 * default, tighter/safer spacing দেয়) — Bangladesh BNBC এ সিসমিক
 * design সাধারণত প্রযোজ্য, তাই non-seismic ধরে নেওয়া বেশি ঝুঁকিপূর্ণ।
 * ইঞ্জিনিয়ার এই ধরে নেওয়া override করতে চাইলে StirrupTieZonePanel এ
 * গিয়ে নিজে সেট করতে পারেন — এই sheet এ শুধু note করা আছে।
 */

import { Document, Text, View, StyleSheet, Svg, Rect, Line, Text as SvgText } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { ReportTable, type ReportTableColumn } from "@/lib/documentation/pdf/components/ReportTable";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { ColumnElement } from "@/lib/types/element";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { asColumnDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";
import { layoutColumnTieZones } from "@/lib/design/stirrupTieZones";

export interface BeamColumnJointDetailSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

interface ScheduleRow {
  label: string;
  endZoneLengthText: string;
  endZoneSpacingText: string;
  midZoneSpacingText: string;
}

const columns: ReportTableColumn<ScheduleRow>[] = [
  { key: "label", header: "Column Mark", flex: 1 },
  { key: "endZoneLengthText", header: "Joint Confinement Zone (lo)", flex: 1, align: "right" },
  { key: "endZoneSpacingText", header: "Tie Spacing in Zone", flex: 1, align: "right" },
  { key: "midZoneSpacingText", header: "Mid-Height Tie Spacing", flex: 1, align: "right" },
];

const SCHEMATIC_WIDTH = 200;
const SCHEMATIC_HEIGHT = 160;
const schematicStyles = StyleSheet.create({
  wrapper: { alignItems: "center", marginBottom: pdfSpacing.sectionGap },
  caption: { fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 4, textAlign: "center", maxWidth: 340 },
});

/** Generic beam-column joint schematic — cross-shaped intersection, confinement zone shaded, নির্দিষ্ট কোনো element না। */
function JointSchematic() {
  const colX = SCHEMATIC_WIDTH / 2 - 15;
  const colWidth = 30;
  const beamHeight = 26;
  const jointTop = SCHEMATIC_HEIGHT / 2 - beamHeight / 2;
  const jointBottom = SCHEMATIC_HEIGHT / 2 + beamHeight / 2;

  return (
    <View style={schematicStyles.wrapper}>
      <Svg width={SCHEMATIC_WIDTH} height={SCHEMATIC_HEIGHT} viewBox={`0 0 ${SCHEMATIC_WIDTH} ${SCHEMATIC_HEIGHT}`}>
        {/* Column, full height */}
        <Rect x={colX} y={10} width={colWidth} height={SCHEMATIC_HEIGHT - 20} stroke={pdfColors.statusInfo} strokeWidth={1} fill="none" />
        {/* Beams, left and right, at joint level */}
        <Rect x={10} y={jointTop} width={colX - 10} height={beamHeight} stroke={pdfColors.statusInfo} strokeWidth={1} fill="none" />
        <Rect x={colX + colWidth} y={jointTop} width={SCHEMATIC_WIDTH - 10 - (colX + colWidth)} height={beamHeight} stroke={pdfColors.statusInfo} strokeWidth={1} fill="none" />
        {/* Confinement (joint) zone shading, spans a bit above/below beam depth */}
        <Rect
          x={colX + 3}
          y={jointTop - 14}
          width={colWidth - 6}
          height={beamHeight + 28}
          fill={pdfColors.hairline}
          fillOpacity={0.5}
        />
        <SvgText x={SCHEMATIC_WIDTH / 2} y={jointTop - 18} style={{ fontSize: 6 }} fill={pdfColors.ink} textAnchor="middle">
          Confinement zone (lo)
        </SvgText>
        {/* Tighter tie lines inside the confinement zone */}
        {[jointTop - 10, jointTop - 2, jointBottom + 6, jointBottom + 14].map((y, i) => (
          <Line key={i} x1={colX} y1={y} x2={colX + colWidth} y2={y} stroke={pdfColors.ink} strokeWidth={0.8} />
        ))}
      </Svg>
      <Text style={schematicStyles.caption}>
        Schematic only (not to scale) — beam-column joint with tighter column-tie spacing in the confinement zone
        immediately above/below the joint (ACI 318-19 §18.7.5.1). No formal joint-shear capacity check is performed
        by this application — see note below the table.
      </Text>
    </View>
  );
}

export function BeamColumnJointDetailSheetContent({ context, revisionNumber }: BeamColumnJointDetailSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const columnElements = context.elements.filter((e): e is ColumnElement => e.category === "column");

  const rows: ScheduleRow[] = columnElements.map((e) => {
    const result = context.designResults.find((r) => r.elementId === e.elementId);
    const detail = result ? asColumnDetail(result.detail) : null;

    if (!detail) {
      return {
        label: resolveElementLabel(context, e.elementId),
        endZoneLengthText: "—",
        endZoneSpacingText: "—",
        midZoneSpacingText: "—",
      };
    }

    const zoneResult = layoutColumnTieZones({
      elementLabel: resolveElementLabel(context, e.elementId),
      clearHeightMm: detail.input.unsupportedLengthMm,
      widthMm: detail.input.widthMm,
      totalDepthMm: detail.input.totalDepthMm,
      longitudinalBarDiameterMm: detail.input.longitudinalBarDiameterMm,
      tieDiameterMm: detail.input.tieDiameterMm,
      useSeismicConfinement: true,
    });
    const endZone = zoneResult.zones[0];
    const midZone = zoneResult.zones[1];

    return {
      label: resolveElementLabel(context, e.elementId),
      endZoneLengthText: `${Math.round(endZone.lengthMm)} mm`,
      endZoneSpacingText: `@ ${Math.round(endZone.spacingMm)} mm c/c`,
      midZoneSpacingText: `@ ${Math.round(midZone.spacingMm)} mm c/c`,
    };
  });

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-23"
      sheetTitle="Beam-Column Joint Detail"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Beam-Column Joint Detail
      </Text>
      <JointSchematic />
      {rows.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No column elements found in the current model.
        </Text>
      ) : (
        <ReportTable<ScheduleRow> columns={columns} rows={rows} />
      )}
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 6 }}>
        Confinement zone length and tie spacing per ACI 318-19 §18.7.5.1, assuming seismic detailing applies
        (conservative default — override in the Stirrup/Tie Zone panel if this project is confirmed non-seismic).
        This sheet does NOT include a formal joint-shear capacity check (ACI 318-19 Ch. 15/18) — this application
        does not currently have that calculator; it shows only the column tie confinement requirement at the
        joint, which this application&apos;s data does support.
      </Text>
    </ReportSheetPage>
  );
}

export function BeamColumnJointDetailSheet(props: BeamColumnJointDetailSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Beam-Column Joint Detail`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <BeamColumnJointDetailSheetContent {...props} />
    </Document>
  );
}
