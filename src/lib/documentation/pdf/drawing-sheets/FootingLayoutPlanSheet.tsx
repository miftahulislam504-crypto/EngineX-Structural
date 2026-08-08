/**
 * FootingLayoutPlanSheet — Phase 11h (S-04)
 *
 * sheetIndex.ts এর S-04 entry এর limitationNote অনুযায়ী: footing
 * position/outline এই data model এ স্বাধীনভাবে সংরক্ষিত না (কোনো
 * position field কনফার্ম হয়নি, কোনো column-to-footing link নেই)।
 * তাই এই sheet grid lines + supporting column marker (যেখানে সাধারণত
 * footing থাকে) দেখায়, ভুয়া footing outline আঁকে না।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { GridLayoutSketch, type PlanLineElement } from "@/lib/documentation/pdf/drawing-sheets/GridLayoutSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { SHEET_INDEX } from "@/lib/documentation/pdf/drawing-sheets/sheetIndex";

export interface FootingLayoutPlanSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

export function FootingLayoutPlanSheetContent({ context, revisionNumber }: FootingLayoutPlanSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const entry = SHEET_INDEX.find((s) => s.sheetNumber === "S-04");

  const columnElements: PlanLineElement[] = context.elements
    .filter((e) => e.category === "column" || e.category === "steel-column")
    .map((e) => ({ element: e, label: resolveElementLabel(context, e.elementId), isColumn: true }));

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-04"
      sheetTitle="Footing Layout Plan"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
        Footing Layout Plan
      </Text>
      <Text style={{ fontSize: pdfFontSize.caption, color: pdfColors.inkMuted, marginBottom: pdfSpacing.sectionGap }}>
        {entry?.limitationNote} Markers below show supporting column positions; see the Footing
        Schedule (S-05) for individual footing sizes.
      </Text>
      {columnElements.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No column elements found in the current model.
        </Text>
      ) : (
        <GridLayoutSketch grids={context.geometry.grids} elements={columnElements} />
      )}
    </ReportSheetPage>
  );
}

export function FootingLayoutPlanSheet(props: FootingLayoutPlanSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Footing Layout Plan`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <FootingLayoutPlanSheetContent {...props} />
    </Document>
  );
}
