/**
 * StairPlanSectionSheet — Stair implementation Phase 4 (২০২৬-০৮), S-18
 *
 * sheetIndex.ts এ S-18 ("Stair Plan & Section, Landing Beam (LB)
 * Details") এতদিন `dataStatus: "unmodeled"` ছিল — কোনো stair design
 * module-ই ছিল না বলে UnmodeledSheetPlaceholder.tsx দিয়ে honest
 * placeholder দেখানো হতো। Phase 1-3 (self-weight derivation, stair
 * design module, StairDesignPanel.tsx) দিয়ে waist-slab flight design
 * data বাস্তবে আছে — এই ফাইল ColumnScheduleSheet.tsx (schedule table)
 * আর RoofFloorSlabLayoutEWSheet.tsx (SlabOutlineSketch প্ল্যান) এর
 * প্যাটার্ন মিলিয়ে real S-18 বানায়।
 *
 * Gap-closing pass (২০২৬-০৮, একই দিন) দুটো জিনিস যোগ করেছে:
 *   (1) Landing স্ল্যাব (mid-run 'turn' platform, LandingElement) —
 *       plan-এ flight-দের পাশে landing outline, নিজস্ব Landing
 *       Schedule টেবিলে thickness/elevation।
 *   (2) Section view (StairSectionSketch.tsx) — প্রতিটা flight-এর
 *       নিচে একটা vertical elevation sketch (waist slab + sawtooth
 *       ধাপ প্রোফাইল, riser/run dimension) — numberOfSteps জানা থাকা
 *       flight-এ সঠিক sawtooth, না থাকলে dashed schematic slope line
 *       (caption এ স্পষ্ট জানানো)।
 *
 * dataStatus তবু "full" না, "partial" — শুধু একটা কারণে এখন:
 *   Landing Beam (মূল sheet title-এর "Landing Beam (LB) Details" অংশ)
 *   কোনো element হিসেবেই আসে না — এবং এটা আসলে derivable কোনো geometry
 *   না। EngineXDraw একটা architectural drawing tool, এতে "landing
 *   beam" বলে কোনো concept-ই নেই (Landing স্ল্যাবের ঠিক কোন কিনারায়
 *   সাপোর্ট বীম বসবে, সেটা একটা structural engineering সিদ্ধান্ত,
 *   architectural geometry থেকে auto-derive করার মতো কিছু না)। বাস্তব
 *   সমাধান: ইঞ্জিনিয়ার landing-এর সাপোর্টিং edge-এ একটা সাধারণ RC Beam
 *   element হিসেবে বসিয়ে RC Beam Design panel দিয়ে ডিজাইন করবেন — এই
 *   App-এ landing beam-এর জন্য আলাদা কোনো feature কখনো বানানো সম্ভব না
 *   (Draw-এর কাছে সেই ডেটাই নেই), এটা একটা permanent, honest
 *   limitation, "ভবিষ্যতে Phase" না।
 */

import { Document, Text, View } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { ReportTable, type ReportTableColumn } from "@/lib/documentation/pdf/components/ReportTable";
import { SlabOutlineSketch, type SlabPolygon } from "@/lib/documentation/pdf/drawing-sheets/SlabOutlineSketch";
import { StairSectionSketch } from "@/lib/documentation/pdf/drawing-sheets/StairSectionSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { asStairDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";
import { deriveStairFlightGeometry } from "@/lib/design/stairGeometry";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { SHEET_INDEX } from "@/lib/documentation/pdf/drawing-sheets/sheetIndex";
import type { StairElement, LandingElement } from "@/lib/types/element";

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

interface LandingScheduleRow {
  label: string;
  thicknessText: string;
  elevationText: string;
}

const stairColumns: ReportTableColumn<StairScheduleRow>[] = [
  { key: "label", header: "Flight Mark", flex: 1 },
  { key: "thicknessText", header: "Waist Thk.", flex: 1, align: "right" },
  { key: "slopeText", header: "Slope Span / Angle", flex: 1.4, align: "right" },
  { key: "riserText", header: "Riser", flex: 0.8, align: "right" },
  { key: "loadText", header: "wu (kN/m²)", flex: 1, align: "right" },
  { key: "reinforcementText", header: "As+ / As-", flex: 1.4, align: "right" },
  { key: "statusText", header: "Status", flex: 0.8, align: "center" },
];

