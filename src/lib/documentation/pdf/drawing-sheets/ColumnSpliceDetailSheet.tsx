/**
 * ColumnSpliceDetailSheet — Report-Audit Phase B3 (S-21, 2026-08-20)
 *
 * প্রতিটা column element এর জন্য: starter/dowel bar compression
 * development length ও compression lap splice length — ACI 318-19
 * §25.4.9.2/§25.4.9.3 (computeCompressionDevelopmentLength) ও
 * §25.5.5.1 (computeCompressionLapSpliceLength), lib/design/
 * developmentLength.ts থেকে reuse — এই একই ফাংশন এখন পর্যন্ত শুধু
 * generalNotes.ts এ একটা generic bar-diameter reference table বানাতে
 * ব্যবহৃত হতো (project এ ব্যবহৃত সব diameter এর জন্য, element-নির্দিষ্ট
 * না) — এই sheet প্রথমবার প্রতিটা column এর নিজস্ব bar diameter/fy/fc
 * দিয়ে per-element splice length বের করে।
 *
 * column length — element এর নিজস্ব geometry (computeLineElementLength)
 * থেকে, story height থেকে না (StructuralStory.height সাধারণত একই হয়,
 * কিন্তু element এর নিজের startPoint/endPoint বেশি সরাসরি ও নির্ভরযোগ্য
 * সোর্স — কোনো অতিরিক্ত lookup/assumption লাগে না)।
 *
 * honest সীমাবদ্ধতা:
 *   - Splice location (মেঝে থেকে ঠিক কত উপরে splice করা উচিত) এই
 *     sheet এ সংখ্যা আকারে দেওয়া হয়নি — এটা ইঞ্জিনিয়ারের নিজস্ব
 *     সিদ্ধান্ত (সাধারণত potential plastic hinge zone এড়িয়ে), এই
 *     কোডবেসে কোনো "recommended splice location" calculator নেই এবং
 *     কোনো নির্দিষ্ট code clause citation invent করা হয়নি — শুধু
 *     required splice LENGTH (কত mm lap হতে হবে) দেখানো হয়েছে, যেটা
 *     সরাসরি ACI ফর্মুলা থেকে আসে।
 *   - Tie/spiral confinement এর প্রভাব (hasSpiralOrTieConfinement,
 *     compression development length ×0.75) এই sheet এ ধরা হয়নি —
 *     ColumnCalcDetail.input এ এই বুলিয়ান ফিল্ড confirm করা যায়নি
 *     (RcColumnDesignInput এ tieDiameterMm/providedTieSpacingMm আছে
 *     কিন্তু "confinement adequate for §25.4.9.3" এমন derived boolean
 *     নেই) — তাই conservative (confinement ছাড়া) মান দেখানো হয়েছে,
 *     যা বাস্তব প্রয়োজনের চেয়ে বড় বা সমান (নিরাপদ দিকে ভুল)।
 *   - design result না থাকা column এর জন্য "—" (Column Schedule এর
 *     একই honest fallback প্যাটার্ন)।
 */

