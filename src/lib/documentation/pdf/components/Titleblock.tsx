/**
 * Titleblock — Phase 11b
 *
 * মূল প্লানের সরাসরি চাহিদা: "প্রতিটা drawing sheet-এ standard
 * titleblock (project, sheet no., scale, date, revision) — EngineXDraw-এর
 * sheet annotation প্যাটার্ন এখানে reuse করা যাবে।" এই ফাইলটাই সেই
 * একক reuse-able titleblock — S-00 থেকে S-11 (Phase 11h) প্রতিটা
 * sheet এই একই component বসাবে, নিজে নিজে titleblock বানাবে না।
 *
 * Design Report এর Cover Page (Section A, Phase 11c) এই component
 * ব্যবহার করে না (রিপোর্টের নিজস্ব cover layout আছে, সেটা titleblock
 * না) — কিন্তু project/client/code-basis তথ্যের সোর্স একই
 * (HubProjectInfo), তাই ফিল্ড ম্যাপিং এখানে ঠিক করে রাখাটা Section A
 * লেখার সময় consistency নিশ্চিত করবে।
 *
 * নোট: EngineXDraw এর sheet annotation প্যাটার্ন এই কোডবেসে (CivilOS
 * Structural repo) পাওয়া যায়নি — EngineXDraw সম্ভবত CivilOS ecosystem
 * এর আরেকটা আলাদা app (আলাদা repo)। তাই এখানে reuse আক্ষরিক কোড-শেয়ার
 * হিসেবে সম্ভব হয়নি — বরং তার বর্ণিত কাঠামো (project/sheet no./scale/
 * date/revision ব্লক-ভিত্তিক লেআউট) অনুসরণ করে নতুন করে বানানো হলো।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { HubProjectInfo } from "@/lib/types/hub";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";

export interface TitleblockProps {
  project: HubProjectInfo | null;
  /** যেমন "S-04", "S-10" — Drawing Sheet এর নিজস্ব sheet নম্বর (Phase 11h)। */
  sheetNumber: string;
  /** যেমন "Framing / Beam Layout Plan — Level 2"। */
  sheetTitle: string;
  /** যেমন "1:100", "NTS" (Not to Scale)। */
  scale: string;
  /** caller ঠিক করে দেয় (ReportContext.generatedAt থেকে), যাতে পুরো bundle এ একই তারিখ থাকে। */
  date: string;
  revisionNumber: string;
  drawnBy?: string;
  checkedBy?: string;
}

const styles = StyleSheet.create({
  block: {
    borderWidth: 1,
    borderColor: pdfColors.hairlineStrong,
    marginTop: pdfSpacing.sectionGap,
  },
  topRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.hairlineStrong,
  },
  projectCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: pdfColors.hairlineStrong,
  },
  codeCell: {
    width: 130,
    padding: 6,
  },
  projectName: {
    fontSize: pdfFontSize.h3,
    fontFamily: "Helvetica-Bold",
  },
  clientLine: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    marginTop: 2,
  },
  codeLine: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
  },
  sheetRow: {
    flexDirection: "row",
  },
  sheetTitleCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: pdfColors.hairlineStrong,
    justifyContent: "center",
  },
  metaCell: {
    width: 90,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: pdfColors.hairlineStrong,
    justifyContent: "center",
  },
  metaCellLast: {
    width: 90,
    padding: 6,
    justifyContent: "center",
  },
  metaLabel: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
  },
  metaValue: {
    fontSize: pdfFontSize.h3,
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
  },
  sheetNumberValue: {
    fontSize: pdfFontSize.h1,
    fontFamily: "Helvetica-Bold",
  },
});

/** designCode.concrete/seismic/wind একসাথে একই মান হলে (সাধারণ কেস BNBC 2020) ডুপ্লিকেট না দেখিয়ে একবার দেখায়। */
function formatCodeBasis(designCode: HubProjectInfo["designCode"] | undefined): string {
  if (!designCode) return "—";
  const unique = Array.from(
    new Set([designCode.concrete, designCode.steel, designCode.seismic, designCode.wind])
  );
  return unique.join(" / ");
}

export function Titleblock({
  project,
  sheetNumber,
  sheetTitle,
  scale,
  date,
  revisionNumber,
  drawnBy,
  checkedBy,
}: TitleblockProps) {
  return (
    <View style={styles.block} fixed>
      <View style={styles.topRow}>
        <View style={styles.projectCell}>
          <Text style={styles.projectName}>{project?.projectName ?? "Untitled Project"}</Text>
          {project?.clientName && <Text style={styles.clientLine}>Client: {project.clientName}</Text>}
          {project?.location?.address && (
            <Text style={styles.clientLine}>{project.location.address}</Text>
          )}
        </View>
        <View style={styles.codeCell}>
          <Text style={styles.metaLabel}>Design Code</Text>
          <Text style={styles.codeLine}>{formatCodeBasis(project?.designCode)}</Text>
        </View>
      </View>

      <View style={styles.sheetRow}>
        <View style={styles.sheetTitleCell}>
          <Text style={styles.metaLabel}>Sheet Title</Text>
          <Text style={styles.metaValue}>{sheetTitle}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Scale</Text>
          <Text style={styles.metaValue}>{scale}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaValue}>{date}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Rev.</Text>
          <Text style={styles.metaValue}>{revisionNumber}</Text>
        </View>
        {(drawnBy || checkedBy) && (
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Drawn / Checked</Text>
            <Text style={styles.codeLine}>
              {drawnBy ?? "—"} / {checkedBy ?? "—"}
            </Text>
          </View>
        )}
        <View style={styles.metaCellLast}>
          <Text style={styles.metaLabel}>Sheet No.</Text>
          <Text style={styles.sheetNumberValue}>{sheetNumber}</Text>
        </View>
      </View>
    </View>
  );
}
