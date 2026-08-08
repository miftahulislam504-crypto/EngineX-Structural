/**
 * GeneralNotesSheet — Phase 11g (Drawing Sheet S-01)
 *
 * প্লানের চাহিদা (Documentation Engine এর চারটা standalone document এর
 * একটা): Design criteria, material specification, concrete cover, and
 * development/lap/hook length reference — একটা MICON-স্টাইল General
 * Notes পাতা। ReportTable.tsx এর pre-existing docblock এ ইতিমধ্যে এই
 * document কে "General Notes এর ৫টা আলাদা টেবিল" হিসেবে রেফারেন্স করা
 * আছে — সেই সংখ্যা এখানে honor করা হয়েছে: (1) Design Criteria, (2)
 * Material Specification, (3) Concrete Cover Requirements, (4) Concrete
 * Requirement (slump/curing), (5) Development/Lap/Hook Length Table।
 *
 * এটাই S-01 (SectionJ_Appendix.tsx এর মন্তব্য অনুযায়ী: "Refer to the
 * General Notes sheet (Drawing Sheet S-01)") — তাই BbsSheetDocument.tsx
 * (S-10) এর মতোই ReportSheetPage (landscape A3 + titleblock, Phase 11b)
 * ব্যবহার করা হয়েছে, যাতে Design Report Appendix থেকে reference করা
 * এবং standalone ডাউনলোড — দুই প্রসঙ্গেই সঠিকভাবে বসে।
 *
 * ডেটা সোর্স — GeneralNotesData এর টপ-লেভেল shape (কোন ফিল্ডগুলো আছে:
 * designCriteria, materials, coverRequirements, concreteRequirement,
 * developmentLengthTable, projectLabel, fyMPa, fcMPa,
 * clearCoverOrHalfSpacingMm) সরাসরি GeneralNotesPanel.tsx এর রেন্ডার
 * থেকে নিশ্চিত — generalNotes.ts নিজেই এই আপলোডে নেই, কিন্তু panel UI
 * প্রতিটা ফিল্ড field-by-field ব্যবহার করে দেখায়, তাই top-level shape এ
 * অনুমানের প্রয়োজন হয়নি।
 *
 * honest gap (partial) — যদিও top-level shape নিশ্চিত, প্রতিটা array এর
 * element type (materials[i], coverRequirements[i],
 * developmentLengthTable[i]) generalNotes.ts এ কী নামে exported (যদি
 * আদৌ আলাদাভাবে exported হয়, নাকি GeneralNotesData এর ভেতরে inline/
 * anonymous), তা এই আপলোডে কোথাও নিশ্চিত হওয়া যায়নি — panel.tsx এই
 * element গুলো কখনো নাম ধরে import করেনি, শুধু data.materials[i].xxx
 * আকারে access করেছে। তাই নিচে এই তিনটার জন্য আলাদা named type import
 * না করে GeneralNotesData থেকে indexed-access দিয়ে element type বের
 * করা হয়েছে (GeneralNotesData["materials"][number] প্যাটার্ন) — এভাবে
 * generalNotes.ts এ প্রকৃত element type যে নামেই থাকুক না কেন (named
 * বা inline), structurally সঠিক থাকবে, ভুল নাম অনুমান করে import ভাঙার
 * ঝুঁকি থাকবে না।
 *
 * context.generalNotes null case — reportContext.ts এর docblock অনুযায়ী,
 * ইঞ্জিনিয়ার এখনো panel এ "Generate" চাপেননি এমন প্রজেক্টে এটা null হবে।
 * এই sheet তখন খালি টেবিল দেখায় না (SectionJ_Appendix.tsx এর কনভেনশন
 * অনুসরণ করে) — বরং titleblock-সহ একটা honest "not yet generated" পেজ
 * দেখায়, যাতে ডাউনলোড করা PDF ফাইলটা ভুল করে blank/broken মনে না হয়।
 */

