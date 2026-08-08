/**
 * ContentSheet — Phase 11h (S-00)
 *
 * রেফারেন্স ড্রয়িং এর Content Sheet (S.T-00) এর সমতুল্য — পুরো Drawing
 * Sheet বান্ডলের index টেবিল। sheetIndex.ts এর SHEET_INDEX থেকে সরাসরি,
 * কোনো ReportContext ডেটা লাগে না (static list) — শুধু project header
 * এর জন্য context.hub।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { ReportTable, type ReportTableColumn } from "@/lib/documentation/pdf/components/ReportTable";
import { StatusBadge } from "@/lib/documentation/pdf/components/StatusBadge";
import { pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { SHEET_INDEX, type SheetIndexEntry } from "@/lib/documentation/pdf/drawing-sheets/sheetIndex";

export interface ContentSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

const columns: ReportTableColumn<SheetIndexEntry>[] = [
  { key: "sheetNumber", header: "Sheet No.", flex: 0.8 },
  { key: "title", header: "Title", flex: 3 },
  {
    key: "dataStatus",
    header: "Status",
    flex: 1,
    render: (row) => (
      <StatusBadge kind={row.dataStatus === "full" ? "pass" : row.dataStatus === "partial" ? "warning" : "neutral"} />
    ),
  },
];

export function ContentSheetContent({ context, revisionNumber }: ContentSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-00"
      sheetTitle="Content Sheet"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Structural Working Drawings — Contents
      </Text>
      <ReportTable<SheetIndexEntry> columns={columns} rows={SHEET_INDEX} />
    </ReportSheetPage>
  );
}

export function ContentSheet(props: ContentSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Content Sheet`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <ContentSheetContent {...props} />
    </Document>
  );
}
