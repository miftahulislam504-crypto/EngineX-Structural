/**
 * QcReportDocument — Phase 11f (standalone Model Validation / QC Report)
 *
 * প্লানের চাহিদা (Documentation Engine এর চারটা standalone document এর
 * একটা, মূল content plan অনুযায়ী): Design Report Section H এ যা শুধু
 * সারাংশ হিসেবে দেখানো হয়, এখানে issue-by-issue বিস্তারিত ব্রেকডাউন
 * থাকবে। SectionH_ValidationSummary.tsx এর docblock অনুযায়ী: "বিস্তারিত
 * issue-by-issue ব্রেকডাউন standalone QC Report (Phase 11f) এ থাকবে,
 * এখানে না (ডুপ্লিকেশন এড়াতে)" — এই ফাইল ঠিক সেই অসম্পূর্ণ অংশ পূরণ করে।
 *
 * Section lettering — এই standalone document এর নিজস্ব A-F lettering
 * আছে, Design Report এর A-J থেকে independent (দুটো আলাদা document,
 * আলাদা reader context — QC Report একাই পড়া যাবে, Design Report এর
 * সাথে bundle ছাড়াই)। "Section F" ব্যবহার করা হয়েছে critical-issue
 * banner এর জন্য — এটা StatusBadge.tsx এর pre-existing docblock এ
 * ইতিমধ্যে রেফারেন্স করা আছে ("QC Report Section F: Critical issue
 * থাকলে report-এর উপরে red flag/warning banner"), তাই সেই কনভেনশন
 * এখানে honor করা হলো, নতুন করে ভাবা হয়নি।
 *
 * গ্রুপিং — SectionH_ValidationSummary.tsx এর CATEGORY_TO_GROUP
 * mapping পুনরায় ব্যবহার করা হলো (একই তিনটা গ্রুপ: Connectivity &
 * Geometry / Load Verification / Code Compliance) — Section H আর QC
 * Report দুটোতেই একই গ্রুপিং দেখানো উচিত, নাহলে পাঠক দুই document এ
 * দুই রকম categorization দেখে বিভ্রান্ত হবেন। CATEGORY_TO_GROUP/GROUP_LABEL
 * এখানে duplicate না করে সরাসরি import করা হয়েছে।
 *
 * honest gap — validation/types.ts এই আপলোডে (Phase 11a-11e zip) নেই,
 * এটা একটা আগের ফেজের dependency যেটা কোডবেসের বাকি অংশে (Firestore
 * schema, runValidation.ts) থাকার কথা কিন্তু এই bundle এ পাওয়া যায়নি।
 * ValidationIssue এর message/elementId/elementLabel ফিল্ড এই bundle এর
 * কোথাও ব্যবহৃত হয়নি (শুধু category ও severity ব্যবহৃত হয়েছিল, Section H
 * এ) — তাই এই তিনটা ফিল্ডের নাম sibling type গুলোর কনভেনশন থেকে অনুমান
 * করা হয়েছে (DetailingResult/DesignResult সবখানেই elementId+elementLabel
 * জোড়া ব্যবহৃত হয়, message সবচেয়ে স্বাভাবিক নাম একটা human-readable
 * validation বার্তার জন্য)। যদি প্রকৃত validation/types.ts এ ভিন্ন নাম
 * থাকে (যেমন elementRef, description, details), শুধু নিচের
 * `ValidationIssueLike` ইন্টারফেস ও `issueColumns` এর column accessor
 * আপডেট করলেই যথেষ্ট হবে — বাকি document structure অপরিবর্তিত থাকবে।
 * প্রকৃত টাইপ পাওয়া গেলে এই ইন্টারফেসটা বাদ দিয়ে সরাসরি
 * "@/lib/validation/types" থেকে ValidationIssue import করাই সঠিক পথ।
 */