import { Document, Text, View, StyleSheet, Svg, Rect, Line, Text as SvgText } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { ReportTable, type ReportTableColumn } from "@/lib/documentation/pdf/components/ReportTable";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { ColumnElement } from "@/lib/types/element";
import { computeLineElementLength } from "@/lib/types/element";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { asColumnDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";
import {
  computeCompressionDevelopmentLength,
  computeCompressionLapSpliceLength,
} from "@/lib/design/developmentLength";

export interface ColumnSpliceDetailSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

interface ScheduleRow {
  label: string;
  heightText: string;
  barDiameterText: string;
  starterDevelopmentLengthText: string;
  lapSpliceLengthText: string;
}

const columns: ReportTableColumn<ScheduleRow>[] = [
  { key: "label", header: "Column Mark", flex: 1 },
  { key: "heightText", header: "Column Height", flex: 1, align: "right" },
  { key: "barDiameterText", header: "Longitudinal Bar", flex: 1, align: "right" },
  { key: "starterDevelopmentLengthText", header: "Starter Dev. Length (compression)", flex: 1, align: "right" },
  { key: "lapSpliceLengthText", header: "Lap Splice Length (compression)", flex: 1, align: "right" },
];

const SCHEMATIC_WIDTH = 160;
const SCHEMATIC_HEIGHT = 220;
const schematicStyles = StyleSheet.create({
  wrapper: { alignItems: "center", marginBottom: pdfSpacing.sectionGap },
  caption: { fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 4, textAlign: "center", maxWidth: 300 },
});

/** একটা generic column-splice schematic — নির্দিষ্ট কোনো column এর জন্য না, শুধু "starter bar / splice zone / continuing bar" ধারণা বোঝানোর জন্য একটা elevation আইকন। */
function ColumnSpliceSchematic() {
  const colX = SCHEMATIC_WIDTH / 2 - 20;
  const colWidth = 40;
  const floorY = SCHEMATIC_HEIGHT - 20;
  const topY = 20;
  const spliceZoneTop = floorY - 90;
  const spliceZoneBottom = floorY - 40;

  return (
    <View style={schematicStyles.wrapper}>
      <Svg width={SCHEMATIC_WIDTH} height={SCHEMATIC_HEIGHT} viewBox={`0 0 ${SCHEMATIC_WIDTH} ${SCHEMATIC_HEIGHT}`}>
        {/* Floor slab line */}
        <Line x1={10} y1={floorY} x2={SCHEMATIC_WIDTH - 10} y2={floorY} stroke={pdfColors.ink} strokeWidth={1.5} />
        <SvgText x={SCHEMATIC_WIDTH - 8} y={floorY + 10} style={{ fontSize: 6 }} fill={pdfColors.inkMuted} textAnchor="end">
          Floor level
        </SvgText>

        {/* Column outline */}
        <Rect x={colX} y={topY} width={colWidth} height={floorY - topY} stroke={pdfColors.statusInfo} strokeWidth={1} fill="none" />

        {/* Lap splice zone shading */}
        <Rect
          x={colX + 4}
          y={spliceZoneTop}
          width={colWidth - 8}
          height={spliceZoneBottom - spliceZoneTop}
          fill={pdfColors.hairline}
          fillOpacity={0.5}
        />
        <SvgText x={SCHEMATIC_WIDTH / 2} y={(spliceZoneTop + spliceZoneBottom) / 2} style={{ fontSize: 6 }} fill={pdfColors.ink} textAnchor="middle">
          Lap splice zone
        </SvgText>

        {/* Starter (dowel) bars, from floor up into splice zone */}
        <Line x1={colX + 8} y1={floorY} x2={colX + 8} y2={spliceZoneTop - 5} stroke={pdfColors.ink} strokeWidth={1.2} strokeDasharray="3,2" />
        <Line x1={colX + colWidth - 8} y1={floorY} x2={colX + colWidth - 8} y2={spliceZoneTop - 5} stroke={pdfColors.ink} strokeWidth={1.2} strokeDasharray="3,2" />
        <SvgText x={colX - 4} y={floorY - 15} style={{ fontSize: 6 }} fill={pdfColors.inkMuted} textAnchor="end">
          Starter bar
        </SvgText>

        {/* Continuing (upper story) bars, from splice zone up */}
        <Line x1={colX + 8} y1={spliceZoneBottom + 5} x2={colX + 8} y2={topY} stroke={pdfColors.ink} strokeWidth={1.2} />
        <Line x1={colX + colWidth - 8} y1={spliceZoneBottom + 5} x2={colX + colWidth - 8} y2={topY} stroke={pdfColors.ink} strokeWidth={1.2} />
        <SvgText x={colX + colWidth + 4} y={topY + 15} style={{ fontSize: 6 }} fill={pdfColors.inkMuted}>
          Continuing bar
        </SvgText>
      </Svg>
      <Text style={schematicStyles.caption}>
        Schematic only (not to scale) — illustrates starter/dowel bar, lap splice zone, and continuing bar concept.
        Actual splice location is the engineer&apos;s decision (typically outside the base plastic-hinge zone);
        required lengths are tabulated below per column.
      </Text>
    </View>
  );
}

export function ColumnSpliceDetailSheetContent({ context, revisionNumber }: ColumnSpliceDetailSheetProps) {
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
    const heightM = computeLineElementLength(e);

    if (!detail) {
      return {
        label: resolveElementLabel(context, e.elementId),
        heightText: `${heightM.toFixed(2)} m`,
        barDiameterText: "—",
        starterDevelopmentLengthText: "—",
        lapSpliceLengthText: "—",
      };
    }

    const { barDiameterMm, fyMPa, fcMPa } = {
      barDiameterMm: detail.input.longitudinalBarDiameterMm,
      fyMPa: detail.input.fyMPa,
      fcMPa: detail.input.fcMPa,
    };
    const starterDevelopmentLengthMm = computeCompressionDevelopmentLength({ barDiameterMm, fyMPa, fcMPa });
    const lapSpliceLengthMm = computeCompressionLapSpliceLength({ barDiameterMm, fyMPa, fcMPa }).spliceLengthMm;

    return {
      label: resolveElementLabel(context, e.elementId),
      heightText: `${heightM.toFixed(2)} m`,
      barDiameterText: `⌀${barDiameterMm} mm`,
      starterDevelopmentLengthText: `${Math.round(starterDevelopmentLengthMm)} mm`,
      lapSpliceLengthText: `${Math.round(lapSpliceLengthMm)} mm`,
    };
  });

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-21"
      sheetTitle="Column Starter Bar & Splice Detail"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Column Starter Bar & Splice Detail
      </Text>
      <ColumnSpliceSchematic />
      {rows.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No column elements found in the current model.
        </Text>
      ) : (
        <ReportTable<ScheduleRow> columns={columns} rows={rows} />
      )}
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: 6 }}>
        Lengths per ACI 318-19 §25.4.9.2/§25.4.9.3 (compression development) and §25.5.5.1 (compression lap
        splice), computed conservatively without spiral/tie confinement reduction (this application does not
        currently derive a confinement-adequacy flag from tie spacing).
      </Text>
    </ReportSheetPage>
  );
}

export function ColumnSpliceDetailSheet(props: ColumnSpliceDetailSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Column Starter Bar & Splice Detail`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <ColumnSpliceDetailSheetContent {...props} />
    </Document>
  );
}
