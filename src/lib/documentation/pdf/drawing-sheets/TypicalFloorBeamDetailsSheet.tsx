/**
 * TypicalFloorBeamDetailsSheet — Phase 11h (S-09)
 *
 * GradeBeamDetailsSheet.tsx এর একই প্যাটার্ন — typicalStoryIds bucket।
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

export interface TypicalFloorBeamDetailsSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

export function TypicalFloorBeamDetailsSheetContent({ context, revisionNumber }: TypicalFloorBeamDetailsSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const { typicalStoryIds } = classifyStories(context.geometry);
  const typicalBeams = context.elements.filter(
    (e) =>
      (e.category === "beam" || e.category === "steel-beam") &&
      typicalStoryIds.includes(resolveElementStoryId(context.designResults, e.elementId) ?? "")
  );

  if (typicalBeams.length === 0) {
    return (
      <ReportSheetPage
        project={project}
        sheetNumber="S-09"
        sheetTitle="Typical Floor Beam Details"
        scale="NTS"
        date={dateLabel}
        revisionNumber={revisionNumber}
      >
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No typical-floor beam elements found in the current model.
        </Text>
      </ReportSheetPage>
    );
  }

  return (
    <Fragment>
      {typicalBeams.map((e) => {
        const result = context.designResults.find((r) => r.elementId === e.elementId);
        const detail = result ? asBeamDetail(result.detail) : null;
        const detailing = findDetailingResult(context, e.elementId) ?? null;
        const label = resolveElementLabel(context, e.elementId);

        return (
          <ReportSheetPage
            key={e.elementId}
            project={project}
            sheetNumber="S-09"
            sheetTitle={`Typical Floor Beam Details — ${label}`}
            scale="NTS"
            date={dateLabel}
            revisionNumber={revisionNumber}
          >
            <Text style={{ fontSize: pdfFontSize.h2, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
              Beam {label}
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

export function TypicalFloorBeamDetailsSheet(props: TypicalFloorBeamDetailsSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Typical Floor Beam Details`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <TypicalFloorBeamDetailsSheetContent {...props} />
    </Document>
  );
}
