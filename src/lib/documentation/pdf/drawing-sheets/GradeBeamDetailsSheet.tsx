/**
 * GradeBeamDetailsSheet — Phase 11h (S-07)
 *
 * প্রতিটা grade-level beam element এর জন্য একটা পৃষ্ঠা — SectionCutSketch.tsx
 * (widthMm/depthMm from DesignResult.detail.input via asBeamDetail(),
 * bar count/diameter from matching DetailingResult)। কোনো DesignResult/
 * DetailingResult না থাকলে honest "no data recorded" পৃষ্ঠা।
 */

import { Document, Text } from "@react-pdf/renderer";
import { Fragment } from "react";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { SectionCutSketch } from "@/lib/documentation/pdf/drawing-sheets/SectionCutSketch";
import { resolveElementLabel, findDetailingResult } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { classifyStories, resolveElementStoryId } from "@/lib/documentation/pdf/drawing-sheets/storyClassification";
import { asBeamDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";

export interface GradeBeamDetailsSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

/** একাধিক ReportSheetPage রিটার্ন করে (এক-একটা grade beam এর জন্য) — Document না, DrawingSheetsDocument.tsx এ বান্ডল করার জন্য। */
export function GradeBeamDetailsSheetContent({ context, revisionNumber }: GradeBeamDetailsSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const { baseStoryId } = classifyStories(context.geometry);
  const gradeBeams = context.elements.filter(
    (e) =>
      (e.category === "beam" || e.category === "steel-beam") &&
      baseStoryId !== null &&
      resolveElementStoryId(context.elements, e.elementId) === baseStoryId
  );

  if (gradeBeams.length === 0) {
    return (
      <ReportSheetPage
        project={project}
        sheetNumber="S-07"
        sheetTitle="Grade Beam Details"
        scale="NTS"
        date={dateLabel}
        revisionNumber={revisionNumber}
      >
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No grade-level beam elements found in the current model.
        </Text>
      </ReportSheetPage>
    );
  }

  return (
    <Fragment>
      {gradeBeams.map((e) => {
        const result = context.designResults.find((r) => r.elementId === e.elementId);
        const detail = result ? asBeamDetail(result.detail) : null;
        const detailing = findDetailingResult(context, e.elementId) ?? null;
        const label = resolveElementLabel(context, e.elementId);

        return (
          <ReportSheetPage
            key={e.elementId}
            project={project}
            sheetNumber="S-07"
            sheetTitle={`Grade Beam Details — ${label}`}
            scale="NTS"
            date={dateLabel}
            revisionNumber={revisionNumber}
          >
            <Text style={{ fontSize: pdfFontSize.h2, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
              Grade Beam {label}
            </Text>
            {detail ? (
              <SectionCutSketch
                widthMm={detail.input.widthMm}
                depthMm={detail.input.totalDepthMm}
                detailing={detailing}
                label={`Section — ${label}`}
              />
            ) : (
              <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
                No detailed design data recorded for this member yet.
              </Text>
            )}
          </ReportSheetPage>
        );
      })}
    </Fragment>
  );
}

export function GradeBeamDetailsSheet(props: GradeBeamDetailsSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Grade Beam Details`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <GradeBeamDetailsSheetContent {...props} />
    </Document>
  );
}
