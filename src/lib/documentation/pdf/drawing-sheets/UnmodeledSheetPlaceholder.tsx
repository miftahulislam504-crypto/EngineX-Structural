/**
 * UnmodeledSheetPlaceholder — Phase 11h
 *
 * S-11, S-12(1), S-17, S-18, S-19 (Machine Room/O.H.W.T Beam+Slab Details,
 * Stair Plan & Section, U.G.W.R Layout & Section) — এই সাব-সিস্টেমগুলো
 * app-এর data schema তে কোথাও element category হিসেবে মডেল করা নেই
 * (SectionG_DesignSummary.tsx এর categories তালিকা: beam/steel-beam/
 * column/steel-column/slab/wall/shear-wall/footing/combined-footing/
 * strip-footing/mat-foundation/pile-cap — machine-room/OHWT/stair/UGWR
 * এর কোনোটাই নেই)।
 *
 * SectionC_GeneralInformation.tsx এর নজির অনুসরণ করে (occupancy type/
 * structural system — "Not specified — no source field in current data
 * model") — চুপচাপ বাদ দেওয়া বা ভুয়া ডেটা বসানোর বদলে, sheet number
 * সহ placeholder page দেখানো হয় যাতে content list এ কোনো sheet "হারিয়ে"
 * না যায়, কিন্তু PDF খুললে ইঞ্জিনিয়ার স্পষ্ট জানতে পারেন কেন ফাঁকা।
 */

import { Document, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportSheetPage } from "@/lib/documentation/pdf/components/ReportSheetPage";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { SheetIndexEntry } from "@/lib/documentation/pdf/drawing-sheets/sheetIndex";

export interface UnmodeledSheetPlaceholderProps {
  context: ReportContext;
  revisionNumber: string;
  entry: SheetIndexEntry;
}

const styles = StyleSheet.create({
  heading: {
    fontSize: pdfFontSize.h1,
    fontFamily: "Helvetica-Bold",
    marginBottom: pdfSpacing.sectionGap,
  },
  body: {
    fontSize: pdfFontSize.body,
    color: pdfColors.inkMuted,
    marginBottom: 6,
  },
  originalRef: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkFaint,
  },
});

export function UnmodeledSheetPlaceholderContent({ context, revisionNumber, entry }: UnmodeledSheetPlaceholderProps) {
  const project = context.hub?.projectInfo ?? null;
  const dateLabel = new Date(context.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <ReportSheetPage
      project={project}
      sheetNumber={entry.sheetNumber}
      sheetTitle={entry.title}
      scale="NTS"
      date={dateLabel}
      revisionNumber={revisionNumber}
    >
      <Text style={styles.heading}>{entry.title}</Text>
      <Text style={styles.body}>
        {entry.limitationNote ??
          "This sub-system is not modeled as a structural element category in the current data model."}
      </Text>
      <Text style={styles.body}>
        No layout, schedule, or detail content can be generated for this sheet until the
        relevant element category is added to the application&apos;s data model.
      </Text>
      <Text style={styles.originalRef}>
        Reference drawing set sheet number(s): {entry.originalSheetNumbers}
      </Text>
    </ReportSheetPage>
  );
}

export function UnmodeledSheetPlaceholder(props: UnmodeledSheetPlaceholderProps) {
  const project = props.context.hub?.projectInfo ?? null;
  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — ${props.entry.title}`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <UnmodeledSheetPlaceholderContent {...props} />
    </Document>
  );
}
