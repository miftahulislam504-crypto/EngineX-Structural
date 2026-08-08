/**
 * GradeBeamLayoutPlanSheet — Phase 11h (S-06)
 *
 * category==="beam" element গুলোর মধ্যে যাদের matching DesignResult এর
 * storyId === base story (classifyStories()/resolveElementStoryId(),
 * storyClassification.ts — honest gap নোট সেখানে)। কোনো DesignResult
 * না থাকা beam element storyId resolve করা যায় না বলে কোনো bucket এ
 * পড়ে না — "Unclassified" নোটে আলাদা করে গোনা হয়, চুপচাপ বাদ পড়ে না।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { GridLayoutSketch, type PlanLineElement } from "@/lib/documentation/pdf/drawing-sheets/GridLayoutSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { classifyStories, resolveElementStoryId } from "@/lib/documentation/pdf/drawing-sheets/storyClassification";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";

export interface GradeBeamLayoutPlanSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

export function GradeBeamLayoutPlanSheetContent({ context, revisionNumber }: GradeBeamLayoutPlanSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const { baseStoryId } = classifyStories(context.geometry);
  const allBeams = context.elements.filter((e) => e.category === "beam" || e.category === "steel-beam");
  const gradeBeams = allBeams.filter(
    (e) => baseStoryId !== null && resolveElementStoryId(context.designResults, e.elementId) === baseStoryId
  );
  const unclassifiedCount = allBeams.filter(
    (e) => resolveElementStoryId(context.designResults, e.elementId) === null
  ).length;

  const planElements: PlanLineElement[] = gradeBeams.map((e) => ({
    element: e,
    label: resolveElementLabel(context, e.elementId),
    isColumn: false,
  }));

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-06"
      sheetTitle="Grade Beam Layout Plan"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Grade Beam Layout Plan
      </Text>
      {planElements.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No grade-level beam elements found in the current model.
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

export function GradeBeamLayoutPlanSheet(props: GradeBeamLayoutPlanSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Grade Beam Layout Plan`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <GradeBeamLayoutPlanSheetContent {...props} />
    </Document>
  );
}
