/**
 * ColumnScheduleSheet — Phase 11h (S-03)
 *
 * প্রতিটা column element এর size (DesignResult.detail.input.widthMm/
 * totalDepthMm, asColumnDetail() দিয়ে decode — calc-sheets/detailTypes.ts
 * এ কনফার্ম) আর reinforcement summary (DesignResult.finalReinforcementSummary,
 * BeamCalcSheet.tsx থেকে কনফার্ম free-text ফিল্ড) — একটা schedule টেবিলে।
 *
 * honest gap — detail data না থাকা element গুলোর জন্য "—" দেখানো হয়,
 * চুপচাপ বাদ দেওয়া হয় না (row থাকবে, শুধু columns ফাঁকা)।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { ReportTable, type ReportTableColumn } from "@/lib/documentation/pdf/components/ReportTable";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { asColumnDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";

export interface ColumnScheduleSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

interface ScheduleRow {
  label: string;
  sizeText: string;
  reinforcementText: string;
}

const columns: ReportTableColumn<ScheduleRow>[] = [
  { key: "label", header: "Column Mark", flex: 1 },
  { key: "sizeText", header: "Size (b x h)", flex: 1, align: "right" },
  { key: "reinforcementText", header: "Final Reinforcement", flex: 2 },
];

export function ColumnScheduleSheetContent({ context, revisionNumber }: ColumnScheduleSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const columnElements = context.elements.filter((e) => e.category === "column");

  const rows: ScheduleRow[] = columnElements.map((e) => {
    const result = context.designResults.find((r) => r.elementId === e.elementId);
    const detail = result ? asColumnDetail(result.detail) : null;
    return {
      label: resolveElementLabel(context, e.elementId),
      sizeText: detail ? `${detail.input.widthMm} x ${detail.input.totalDepthMm} mm` : "—",
      reinforcementText: result?.finalReinforcementSummary ?? "Not recorded",
    };
  });

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-03"
      sheetTitle="Column Schedule"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Column Schedule
      </Text>
      {rows.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No column elements found in the current model.
        </Text>
      ) : (
        <ReportTable<ScheduleRow> columns={columns} rows={rows} />
      )}
    </ReportSheetPage>
  );
}

export function ColumnScheduleSheet(props: ColumnScheduleSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Column Schedule`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <ColumnScheduleSheetContent {...props} />
    </Document>
  );
}
