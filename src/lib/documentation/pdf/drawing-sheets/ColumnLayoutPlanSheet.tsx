/**
 * ColumnLayoutPlanSheet — Phase 11h (S-02)
 *
 * GridLayoutSketch.tsx ব্যবহার করে — context.geometry.grids (real
 * coordinate) আর context.elements এর category==="column" subset
 * (StructuralElement এ "steel-column" নামে কোনো category নেই — RC ও
 * steel column দুটোই category: "column", দেখুন build error ফিক্স নোট)
 * (startPoint/endPoint দিয়ে, honest gap নোট SectionCutSketch.tsx/
 * GridLayoutSketch.tsx এ) প্লট করে।
 *
 * গঠন — CalcSheetsDocument.tsx (Phase 11e) এর প্যাটার্ন অনুসরণ করে:
 * react-pdf এ একটা <Document> এর ভিতরে আরেকটা <Document> বসানো যায় না,
 * তাই প্রতিটা sheet এর মূল content (ColumnLayoutPlanSheetContent, শুধু
 * ReportSheetPage রিটার্ন করে) আর একটা পাতলা standalone <Document>
 * wrapper (ColumnLayoutPlanSheet) — আলাদা করা হয়েছে। DrawingSheetsDocument.tsx
 * (পুরো ২০-sheet বান্ডল) Content ভ্যারিয়েন্ট ব্যবহার করবে; কেউ শুধু এই
 * একটা sheet আলাদাভাবে ডাউনলোড করতে চাইলে wrapper ব্যবহার হবে।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { GridLayoutSketch, type PlanLineElement } from "@/lib/documentation/pdf/drawing-sheets/GridLayoutSketch";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";

export interface ColumnLayoutPlanSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

export function ColumnLayoutPlanSheetContent({ context, revisionNumber }: ColumnLayoutPlanSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const columnElements: PlanLineElement[] = context.elements
    .filter((e) => e.category === "column")
    .map((e) => ({ element: e, label: resolveElementLabel(context, e.elementId), isColumn: true }));

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-02"
      sheetTitle="Column Layout Plan"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Column Layout Plan
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

export function ColumnLayoutPlanSheet(props: ColumnLayoutPlanSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Column Layout Plan`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <ColumnLayoutPlanSheetContent {...props} />
    </Document>
  );
}
