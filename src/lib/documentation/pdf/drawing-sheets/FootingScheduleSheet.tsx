/**
 * FootingScheduleSheet — Phase 11h (S-05)
 *
 * FootingCalcSheet.tsx থেকে কনফার্ম: report.sizing.widthMm/lengthMm
 * (asFootingDetail() দিয়ে decode)। isolated footing element এ নিজেই
 * width/length/thickness আছে (quantitySummary.ts কনফার্ম) কিন্তু সেটা
 * initial/nominal মাপ হতে পারে — design report এর মতো এখানেও sizing
 * output (report.sizing) কেই "final" মাপ হিসেবে অগ্রাধিকার দেওয়া হলো,
 * FootingCalcSheet.tsx এর নিজস্ব কনভেনশন অনুসরণ করে।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { ReportTable, type ReportTableColumn } from "@/lib/documentation/pdf/components/ReportTable";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { asFootingDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";

export interface FootingScheduleSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

interface ScheduleRow {
  label: string;
  sizeText: string;
  reinforcementText: string;
}

const FOOTING_CATEGORIES = ["footing", "combined-footing", "strip-footing", "mat-foundation", "pile-cap"];

const columns: ReportTableColumn<ScheduleRow>[] = [
  { key: "label", header: "Footing Mark", flex: 1 },
  { key: "sizeText", header: "Size (W x L)", flex: 1, align: "right" },
  { key: "reinforcementText", header: "Final Reinforcement", flex: 2 },
];

export function FootingScheduleSheetContent({ context, revisionNumber }: FootingScheduleSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const footingElements = context.elements.filter((e) => FOOTING_CATEGORIES.includes(e.category));

  const rows: ScheduleRow[] = footingElements.map((e) => {
    const result = context.designResults.find((r) => r.elementId === e.elementId);
    const detail = result ? asFootingDetail(result.detail) : null;
    return {
      label: resolveElementLabel(context, e.elementId),
      sizeText: detail
        ? `${detail.report.sizing.widthMm.toFixed(0)} x ${detail.report.sizing.lengthMm.toFixed(0)} mm`
        : "—",
      reinforcementText: result?.finalReinforcementSummary ?? "Not recorded",
    };
  });

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-05"
      sheetTitle="Footing Schedule"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Footing Schedule
      </Text>
      {rows.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No footing elements found in the current model.
        </Text>
      ) : (
        <ReportTable<ScheduleRow> columns={columns} rows={rows} />
      )}
    </ReportSheetPage>
  );
}

export function FootingScheduleSheet(props: FootingScheduleSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Footing Schedule`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <FootingScheduleSheetContent {...props} />
    </Document>
  );
}
