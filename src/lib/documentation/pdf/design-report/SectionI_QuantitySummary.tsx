/**
 * Section I — Quantity Summary (Phase 11c)
 *
 * প্লানের চাহিদা: "Concrete quantity (grade-wise, m³) — element type
 * অনুযায়ী breakdown; Steel/Rebar quantity (dia-wise, kg বা ton)"।
 * পুরো হিসাব computeQuantitySummary() (documentation/compute/quantitySummary.ts,
 * Phase 11c) থেকে আসে — সেই মডিউলের docblock এ concrete volume এর
 * category-ভিত্তিক সীমাবদ্ধতা বিস্তারিত ব্যাখ্যা করা আছে (combined-
 * footing/strip-footing/wall unresolved থাকতে পারে)। এখানে সেই
 * `note`/`unresolvedElementCount` থাকলে PDF এ visible caveat হিসেবে
 * দেখানো হয়, চুপচাপ বাদ দেওয়া হয় না।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { ReportTable } from "@/lib/documentation/pdf/components/ReportTable";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import {
  computeQuantitySummary,
  type ConcreteQuantityRow,
  type SteelQuantityRow,
} from "@/lib/documentation/compute/quantitySummary";

export interface QuantitySummarySectionProps {
  context: ReportContext;
  revisionNumber: string;
}

/** SectionA_Cover.tsx/QcReportDocument.tsx এর মতো একই local helper। */
function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
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
  },
  totalLabel: {
    fontSize: pdfFontSize.body,
    fontFamily: "Helvetica-Bold",
  },
  totalValue: {
    fontSize: pdfFontSize.body,
    fontFamily: "Helvetica-Bold",
  },
  caveat: {
    marginTop: pdfSpacing.sectionGap,
    padding: 8,
    backgroundColor: pdfColors.statusWarningBg,
    borderWidth: 0.5,
    borderColor: pdfColors.statusWarning,
  },
  caveatText: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.statusWarning,
  },
});

export function QuantitySummarySection({ context, revisionNumber }: QuantitySummarySectionProps) {
  const summary = computeQuantitySummary(context);
  const project = context.hub?.projectInfo ?? null;

  return (
    <ReportPage
      footerLabel="Structural Design Report — Section I: Quantity Summary"
      titleblock={{
        project,
        documentKind: "design-report",
        sheetNumber: "DR-I",
        sheetTitle: "Design Report — Section I: Quantity Summary",
        date: formatDateLabel(context.generatedAt),
        revisionNumber,
      }}
    >
      <Text style={styles.heading}>I. Quantity Summary</Text>

      <Text style={styles.subheading}>Concrete Quantity (by Grade and Element Type)</Text>
      <ReportTable<ConcreteQuantityRow>
        columns={[
          { key: "category", header: "Element Type", flex: 1 },
          { key: "materialName", header: "Grade", flex: 1 },
          {
            key: "elementCount",
            header: "Count",
            flex: 1,
            align: "right",
          },
          {
            key: "volumeM3",
            header: "Volume (m3)",
            flex: 1,
            align: "right",
            render: (row) => <Text>{row.volumeM3.toFixed(2)}</Text>,
          },
        ]}
        rows={summary.concreteByGradeAndCategory}
      />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Concrete Volume</Text>
        <Text style={styles.totalValue}>{summary.totalConcreteVolumeM3.toFixed(2)} m3</Text>
      </View>

      <Text style={styles.subheading}>Steel / Rebar Quantity (by Diameter)</Text>
      <ReportTable<SteelQuantityRow>
        columns={[
          {
            key: "diameterMm",
            header: "Diameter (mm)",
            flex: 1,
            render: (row) => <Text>D{row.diameterMm}</Text>,
          },
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
        ]}
        rows={summary.steelByDiameter}
      />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Steel Weight</Text>
        <Text style={styles.totalValue}>
          {summary.totalSteelWeightKg.toFixed(1)} kg ({(summary.totalSteelWeightKg / 1000).toFixed(3)} ton)
        </Text>
      </View>

      {summary.note && (
        <View style={styles.caveat}>
          <Text style={styles.caveatText}>{summary.note}</Text>
        </View>
      )}
    </ReportPage>
  );
}
