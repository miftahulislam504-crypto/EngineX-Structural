/**
 * StairPlanSectionSheet — Stair implementation Phase 4 (২০২৬-০৮), S-18
 *
 * sheetIndex.ts এ S-18 ("Stair Plan & Section, Landing Beam (LB)
 * Details") এতদিন `dataStatus: "unmodeled"` ছিল — কোনো stair design
 * module-ই ছিল না বলে UnmodeledSheetPlaceholder.tsx দিয়ে honest
 * placeholder দেখানো হতো। Phase 1-3 (self-weight derivation, stair
 * design module, StairDesignPanel.tsx) দিয়ে এখন waist-slab flight
 * design data বাস্তবে আছে — তাই এই ফাইল ColumnScheduleSheet.tsx
 * (schedule table) আর RoofFloorSlabLayoutEWSheet.tsx (SlabOutlineSketch
 * প্ল্যান) এর প্যাটার্ন মিলিয়ে একটা real S-18 বানায়।
 *
 * dataStatus তবু "full" না, "partial" — কারণ:
 *   (1) Landing (মূল sheet title-এর "Landing Beam (LB) Details" অংশ)
 *       কোনো element হিসেবেই import হয় না (hub-geometry-parser.ts এর
 *       mapStair() কমেন্ট — Draw landing কে flight geometry-র বাইরে
 *       আলাদা করে পাঠায় না) — তাই landing beam schedule/detail এখানে
 *       সম্পূর্ণ বাদ, honest note হিসেবে জানানো হয়েছে।
 *   (2) Section cut (সিঁড়ির vertical section view, riser/going bar
 *       diagram) SectionCutSketch.tsx এর মতো একটা dedicated stair
 *       section sketch দাবি করে যা এই Phase এ বানানো হয়নি (plan +
 *       schedule table দিয়েই মূল gap পূরণ হয় — riser/going/slope/As
 *       সব সংখ্যা schedule এ আছে) — ভবিষ্যতে একটা StairSectionSketch.tsx
 *       যোগ করা যেতে পারে, আপাতত সেই অংশ sheet এর নোটে honestly gap
 *       হিসেবে রাখা হলো।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { ReportTable, type ReportTableColumn } from "@/lib/documentation/pdf/components/ReportTable";
import { SlabOutlineSketch, type SlabPolygon } from "@/lib/documentation/pdf/drawing-sheets/SlabOutlineSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { asStairDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { SHEET_INDEX } from "@/lib/documentation/pdf/drawing-sheets/sheetIndex";
import type { StairElement } from "@/lib/types/element";

export interface StairPlanSectionSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

interface StairScheduleRow {
  label: string;
  thicknessText: string;
  slopeText: string;
  riserText: string;
  loadText: string;
  reinforcementText: string;
  statusText: string;
}

const columns: ReportTableColumn<StairScheduleRow>[] = [
  { key: "label", header: "Flight Mark", flex: 1 },
  { key: "thicknessText", header: "Waist Thk.", flex: 1, align: "right" },
  { key: "slopeText", header: "Slope Span / Angle", flex: 1.4, align: "right" },
  { key: "riserText", header: "Riser", flex: 0.8, align: "right" },
  { key: "loadText", header: "wu (kN/m²)", flex: 1, align: "right" },
  { key: "reinforcementText", header: "As+ / As-", flex: 1.4, align: "right" },
  { key: "statusText", header: "Status", flex: 0.8, align: "center" },
];

export function StairPlanSectionSheetContent({ context, revisionNumber }: StairPlanSectionSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const entry = SHEET_INDEX.find((s) => s.sheetNumber === "S-18");

  const stairElements = context.elements.filter((e): e is StairElement => e.category === "stair");

  const rows: StairScheduleRow[] = stairElements.map((e) => {
    const result = context.designResults.find((r) => r.elementId === e.elementId);
    const detail = result ? asStairDetail(result.detail) : null;
    const label = resolveElementLabel(context, e.elementId);

    if (!detail) {
      return {
        label,
        thicknessText: `${e.thickness}mm`,
        slopeText: "—",
        riserText: e.riserHeightM ? `${Math.round(e.riserHeightM * 1000)}mm` : "—",
        loadText: "—",
        reinforcementText: "Not yet designed",
        statusText: "—",
      };
    }

    const { report } = detail;
    const asPos = Math.round(report.flexuralDesign.positiveDesign.governingAsMm2);
    const asNeg = report.flexuralDesign.negativeDesign
      ? Math.round(report.flexuralDesign.negativeDesign.governingAsMm2)
      : null;

    return {
      label,
      thicknessText: `${e.thickness}mm`,
      slopeText: `${report.geometry.slopeLengthM.toFixed(2)}m / ${((report.geometry.slopeAngleRad * 180) / Math.PI).toFixed(0)}°`,
      riserText: e.riserHeightM ? `${Math.round(e.riserHeightM * 1000)}mm` : "not set",
      loadText: report.inclinedFactoredLoadKPa.toFixed(1),
      reinforcementText: asNeg ? `${asPos} / ${asNeg} mm²/m` : `${asPos} mm²/m`,
      statusText: report.overallStatus.toUpperCase(),
    };
  });

  const stairPolygons: SlabPolygon[] = stairElements
    .map<SlabPolygon | null>((e) => {
      const vertices = e.vertices.map((v) => ({ x: v.x, z: v.z }));
      if (vertices.length === 0) return null;
      return { label: resolveElementLabel(context, e.elementId), vertices, elementId: e.elementId };
    })
    .filter((s): s is SlabPolygon => s !== null);

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-18"
      sheetTitle="Stair Plan & Section, Landing Beam (LB) Details"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
        Stair Flight Plan (Waist Slab)
      </Text>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginBottom: pdfSpacing.sectionGap }}>
        Plan projection of each modeled flight (waist slab). Design values below are from the Stair Design panel —
        flights without a completed design show geometry/status only.
      </Text>

      {stairPolygons.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted, marginBottom: pdfSpacing.sectionGap }}>
          No stair elements found in the current model.
        </Text>
      ) : (
        <SlabOutlineSketch grids={context.geometry.grids} slabs={stairPolygons} />
      )}

      <Text
        style={{
          fontSize: pdfFontSize.h1,
          fontFamily: "Helvetica-Bold",
          marginTop: pdfSpacing.sectionGap,
          marginBottom: pdfSpacing.sectionGap,
        }}
      >
        Flight Schedule
      </Text>
      {rows.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No stair elements found in the current model.
        </Text>
      ) : (
        <ReportTable<StairScheduleRow> columns={columns} rows={rows} />
      )}

      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: pdfSpacing.sectionGap }}>
        {entry?.limitationNote ??
          "Landing beam (LB) schedule/details and a dedicated vertical section-cut view are not yet produced by this application — landings are not imported as a separate modeled element (Draw exports flight geometry only), and no section sketch exists for stairs yet. Add landing beam and section details manually before issue."}
      </Text>
    </ReportSheetPage>
  );
}

export function StairPlanSectionSheet(props: StairPlanSectionSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Stair Plan & Section`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <StairPlanSectionSheetContent {...props} />
    </Document>
  );
}
