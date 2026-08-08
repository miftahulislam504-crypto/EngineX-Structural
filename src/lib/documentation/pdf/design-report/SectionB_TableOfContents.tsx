/**
 * Section B — Table of Contents (Phase 11c)
 *
 * প্লানের চাহিদা: "auto-generated, page number সহ"।
 *
 * সততার সাথে একটা সীমাবদ্ধতা এখানে জানানো দরকার: @react-pdf/renderer
 * এ layout ও pagination রেন্ডারের সময় নির্ধারিত হয় — একটা section
 * ঠিক কোন পেজে পড়বে তা আগে থেকে জানার কোনো সহজ API নেই (react-pdf
 * টু-পাস pagination সমর্থন করে না, যেমন LaTeX করে)। তাই এই TOC
 * "সত্যিকারের auto-generated page number" (ডাইনামিকভাবে actual pageNumber
 * বসানো) দেয় না — বরং section-এর ক্রম ও শিরোনাম listing করে, প্রতিটা
 * entry এর পাশে "See Section" রেফারেন্স, পেজ নম্বর ছাড়া।
 *
 * এটা ইচ্ছাকৃত সিদ্ধান্ত: ভুল/placeholder পেজ নম্বর (যেমন সবসময় "—"
 * অথবা হার্ডকোড করা অনুমান) দেখানোর চেয়ে honest listing ভালো। ভবিষ্যতে
 * react-pdf যদি bookmark/anchor-ভিত্তিক TOC সমর্থন করে (Link/Note
 * component দিয়ে internal link সম্ভব, কিন্তু pageNumber lookup না),
 * অথবা একটা two-pass render (প্রথম pass এ pageNumber বের করে, দ্বিতীয়
 * pass এ TOC পূরণ করে) implement করা হলে এই ফাইল আপডেট হবে।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";

export interface TableOfContentsEntry {
  code: string; // যেমন "A", "G1", "J"
  title: string;
}

export interface TableOfContentsProps {
  entries: TableOfContentsEntry[];
}

const styles = StyleSheet.create({
  heading: {
    fontSize: pdfFontSize.h1,
    fontFamily: "Helvetica-Bold",
    marginBottom: pdfSpacing.sectionGap,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.hairline,
  },
  code: {
    width: 40,
    fontSize: pdfFontSize.body,
    fontFamily: "Helvetica-Bold",
  },
  title: {
    flex: 1,
    fontSize: pdfFontSize.body,
  },
});

export function TableOfContents({ entries }: TableOfContentsProps) {
  return (
    <ReportPage footerLabel="Structural Design Report — Table of Contents">
      <Text style={styles.heading}>Table of Contents</Text>
      {entries.map((entry) => (
        <View key={entry.code} style={styles.row}>
          <Text style={styles.code}>{entry.code}</Text>
          <Text style={styles.title}>{entry.title}</Text>
        </View>
      ))}
    </ReportPage>
  );
}

/** DesignReportDocument এর জন্য standard entry list — Section A-J, প্লানের ক্রম অনুযায়ী। */
export const STANDARD_TOC_ENTRIES: TableOfContentsEntry[] = [
  { code: "A", title: "Cover / Title Page" },
  { code: "C", title: "General Information" },
  { code: "D", title: "Material Properties" },
  { code: "E", title: "Design Loads Summary" },
  { code: "F", title: "Analysis Summary" },
  { code: "G1", title: "Beam Design Summary" },
  { code: "G2", title: "Column Design Summary" },
  { code: "G3", title: "Slab Design Summary" },
  { code: "G4", title: "Wall / Shear Wall Design Summary" },
  { code: "G5", title: "Foundation Design Summary" },
  { code: "H", title: "Model Validation / QC Summary" },
  { code: "I", title: "Quantity Summary" },
  { code: "J", title: "Appendix" },
];
