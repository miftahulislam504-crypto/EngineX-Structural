/**
 * RoofFloorBeamLayoutPlanSheet — Phase 11h (S-13)
 *
 * GradeBeamLayoutPlanSheet.tsx এর একই প্যাটার্ন — story bucket roofStoryId
 * (storyClassification.ts)।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { GridLayoutSketch, type PlanLineElement } from "@/lib/documentation/pdf/drawing-sheets/GridLayoutSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { classifyStories, resolveElementStoryId } from "@/lib/documentation/pdf/drawing-sheets/storyClassification";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";

export interface RoofFloorBeamLayoutPlanSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

export function RoofFloorBeamLayoutPlanSheetContent({ context, revisionNumber }: RoofFloorBeamLayoutPlanSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const { roofStoryId } = classifyStories(context.geometry);
  const allBeams = context.elements.filter((e) => e.category === "beam");
  const roofBeams = allBeams.filter(
    (e) => roofStoryId !== null && resolveElementStoryId(context.elements, e.elementId) === roofStoryId
  );
  const unclassifiedCount = allBeams.filter(
    (e) => resolveElementStoryId(context.elements, e.elementId) === null
  ).length;

  const planElements: PlanLineElement[] = roofBeams.map((e) => ({
    element: e,
    label: resolveElementLabel(context, e.elementId),
    isColumn: false,
  }));

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-13"
      sheetTitle="Roof Floor Beam Layout Plan"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Roof Floor Beam Layout Plan
      </Text>
      {planElements.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No roof-level beam elements found in the current model.
        </Text>
      ) : (
        <GridLayoutSketch grids={context.geometry.grids} elements={planElements} />
      )}
      {unclassifiedCount > 0 && (
        <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkFaint, marginTop: 6 }}>
          {unclassifiedCount} beam element(s) have no recorded design result and could not be
          assigned to a story level.
        </Text>
      )}
    </ReportSheetPage>
  );
}

export function RoofFloorBeamLayoutPlanSheet(props: RoofFloorBeamLayoutPlanSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Roof Floor Beam Layout Plan`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <RoofFloorBeamLayoutPlanSheetContent {...props} />
    </Document>
  );
}