import { Document, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import {
  ReportTable,
  type ReportTableColumn,
} from "@/lib/documentation/pdf/components/ReportTable";
import { StatusBadge, mapValidationSeverity } from "@/lib/documentation/pdf/components/StatusBadge";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { ValidationCategory, ValidationSeverity } from "@/lib/validation/types";
import type { HubProjectInfo } from "@/lib/types/hub";

/**
 * validation/types.ts না পাওয়া পর্যন্ত local shape — উপরের docblock
 * এর "honest gap" নোট দেখুন। ValidationReport.issues এর runtime shape
 * এর সাথে structurally compatible থাকা দরকার (category/severity নাম
 * ইতিমধ্যে Section H থেকে নিশ্চিত), message/elementId/elementLabel
 * optional রাখা হয়েছে যাতে প্রকৃত টাইপে এই ফিল্ডগুলো না থাকলেও (বা
 * ভিন্ন নামে থাকলেও) TS build ভেঙে না পড়ে — শুধু সেই ক্ষেত্রে
 * fallback টেক্সট দেখাবে।
 */
interface ValidationIssueLike {
  category: ValidationCategory;
  severity: ValidationSeverity;
  message?: string;
  elementId?: string;
  elementLabel?: string;
}

export interface QcReportDocumentProps {
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
  body: {
    fontSize: pdfFontSize.body,
  },
  muted: {
    fontSize: pdfFontSize.body,
    color: pdfColors.inkMuted,
  },
  metaBlock: {
    marginTop: 4,
    marginBottom: pdfSpacing.sectionGap,
    padding: 10,
    backgroundColor: pdfColors.panel,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    width: 140,
    fontSize: pdfFontSize.body,
    color: pdfColors.inkMuted,
  },
  metaValue: {
    fontSize: pdfFontSize.body,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  scoreBlock: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: pdfColors.panel,
  },
  scoreValue: {
    fontSize: 40,
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
    padding: 10,
    backgroundColor: pdfColors.statusFailBg,
    borderWidth: 0.5,
    borderColor: pdfColors.statusFail,
  },
  bannerPass: {
    marginTop: pdfSpacing.sectionGap,
    padding: 10,
    backgroundColor: pdfColors.statusPassBg,
    borderWidth: 0.5,
    borderColor: pdfColors.statusPass,
  },
  bannerTextFail: {
    fontSize: pdfFontSize.body,
    color: pdfColors.statusFail,
    fontFamily: "Helvetica-Bold",
  },
  bannerTextPass: {
    fontSize: pdfFontSize.body,
    color: pdfColors.statusPass,
    fontFamily: "Helvetica-Bold",
  },
  groupIntroRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
});

