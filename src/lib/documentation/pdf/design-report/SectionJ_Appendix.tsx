/**
 * Section J — Appendix (Phase 11c)
 *
 * প্লানের চাহিদা: "Individual member calculation sheets reference
 * (আলাদা annexure হিসেবে link/bookmark); General Notes (construction
 * notes, material spec references)"।
 *
 * সততার সাথে সীমাবদ্ধতা: Calculation Sheet ডকুমেন্ট নিজেই Phase 11e
 * এ তৈরি হবে (এখনো লেখা হয়নি) — তাই এই সেকশন এখন শুধু কতগুলো member
 * এর calc sheet তৈরি হতে পারবে তার একটা গণনা (designResults এর
 * length থেকে) ও "See separate Calculation Sheets document" রেফারেন্স
 * দেখায়, প্রকৃত bookmark/hyperlink তৈরি করে না — কারণ সেই ডকুমেন্ট
 * এখনো আলাদা ফাইল হিসেবে তৈরি হয়নি, ভিতরে link করার মতো কিছু নেই।
 * Phase 11e শেষ হলে এই সেকশন আপডেট করে প্রকৃত <Link> (react-pdf এর
 * নিজস্ব component) বসানো যাবে যদি bundled single-PDF হিসেবে output
 * করা হয়, অথবা ফাইলনাম রেফারেন্স যদি আলাদা PDF হিসেবে output হয়।
 *
 * General Notes reference — context.generalNotes null হলে (ইঞ্জিনিয়ার
 * এখনো generate করেননি, Phase 11a এর নোট অনুযায়ী) honest বার্তা দেখায়।
 */

import { Text, StyleSheet } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";

export interface AppendixProps {
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
  body: {
    fontSize: pdfFontSize.body,
  },
  muted: {
    fontSize: pdfFontSize.body,
    color: pdfColors.inkMuted,
  },
});

export function Appendix({ context, revisionNumber }: AppendixProps) {
  const calcSheetCount = context.designResults.length;
  const project = context.hub?.projectInfo ?? null;

  return (
    <ReportPage
      footerLabel="Structural Design Report — Section J: Appendix"
      titleblock={{
        project,
        documentKind: "design-report",
        sheetNumber: "DR-J",
        sheetTitle: "Design Report — Section J: Appendix",
        date: formatDateLabel(context.generatedAt),
        revisionNumber,
      }}
    >
      <Text style={styles.heading}>J. Appendix</Text>

      <Text style={styles.subheading}>Individual Member Calculation Sheets</Text>
      {calcSheetCount > 0 ? (
        <Text style={styles.body}>
          Detailed calculation sheets for {calcSheetCount} designed member
          {calcSheetCount > 1 ? "s" : ""} are provided in the separate Calculation Sheets
          annexure.
        </Text>
      ) : (
        <Text style={styles.muted}>
          No design results recorded yet — calculation sheets will be available once member
          design checks are saved.
        </Text>
      )}

      <Text style={styles.subheading}>General Notes</Text>
      {context.generalNotes ? (
        <Text style={styles.body}>
          Refer to the General Notes sheet (Drawing Sheet S-01) for design criteria, material
          specification, concrete cover, and development/lap length tables.
        </Text>
      ) : (
        <Text style={styles.muted}>
          General Notes have not been generated for this project yet — see the General Notes
          panel in the Design tab.
        </Text>
      )}
    </ReportPage>
  );
}