import { Document, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import {
  ReportTable,
  type ReportTableColumn,
} from "@/lib/documentation/pdf/components/ReportTable";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { GeneralNotesData } from "@/lib/design/generalNotes";

/**
 * element type গুলো named export হিসেবে না ধরে GeneralNotesData থেকে
 * indexed-access দিয়ে বের করা হয়েছে — উপরের docblock এর "honest gap
 * (partial)" নোট দেখুন। generalNotes.ts পাওয়া গেলে এই তিনটা alias
 * সরিয়ে সরাসরি প্রকৃত named type ব্যবহার করা যাবে, কিন্তু ততক্ষণ এই
 * ফাইলের বাকি অংশ কোনো পরিবর্তন ছাড়াই সঠিক থাকবে।
 */
type GeneralNotesMaterial = GeneralNotesData["materials"][number];
type GeneralNotesCoverRequirement = GeneralNotesData["coverRequirements"][number];
type GeneralNotesDevelopmentLengthRow = GeneralNotesData["developmentLengthTable"][number];

export interface GeneralNotesSheetProps {
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
  twoColRow: {
    flexDirection: "row",
  },
  col: {
    flex: 1,
  },
  colGapLeft: {
    marginLeft: pdfSpacing.sectionGap,
  },
  footnote: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    marginTop: 2,
  },
});

/** Design Criteria/Concrete Requirement — panel এ key/value block হিসেবে দেখানো হয়, কিন্তু এখানে ReportTable এর সাথে visual পরিবার মেলাতে ২-কলাম (label/value) টেবিল হিসেবে রেন্ডার করা হয়েছে, যাতে সত্যিই "৫টা টেবিল" হয়, মিশ্র prose+table না। */
interface KeyValueRow {
  label: string;
  value: string;
}

const keyValueColumns: ReportTableColumn<KeyValueRow>[] = [
  { key: "label", header: "Item", flex: 1.2 },
  { key: "value", header: "Value", flex: 2 },
];

const materialColumns: ReportTableColumn<GeneralNotesMaterial>[] = [
  { key: "elementCategory", header: "Element Category", flex: 2 },
  {
    key: "concreteFcMPa",
    header: "Concrete f'c (MPa)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{row.concreteFcMPa}</Text>,
  },
  {
    key: "reinforcementFyMPa",
    header: "Reinforcement fy (MPa)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{row.reinforcementFyMPa}</Text>,
  },
];

const coverColumns: ReportTableColumn<GeneralNotesCoverRequirement>[] = [
  { key: "condition", header: "Condition", flex: 2 },
  {
    key: "coverMm",
    header: "Clear Cover (mm)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{row.coverMm}</Text>,
  },
];

function fmt(v: number): string {
  return Number.isFinite(v) ? v.toFixed(0) : "—";
}

const developmentLengthColumns: ReportTableColumn<GeneralNotesDevelopmentLengthRow>[] = [
  {
    key: "barDiameterMm",
    header: "Ø (mm)",
    flex: 0.7,
    render: (row) => <Text>D{row.barDiameterMm}</Text>,
  },
  {
    key: "tensionDevelopmentLengthMm",
    header: "ld — Tension (mm)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{fmt(row.tensionDevelopmentLengthMm)}</Text>,
  },
  {
    key: "compressionDevelopmentLengthMm",
    header: "ldc — Compression (mm)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{fmt(row.compressionDevelopmentLengthMm)}</Text>,
  },
  {
    key: "tensionLapClassAMm",
    header: "Lap — Class A (mm)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{fmt(row.tensionLapClassAMm)}</Text>,
  },
  {
    key: "tensionLapClassBMm",
    header: "Lap — Class B (mm)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{fmt(row.tensionLapClassBMm)}</Text>,
  },
  {
    key: "compressionLapMm",
    header: "Lap — Compression (mm)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{fmt(row.compressionLapMm)}</Text>,
  },
  {
    key: "hookDevelopmentLengthMm",
    header: "ldh — Hook (mm)",
    flex: 1,
    align: "right",
    render: (row) => <Text>{fmt(row.hookDevelopmentLengthMm)}</Text>,
  },
];

function buildDesignCriteriaRows(data: GeneralNotesData): KeyValueRow[] {
  const rows: KeyValueRow[] = [
    { label: "Code Basis", value: data.designCriteria.codeBasis.join(", ") || "—" },
  ];
  if (data.designCriteria.windSpeedKmh) {
    rows.push({ label: "Design Wind Speed", value: `${data.designCriteria.windSpeedKmh} km/h` });
  }
  if (data.designCriteria.seismicZone) {
    rows.push({ label: "Seismic Zone", value: data.designCriteria.seismicZone });
  }
  return rows;
}

