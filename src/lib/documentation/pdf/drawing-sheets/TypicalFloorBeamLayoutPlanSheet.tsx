/**
 * TypicalFloorBeamLayoutPlanSheet — Phase 11h (S-08)
 *
 * GradeBeamLayoutPlanSheet.tsx এর একই প্যাটার্ন — শুধু story bucket
 * ভিন্ন (typicalStoryIds, storyClassification.ts)। একাধিক typical
 * floor থাকলে সবগুলো একসাথে একই sketch এ দেখানো হয় (রেফারেন্স ড্রয়িং এও
 * "Typical Floor" একটাই sheet, প্রতি ফ্লোরে আলাদা না — যেহেতু ফ্লোরপ্ল্যান
 * সাধারণত পুনরাবৃত্ত হয়)।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { GridLayoutSketch, type PlanLineElement } from "@/lib/documentation/pdf/drawing-sheets/GridLayoutSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { classifyStories, resolveElementStoryId } from "@/lib/documentation/pdf/drawing-sheets/storyClassification";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";

export interface TypicalFloorBeamLayoutPlanSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

export function TypicalFloorBeamLayoutPlanSheetContent({ context, revisionNumber }: TypicalFloorBeamLayoutPlanSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const { typicalStoryIds } = classifyStories(context.geometry);
  const allBeams = context.elements.filter((e) => e.category === "beam");
  const typicalBeams = allBeams.filter((e) =>
    typicalStoryIds.includes(resolveElementStoryId(context.elements, e.elementId) ?? "")
  );
  const unclassifiedCount = allBeams.filter(
    (e) => resolveElementStoryId(context.elements, e.elementId) === null
  ).length;

  const planElements: PlanLineElement[] = typicalBeams.map((e) => ({
    element: e,
    label: resolveElementLabel(context, e.elementId),
    isColumn: false,
  }));

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-08"
      sheetTitle="Typical Floor Beam Layout Plan"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Typical Floor Beam Layout Plan
      </Text>
      {planElements.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No typical-floor beam elements found in the current model.
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

export function TypicalFloorBeamLayoutPlanSheet(props: TypicalFloorBeamLayoutPlanSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Typical Floor Beam Layout Plan`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <TypicalFloorBeamLayoutPlanSheetContent {...props} />
    </Document>
  );
}