const landingColumns: ReportTableColumn<LandingScheduleRow>[] = [
  { key: "label", header: "Landing Mark", flex: 1.5 },
  { key: "thicknessText", header: "Thickness", flex: 1, align: "right" },
  { key: "elevationText", header: "Elevation (from floor)", flex: 1.5, align: "right" },
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
  const landingElements = context.elements.filter((e): e is LandingElement => e.category === "stair-landing");

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

  const landingRows: LandingScheduleRow[] = landingElements.map((e) => ({
    label: resolveElementLabel(context, e.elementId),
    thicknessText: `${e.thickness}mm`,
    elevationText: `${e.elevation.toFixed(2)}m`,
  }));

  const stairPolygons: SlabPolygon[] = stairElements
    .map<SlabPolygon | null>((e) => {
      const vertices = e.vertices.map((v) => ({ x: v.x, z: v.z }));
      if (vertices.length === 0) return null;
      return { label: resolveElementLabel(context, e.elementId), vertices, elementId: e.elementId };
    })
    .filter((s): s is SlabPolygon => s !== null);

  const landingPolygons: SlabPolygon[] = landingElements
    .map<SlabPolygon | null>((e) => {
      const vertices = e.vertices.map((v) => ({ x: v.x, z: v.z }));
      if (vertices.length === 0) return null;
      return { label: resolveElementLabel(context, e.elementId), vertices, elementId: e.elementId };
    })
    .filter((s): s is SlabPolygon => s !== null);

  const allPolygons = [...stairPolygons, ...landingPolygons];

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
        Stair Flight & Landing Plan
      </Text>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginBottom: pdfSpacing.sectionGap }}>
        Plan projection of each modeled flight (waist slab) and mid-run landing. Design values below are from the
        Stair Design panel — flights without a completed design show geometry/status only.
      </Text>

      {allPolygons.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted, marginBottom: pdfSpacing.sectionGap }}>
          No stair elements found in the current model.
        </Text>
      ) : (
        <SlabOutlineSketch grids={context.geometry.grids} slabs={allPolygons} />
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
        <ReportTable<StairScheduleRow> columns={stairColumns} rows={rows} />
      )}

      <Text
        style={{
          fontSize: pdfFontSize.h1,
          fontFamily: "Helvetica-Bold",
          marginTop: pdfSpacing.sectionGap,
          marginBottom: pdfSpacing.sectionGap,
        }}
      >
        Flight Sections
      </Text>
      {stairElements.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No stair elements found in the current model.
        </Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {stairElements.map((e) => {
            const geometry = deriveStairFlightGeometry(e);
            if (!geometry) return null;
            return (
              <StairSectionSketch
                key={e.elementId}
                geometry={geometry}
                thicknessMm={e.thickness}
                numberOfSteps={e.numberOfSteps}
                riserHeightM={e.riserHeightM}
                label={resolveElementLabel(context, e.elementId)}
              />
            );
          })}
        </View>
      )}

      <Text
        style={{
          fontSize: pdfFontSize.h1,
          fontFamily: "Helvetica-Bold",
          marginTop: pdfSpacing.sectionGap,
          marginBottom: pdfSpacing.sectionGap,
        }}
      >
        Landing Schedule
      </Text>
      {landingRows.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No mid-run landing elements found in the current model (or this stair has no turn — a single straight
          flight has no separate landing).
        </Text>
      ) : (
        <ReportTable<LandingScheduleRow> columns={landingColumns} rows={landingRows} />
      )}

      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginTop: pdfSpacing.sectionGap }}>
        {entry?.limitationNote ??
          "Landing Beam (LB) schedule/details are not produced by this application — a landing beam's location is a structural design decision, not something derivable from architectural drawing geometry. Model it as a regular RC Beam under the landing's supporting edge and design it via the RC Beam Design panel."}
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