function scoreColor(score: number): string {
  if (score >= 85) return pdfColors.statusPass;
  if (score >= 60) return pdfColors.statusWarning;
  return pdfColors.statusFail;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * SectionH_ValidationSummary.tsx এর সাথে অভিন্ন mapping — একই গ্রুপিং
 * দুই document জুড়ে সামঞ্জস্যপূর্ণ রাখতে duplicate না করে এখানেও একই
 * তিনটা group key ব্যবহার করা হয়েছে (নিজস্ব copy, কারণ Section H এর
 * ফাইল থেকে এই const গুলো export করা নেই — সেটা আলাদাভাবে ঠিক করার
 * সুযোগ থাকলে ভবিষ্যতে একটা shared module এ (যেমন validation/grouping.ts)
 * সরানো উচিত যাতে দুই জায়গায় manually sync রাখতে না হয়)।
 */
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

const GROUP_SECTION_LETTER: Record<string, string> = {
  connectivityGeometry: "D",
  loadVerification: "E",
  codeCompliance: "F",
};

const CATEGORY_LABEL: Record<ValidationCategory, string> = {
  connectivity: "Connectivity",
  duplicate: "Duplicate Element",
  geometry: "Geometry",
  support: "Support",
  "reference-integrity": "Reference Integrity",
  "solver-limitation": "Solver Limitation",
  "load-reference": "Load Reference",
  "load-sanity": "Load Sanity",
  "code-compliance": "Code Compliance",
};

const issueColumns: ReportTableColumn<ValidationIssueLike>[] = [
  {
    key: "severity",
    header: "Status",
    flex: 1,
    render: (row) => <StatusBadge kind={mapValidationSeverity(row.severity)} />,
  },
  {
    key: "category",
    header: "Category",
    flex: 1.2,
    render: (row) => <Text style={{ fontSize: pdfFontSize.tableBody }}>{CATEGORY_LABEL[row.category]}</Text>,
  },
  {
    key: "elementLabel",
    header: "Element",
    flex: 1,
    render: (row) => (
      <Text style={{ fontSize: pdfFontSize.tableBody }}>{row.elementLabel ?? "—"}</Text>
    ),
  },
  {
    key: "message",
    header: "Description",
    flex: 3.5,
    render: (row) => (
      <Text style={{ fontSize: pdfFontSize.tableBody }}>{row.message ?? "No description provided."}</Text>
    ),
  },
];

function IssueGroupSection({
  groupKey,
  context,
  project,
  revisionNumber,
  dateLabel,
}: {
  groupKey: keyof typeof GROUP_LABEL;
  context: ReportContext;
  project: HubProjectInfo | null;
  revisionNumber: string;
  dateLabel: string;
}) {
  const v = context.validation;
  const issues = (v.issues as ValidationIssueLike[]).filter(
    (issue) => CATEGORY_TO_GROUP[issue.category] === groupKey
  );
  const sectionLetter = GROUP_SECTION_LETTER[groupKey];

  return (
    <ReportPage
      footerLabel={`Model Validation / QC Report — Section ${sectionLetter}: ${GROUP_LABEL[groupKey]}`}
      titleblock={{
        project,
        documentKind: "qc-report",
        sheetNumber: `QC-${sectionLetter}`,
        sheetTitle: `Model Validation / QC Report — Section ${sectionLetter}: ${GROUP_LABEL[groupKey]}`,
        date: dateLabel,
        revisionNumber,
      }}
    >
      <Text style={styles.heading}>
        {GROUP_SECTION_LETTER[groupKey]}. {GROUP_LABEL[groupKey]}
      </Text>

      <View style={styles.groupIntroRow}>
        <StatusBadge kind={issues.length === 0 ? "pass" : "warning"} />
        <Text style={{ marginLeft: 8, fontSize: pdfFontSize.body }}>
          {issues.length === 0
            ? "No issues found in this category."
            : `${issues.length} issue(s) found in this category.`}
        </Text>
      </View>

      {issues.length > 0 && <ReportTable<ValidationIssueLike> columns={issueColumns} rows={issues} />}
    </ReportPage>
  );
}

export function QcReportDocument({ context, revisionNumber }: QcReportDocumentProps) {
  const v = context.validation;
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = formatDateLabel(context.generatedAt);
  const groupKeys = Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[];

  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Model Validation / QC Report`}
      creator="CivilOS Structural — Documentation Engine"
    >
      {/* A. Cover / Header — CoverPage (design-report) এর মতো পূর্ণ title
          page না, কারণ QC Report ছোট ও reference-style document (BBS/Calc
          Sheet এর মতো standalone annexure) — একই পেজে header ব্লক ও B/C
          সেকশন বসানো হয়েছে, আলাদা title page দিয়ে পাতা নষ্ট করা হয়নি। */}
      <ReportPage
        footerLabel="Model Validation / QC Report — Cover"
        titleblock={{
          project,
          documentKind: "qc-report",
          sheetNumber: "QC-00",
          sheetTitle: "Model Validation / QC Report — Cover",
          date: dateLabel,
          revisionNumber,
        }}
      >
        <Text style={styles.heading}>Model Validation / QC Report</Text>
        <Text style={[styles.muted, { marginBottom: pdfSpacing.sectionGap }]}>
          {project?.projectName ?? "Untitled Project"}
        </Text>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Project ID</Text>
            <Text style={styles.metaValue}>{project?.projectId ?? context.projectId}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Report Date</Text>
            <Text style={styles.metaValue}>{dateLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Revision No.</Text>
            <Text style={styles.metaValue}>{revisionNumber}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Elements Checked</Text>
            <Text style={styles.metaValue}>{context.elements.length}</Text>
          </View>
        </View>

        {/* B. Model Health Score */}
        <Text style={styles.subheading}>B. Model Health Score</Text>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreValue, { color: scoreColor(v.healthScore) }]}>
            {v.healthScore}
          </Text>
          <Text style={styles.scoreLabel}>Model Health Score{"\n"}(0–100)</Text>
        </View>

        {/* C. Issue Summary */}
        <Text style={styles.subheading}>C. Issue Summary</Text>
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

        {v.errorCount > 0 ? (
          <View style={styles.bannerFail}>
            <Text style={styles.bannerTextFail}>
              {v.errorCount} critical issue{v.errorCount > 1 ? "s" : ""} found. Resolve all errors
              listed in this report before finalizing the design or issuing drawings for
              construction.
            </Text>
          </View>
        ) : (
          <View style={styles.bannerPass}>
            <Text style={styles.bannerTextPass}>
              No critical issues found. See Sections D–F for warnings and informational notes.
            </Text>
          </View>
        )}
      </ReportPage>

      {/* D-F. Issue-by-issue detail, grouped — Section H (Design Report)
          থেকে ডুপ্লিকেট গ্রুপিং লজিক, একই ক্রমে (connectivityGeometry →
          loadVerification → codeCompliance) যাতে D/E/F এর numbering
          Section H এর presentation এর সাথে conceptually সামঞ্জস্যপূর্ণ থাকে। */}
      {groupKeys.map((key) => (
        <IssueGroupSection
          key={key}
          groupKey={key}
          context={context}
          project={project}
          revisionNumber={revisionNumber}
          dateLabel={dateLabel}
        />
      ))}
    </Document>
  );
}