function buildConcreteRequirementRows(data: GeneralNotesData): KeyValueRow[] {
  return [
    { label: "Maximum Slump", value: `${data.concreteRequirement.maxSlumpMm} mm` },
    { label: "Curing Method", value: data.concreteRequirement.curingMethod },
    { label: "Minimum Curing Period", value: `${data.concreteRequirement.minCuringDays} days` },
  ];
}

function EmptyGeneralNotesPage({ context, revisionNumber }: GeneralNotesSheetProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — General Notes`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <ReportSheetPage
        project={project}
        sheetNumber="S-01"
        sheetTitle="General Notes"
        scale="NTS"
        date={dateLabel}
        revisionNumber={revisionNumber}
      >
        <Text style={styles.heading}>General Notes</Text>
        <Text style={styles.muted}>
          General Notes have not been generated for this project yet — see the General Notes
          panel in the Design tab to enter design criteria, material grade, and cover
          requirements before exporting this sheet.
        </Text>
      </ReportSheetPage>
    </Document>
  );
}

export function GeneralNotesSheet({ context, revisionNumber }: GeneralNotesSheetProps) {
  const data = context.generalNotes;
  const project = context.hub?.projectInfo ?? null;

  if (!data) {
    return <EmptyGeneralNotesPage context={context} revisionNumber={revisionNumber} />;
  }

  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — General Notes`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <ReportSheetPage
        project={project}
        sheetNumber="S-01"
        sheetTitle="General Notes"
        scale="NTS"
        date={dateLabel}
        revisionNumber={revisionNumber}
      >
        <Text style={styles.heading}>General Notes — {data.projectLabel}</Text>

        {/* 1-2. Design Criteria / Material Specification — পাশাপাশি দুই
            কলামে, কারণ দুটোই ছোট টেবিল (সাধারণত ২-৪ সারি) — আলাদা আলাদা
            ফুল-উইথ টেবিল বসালে পাতার উপরের অংশে অনেক ফাঁকা জায়গা থেকে যেত। */}
        <View style={styles.twoColRow}>
          <View style={styles.col}>
            <Text style={styles.subheading}>1. Design Criteria</Text>
            <ReportTable<KeyValueRow> columns={keyValueColumns} rows={buildDesignCriteriaRows(data)} />
          </View>
          <View style={[styles.col, styles.colGapLeft]}>
            <Text style={styles.subheading}>2. Material Specification</Text>
            <ReportTable<GeneralNotesMaterial> columns={materialColumns} rows={data.materials} />
          </View>
        </View>

        {/* 3-4. Cover Requirements / Concrete Requirement — একই কারণে পাশাপাশি। */}
        <View style={styles.twoColRow}>
          <View style={styles.col}>
            <Text style={styles.subheading}>3. Concrete Cover Requirements</Text>
            <ReportTable<GeneralNotesCoverRequirement>
              columns={coverColumns}
              rows={data.coverRequirements}
            />
          </View>
          <View style={[styles.col, styles.colGapLeft]}>
            <Text style={styles.subheading}>4. Concrete Requirement</Text>
            <ReportTable<KeyValueRow>
              columns={keyValueColumns}
              rows={buildConcreteRequirementRows(data)}
            />
          </View>
        </View>

        {/* 5. Development/Lap/Hook Length Table — ৭ কলাম, ফুল-উইথ (landscape
            A3 এর পুরো প্রস্থ দরকার, উপরের দুইটার মতো অর্ধেক-প্রস্থে ঠিকভাবে
            পড়া যেত না)। */}
        <Text style={styles.subheading}>5. Development / Lap / Hook Length Table</Text>
        <ReportTable<GeneralNotesDevelopmentLengthRow>
          columns={developmentLengthColumns}
          rows={data.developmentLengthTable}
        />
        <Text style={styles.footnote}>
          All lengths in mm, based on f&apos;c = {data.fcMPa} MPa, fy = {data.fyMPa} MPa, clear
          cover/half-spacing = {data.clearCoverOrHalfSpacingMm} mm as specified above.
        </Text>
      </ReportSheetPage>
    </Document>
  );
}
