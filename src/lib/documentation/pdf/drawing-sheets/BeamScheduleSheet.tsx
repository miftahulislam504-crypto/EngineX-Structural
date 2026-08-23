/**
 * BeamScheduleSheet — Report-Audit Phase B2 (S-20, 2026-08-20)
 *
 * ColumnScheduleSheet.tsx/FootingScheduleSheet.tsx এর অভিন্ন প্যাটার্ন —
 * প্রতিটা beam element এর span/size (DesignResult.detail.input,
 * asBeamDetail() দিয়ে decode — calc-sheets/detailTypes.ts এ কনফার্ম)
 * আর reinforcement summary (DesignResult.finalReinforcementSummary,
 * free-text ফিল্ড) — একটা schedule টেবিলে।
 *
 * Stirrup Spacing কলাম — RcBeamDesignReport.shear থেকে: requiredSpacingMm
 * থাকলে সেটা (stirrup আসলে লাগছে এমন span-এর জন্য প্রকৃত required
 * spacing), না থাকলে ("null" মানে গণনা অনুযায়ী stirrup না লাগলেও
 * ACI §9.7.6.2.2 max spacing limit প্রযোজ্য — rcBeamShear.ts এর
 * ShearDesignResult কমেন্ট) maxSpacingMm ব্যবহার করা হয়, "(max)" সাফিক্স
 * সহ যাতে দুটো ভিন্ন অর্থ গুলিয়ে না যায়।
 *
 * S-20 sheet number — sheetIndex.ts এর docblock/comment অনুযায়ী মূল
 * MICON reference set S.T-00 থেকে S.T-24 (২০টা entry, S-00 থেকে S-19
 * এ ম্যাপ করা) সম্পূর্ণ ব্যবহৃত — এই নতুন sheet সেই reference set-এর
 * অংশ না, তাই পরবর্তী নাম্বার (S-20) দেওয়া হয়েছে, originalSheetNumbers
 * এ honestly "N/A — new in this application" লেখা আছে (sheetIndex.ts
 * এর entry দেখুন), কোনো original sheet নম্বর invent করা হয়নি।
 *
 * honest gap — design result না থাকা element গুলোর জন্য "—" দেখানো হয়
 * (Column Schedule এর একই প্যাটার্ন), চুপচাপ বাদ দেওয়া হয় না।
 */

import { Document, Text } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { ReportTable, type ReportTableColumn } from "@/lib/documentation/pdf/components/ReportTable";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { resolveElementLabel } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { asBeamDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";

export interface BeamScheduleSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

interface ScheduleRow {
  label: string;
  spanText: string;
  sizeText: string;
  reinforcementText: string;
  stirrupText: string;
}

const columns: ReportTableColumn<ScheduleRow>[] = [
  { key: "label", header: "Beam Mark", flex: 1 },
  { key: "spanText", header: "Span", flex: 1, align: "right" },
  { key: "sizeText", header: "Size (b x h)", flex: 1, align: "right" },
  { key: "reinforcementText", header: "Final Reinforcement", flex: 2 },
  { key: "stirrupText", header: "Stirrup Spacing", flex: 1, align: "right" },
];

export function BeamScheduleSheetContent({ context, revisionNumber }: BeamScheduleSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const beamElements = context.elements.filter((e) => e.category === "beam");

  const rows: ScheduleRow[] = beamElements.map((e) => {
    const result = context.designResults.find((r) => r.elementId === e.elementId);
    const detail = result ? asBeamDetail(result.detail) : null;

    let stirrupText = "—";
    if (detail) {
      const shear = detail.report.shear;
      if (shear.requiredSpacingMm !== null) {
        stirrupText = `${shear.stirrupNeeded ? "" : "nominal "}@ ${Math.round(shear.requiredSpacingMm)} mm c/c`;
      } else {
        stirrupText = `@ ${Math.round(shear.maxSpacingMm)} mm c/c (max, per ACI limit)`;
      }
    }

    return {
      label: resolveElementLabel(context, e.elementId),
      spanText: detail ? `${(detail.input.spanMm / 1000).toFixed(2)} m` : "—",
      sizeText: detail ? `${detail.input.widthMm} x ${detail.input.totalDepthMm} mm` : "—",
      reinforcementText: result?.finalReinforcementSummary ?? "Not recorded",
      stirrupText,
    };
  });

  return (
    <ReportSheetPage
      project={project}
      sheetNumber="S-20"
      sheetTitle="Beam Schedule"
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
        Beam Schedule
      </Text>
      {rows.length === 0 ? (
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No beam elements found in the current model.
        </Text>
      ) : (
        <ReportTable<ScheduleRow> columns={columns} rows={rows} />
      )}
    </ReportSheetPage>
  );
}

export function BeamScheduleSheet(props: BeamScheduleSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Beam Schedule`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <BeamScheduleSheetContent {...props} />
    </Document>
  );
}
