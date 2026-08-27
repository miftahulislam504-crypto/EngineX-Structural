/**
 * Section H — Model Validation / QC Summary (Phase 11c)
 *
 * প্লানের চাহিদা: "Model Health Score; Connectivity/floating member/
 * duplicate check status (pass/fail count); Code compliance checker
 * summary"। এটা প্লান অনুযায়ীই একটা সারাংশ — বিস্তারিত issue-by-issue
 * ব্রেকডাউন standalone QC Report (Phase 11f) এ থাকবে, এখানে না
 * (ডুপ্লিকেশন এড়াতে)।
 *
 * ValidationCategory ("connectivity"|"duplicate"|"geometry"|"support"|
 * "load-reference"|"load-sanity"|"reference-integrity"|"solver-limitation"|
 * "code-compliance") কে প্লানের তিনটা গ্রুপে ম্যাপ করা হয়েছে —
 * validation/types.ts এর নিজস্ব ক্যাটাগরি ভাঙা হয়নি, শুধু presentation
 * এর জন্য group করা হয়েছে।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { StatusBadge } from "@/lib/documentation/pdf/components/StatusBadge";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { ValidationCategory } from "@/lib/validation/types";

export interface ValidationSummaryProps {
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
  scoreBlock: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: pdfColors.panel,
  },
  scoreValue: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
  },
  scoreLabel: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    marginLeft: 12,
  },
  countRow: {
    flexDirection: "row",
    marginTop: pdfSpacing.sectionGap,
  },
  countCell: {
    flex: 1,
    padding: 10,
    borderWidth: 0.5,
    borderColor: pdfColors.hairline,
    alignItems: "center",
  },
  countValue: {
    fontSize: pdfFontSize.h1,
    fontFamily: "Helvetica-Bold",
  },
  countLabel: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    marginTop: 2,
  },
  bannerFail: {
    marginTop: pdfSpacing.sectionGap,
    padding: 8,
    backgroundColor: pdfColors.statusFailBg,
    borderWidth: 0.5,
    borderColor: pdfColors.statusFail,
  },
  bannerText: {
    fontSize: pdfFontSize.body,
    color: pdfColors.statusFail,
    fontFamily: "Helvetica-Bold",
  },
});

const GROUP_LABEL: Record<string, string> = {
  connectivityGeometry: "Connectivity & Geometry Checks",
  loadVerification: "Load Verification",
  codeCompliance: "Code Compliance Summary",
};

const CATEGORY_TO_GROUP: Record<ValidationCategory, keyof typeof GROUP_LABEL> = {
  connectivity: "connectivityGeometry",
  duplicate: "connectivityGeometry",
  geometry: "connectivityGeometry",
  support: "connectivityGeometry",
  "reference-integrity": "connectivityGeometry",
  "solver-limitation": "connectivityGeometry",
  "load-reference": "loadVerification",
  "load-sanity": "loadVerification",
  "code-compliance": "codeCompliance",
};

function scoreColor(score: number): string {
  if (score >= 85) return pdfColors.statusPass;
  if (score >= 60) return pdfColors.statusWarning;
  return pdfColors.statusFail;
}

export function ValidationSummary({ context, revisionNumber }: ValidationSummaryProps) {
  const v = context.validation;
  const project = context.hub?.projectInfo ?? null;
  const groups: Record<string, { pass: number; issueCount: number }> = {
    connectivityGeometry: { pass: 0, issueCount: 0 },
    loadVerification: { pass: 0, issueCount: 0 },
    codeCompliance: { pass: 0, issueCount: 0 },
  };
  for (const issue of v.issues) {
    const group = CATEGORY_TO_GROUP[issue.category];
    groups[group].issueCount += 1;
  }

  return (
    <ReportPage
      footerLabel="Structural Design Report — Section H: Model Validation / QC Summary"
      titleblock={{
        project,
        documentKind: "design-report",
        sheetNumber: "DR-H",
        sheetTitle: "Design Report — Section H: Model Validation / QC Summary",
        date: formatDateLabel(context.generatedAt),
        revisionNumber,
      }}
    >
      <Text style={styles.heading}>H. Model Validation / QC Summary</Text>

      <View style={styles.scoreBlock}>
        <Text style={[styles.scoreValue, { color: scoreColor(v.healthScore) }]}>
          {v.healthScore}
        </Text>
        <Text style={styles.scoreLabel}>Model Health Score{"\n"}(0–100)</Text>
      </View>

      <View style={styles.countRow}>
        <View style={styles.countCell}>
          <Text style={[styles.countValue, { color: pdfColors.statusFail }]}>{v.errorCount}</Text>
          <Text style={styles.countLabel}>Errors</Text>
        </View>
        <View style={styles.countCell}>
          <Text style={[styles.countValue, { color: pdfColors.statusWarning }]}>
            {v.warningCount}
          </Text>
          <Text style={styles.countLabel}>Warnings</Text>
        </View>
        <View style={styles.countCell}>
          <Text style={[styles.countValue, { color: pdfColors.statusInfo }]}>{v.infoCount}</Text>
          <Text style={styles.countLabel}>Info</Text>
        </View>
      </View>

      {v.errorCount > 0 && (
        <View style={styles.bannerFail}>
          <Text style={styles.bannerText}>
            {v.errorCount} critical issue{v.errorCount > 1 ? "s" : ""} found — see the standalone
            Model Validation / QC Report for full details before finalizing this design.
          </Text>
        </View>
      )}

      {(Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[]).map((key) => (
        <View key={key}>
          <Text style={styles.subheading}>{GROUP_LABEL[key]}</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <StatusBadge kind={groups[key].issueCount === 0 ? "pass" : "warning"} />
            <Text style={{ marginLeft: 8, fontSize: pdfFontSize.body }}>
              {groups[key].issueCount === 0
                ? "No issues found."
                : `${groups[key].issueCount} issue(s) found in this category.`}
            </Text>
          </View>
        </View>
      ))}
    </ReportPage>
  );
}
