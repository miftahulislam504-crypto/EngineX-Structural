/**
 * ColumnReinforcementDetailSheet — Report-Audit Phase B4 (S-22, 2026-08-20)
 *
 * TypicalFloorBeamDetailsSheet.tsx এর multi-column-per-page grid প্যাটার্ন
 * অনুসরণ করে, কিন্তু ColumnCrossSectionSketch.tsx (dedicated, Beam এর
 * SectionCutSketch থেকে আলাদা — rationale সেই ফাইলের docblock এ) দিয়ে।
 * প্রতিটা column element এর জন্য একটা cross-section sketch (real bar
 * perimeter position + tie, persisted DetailingResult থেকে যদি থাকে)।
 *
 * S-22 sheet number — S-02/S-03 (Column Layout Plan/Schedule) এর
 * পাশাপাশি Column এর জন্য কোনো "Details" sheet মূল ২০-এন্ট্রি reference
 * set এ নেই (Beam এর S-09 এর মতো কিছু Column এর জন্য নেই) — তাই এই
 * sheet সম্পূর্ণ নতুন সংযোজন, S-20/S-21 এর ধারাবাহিকতায় S-22।
 *
 * honest gap — persisted DetailingResult না থাকা column এর জন্য
 * "No detailing data" (ColumnCrossSectionSketch এর নিজস্ব fallback,
 * design result থেকে re-derive করার চেষ্টা করা হয়নি — কারণ সেই
 * heuristic ইঞ্জিনিয়ারের চূড়ান্ত bar selection থেকে ভিন্ন হতে পারে,
 * ColumnCrossSectionSketch.tsx এর docblock এ বিস্তারিত)।
 */

import { Document, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Fragment } from "react";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { ColumnCrossSectionSketch } from "@/lib/documentation/pdf/drawing-sheets/ColumnCrossSectionSketch";
import { resolveElementLabel, findDetailingResult } from "@/lib/documentation/pdf/drawing-sheets/elementLabel";
import { asColumnDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";
import { pdfFontSize, pdfSpacing, pdfColors } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { ColumnElement } from "@/lib/types/element";

export interface ColumnReinforcementDetailSheetProps {
  context: ReportContext;
  revisionNumber: string;
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: 160, marginBottom: 10, alignItems: "center", border: `0.5pt solid ${pdfColors.hairline}`, padding: 4 },
});

const COLUMNS_PER_PAGE = 12;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function ColumnReinforcementDetailSheetContent({ context, revisionNumber }: ColumnReinforcementDetailSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const columnElements = context.elements.filter((e): e is ColumnElement => e.category === "column");

  const items = columnElements.map((e) => {
    const result = context.designResults.find((r) => r.elementId === e.elementId);
    const detail = result ? asColumnDetail(result.detail) : null;
    const detailing = findDetailingResult(context, e.elementId) ?? null;
    return {
      elementId: e.elementId,
      label: resolveElementLabel(context, e.elementId),
      widthMm: detail?.input.widthMm ?? 300,
      depthMm: detail?.input.totalDepthMm ?? 300,
      detailing: detailing ?? null,
    };
  });

  const pages = chunk(items, COLUMNS_PER_PAGE);

  if (pages.length === 0) {
    return (
      <ReportSheetPage
        project={project}
        sheetNumber="S-22"
        sheetTitle="Column Reinforcement Detail"
        scale="NTS"
        date={dateLabel}
        revisionNumber={revisionNumber}
      >
        <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
          Column Reinforcement Detail
        </Text>
        <Text style={{ fontSize: pdfFontSize.body, color: pdfColors.inkMuted }}>
          No column elements found in the current model.
        </Text>
      </ReportSheetPage>
    );
  }

  return (
    <Fragment>
      {pages.map((pageItems, pageIndex) => (
        <ReportSheetPage
          key={pageIndex}
          project={project}
          sheetNumber="S-22"
          sheetTitle={`Column Reinforcement Detail${pages.length > 1 ? ` (${pageIndex + 1}/${pages.length})` : ""}`}
          scale="NTS"
          date={dateLabel}
          revisionNumber={revisionNumber}
        >
          {pageIndex === 0 && (
            <Text style={{ fontSize: pdfFontSize.h1, fontFamily: "Helvetica-Bold", marginBottom: pdfSpacing.sectionGap }}>
              Column Reinforcement Detail
            </Text>
          )}
          <View style={styles.grid}>
            {pageItems.map((item) => (
              <View key={item.elementId} style={styles.cell}>
                <ColumnCrossSectionSketch
                  widthMm={item.widthMm}
                  depthMm={item.depthMm}
                  detailing={item.detailing}
                  label={item.label}
                />
              </View>
            ))}
          </View>
        </ReportSheetPage>
      ))}
    </Fragment>
  );
}

export function ColumnReinforcementDetailSheet(props: ColumnReinforcementDetailSheetProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Column Reinforcement Detail`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <ColumnReinforcementDetailSheetContent {...props} />
    </Document>
  );
}
