/**
 * Bar Bending Schedule Sheet — Phase 11d (Drawing Sheet S-10)
 *
 * প্লানের চাহিদা: "টেবিল কলাম: Bar Mark, Element, Shape, Dia (mm),
 * Shape Sketch, Cut Length (mm), Count, Total Length (m), Unit Wt
 * (kg/m), Total Wt (kg); Grouping: element type অনুযায়ী section-wise
 * ভাগ; Element-wise subtotal + grand total (dia-ভিত্তিক ব্রেকডাউনও);
 * Summary block: মোট steel quantity (dia-wise breakdown টেবিল)"।
 *
 * এটাই S-10 (Drawing Sheet, Phase 11h এর sheet list অনুযায়ী) — কিন্তু
 * এখানে standalone annexure হিসেবেও (Design Report Appendix থেকে
 * link, বা আলাদা ডাউনলোড হিসেবে) ব্যবহারযোগ্য, তাই ReportSheetPage
 * (landscape A3 + titleblock, Phase 11b) ব্যবহার করা হয়েছে যাতে
 * উভয় প্রসঙ্গেই সঠিকভাবে বসে।
 *
 * প্রতিটা category group এর টেবিল পেজ-ব্রেকে ভেঙে যেতে পারে যদি
 * entries অনেক বেশি হয় — ReportTable এর repeatHeader (default true)
 * প্রতিটা নতুন পেজে column header পুনরাবৃত্তি করবে, তাই বড় প্রজেক্টেও
 * পড়া সহজ থাকবে।
 */

import { Document, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { ReportTable, type ReportTableColumn } from "@/lib/documentation/pdf/components/ReportTable";
import { BarShapeSketch } from "@/lib/documentation/pdf/bbs/BarShapeSketch";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import {
  buildProjectBbs,
  CATEGORY_LABEL,
  type EnrichedBbsEntry,
} from "@/lib/documentation/compute/projectBbs";
import type { BbsSummaryByDiameter } from "@/lib/design/barBendingSchedule";

export interface BbsSheetDocumentProps {
  context: ReportContext;
  revisionNumber: string;
}

const styles = StyleSheet.create({
  heading: {
    fontSize: pdfFontSize.h1,
    fontFamily: "Helvetica-Bold",
    marginBottom: pdfSpacing.sectionGap,
  },
  subheading: {
    fontSize: pdfFontSize.h2,
    fontFamily: "Helvetica-Bold",
    marginTop: pdfSpacing.sectionGap,
    marginBottom: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: pdfColors.panel,
    marginTop: 4,
    marginBottom: pdfSpacing.sectionGap,
  },
  totalLabel: {
    fontSize: pdfFontSize.body,
    fontFamily: "Helvetica-Bold",
  },
  totalValue: {
    fontSize: pdfFontSize.body,
    fontFamily: "Helvetica-Bold",
  },
  emptyNote: {
    fontSize: pdfFontSize.body,
    color: pdfColors.inkMuted,
  },
});

const entryColumns: ReportTableColumn<EnrichedBbsEntry>[] = [
  { key: "barMark", header: "Bar Mark", flex: 1 },
  { key: "elementLabel", header: "Element", flex: 1 },
  {
    key: "sketch",
    header: "Shape",
    flex: 1,
    render: (row) => <BarShapeSketch shape={row.visualShape} />,
  },
  {
    key: "barDiameterMm",
    header: "Dia (mm)",
    flex: 1,
    align: "right",
    render: (row) => <Text>D{row.barDiameterMm}</Text>,
  },
  {
    key: "cutLengthMm",
    header: "Cut Length (mm)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{row.cutLengthMm.toFixed(0)}</Text>,
  },
  { key: "count", header: "Count", flex: 1, align: "right" },
  {
    key: "totalLengthM",
    header: "Total Length (m)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{row.totalLengthM.toFixed(2)}</Text>,
  },
  {
    key: "unitWeightKgPerM",
    header: "Unit Wt (kg/m)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{row.unitWeightKgPerM.toFixed(3)}</Text>,
  },
  {
    key: "totalWeightKg",
    header: "Total Wt (kg)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{row.totalWeightKg.toFixed(2)}</Text>,
  },
];

const summaryColumns: ReportTableColumn<BbsSummaryByDiameter>[] = [
  {
    key: "barDiameterMm",
    header: "Diameter (mm)",
    flex: 1,
    render: (row) => <Text>D{row.barDiameterMm}</Text>,
  },
  { key: "totalCount", header: "Total Count", flex: 1, align: "right" },
  {
    key: "totalLengthM",
    header: "Total Length (m)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{row.totalLengthM.toFixed(1)}</Text>,
  },
  {
    key: "totalWeightKg",
    header: "Total Weight (kg)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{row.totalWeightKg.toFixed(1)}</Text>,
  },
];

export function BbsSheetDocument({ context, revisionNumber }: BbsSheetDocumentProps) {
  const bbs = buildProjectBbs(context);
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Bar Bending Schedule`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <ReportSheetPage
        project={project}
        sheetNumber="S-10"
        sheetTitle="Bar Bending Schedule (BBS)"
        scale="NTS"
        date={dateLabel}
        revisionNumber={revisionNumber}
      >
        <Text style={styles.heading}>Bar Bending Schedule</Text>

        {bbs.groups.length === 0 ? (
          <Text style={styles.emptyNote}>
            No detailing results recorded yet — the Bar Bending Schedule will populate once
            member detailing is generated and saved in the Detailing panel.
          </Text>
        ) : (
          <>
            {bbs.groups.map((group) => (
              <View key={group.category}>
                <ReportTable<EnrichedBbsEntry>
                  columns={entryColumns}
                  rows={group.entries}
                  groupLabel={`${CATEGORY_LABEL[group.category]} Bars`}
                />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {CATEGORY_LABEL[group.category]} Subtotal
                  </Text>
                  <Text style={styles.totalValue}>{group.subtotalWeightKg.toFixed(2)} kg</Text>
                </View>
              </View>
            ))}

            <Text style={styles.subheading}>Summary — Steel Quantity by Diameter</Text>
            <ReportTable<BbsSummaryByDiameter> columns={summaryColumns} rows={bbs.diameterSummary} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalValue}>
                {bbs.grandTotalWeightKg.toFixed(2)} kg ({(bbs.grandTotalWeightKg / 1000).toFixed(3)} ton)
              </Text>
            </View>
          </>
        )}
      </ReportSheetPage>
    </Document>
  );
}
