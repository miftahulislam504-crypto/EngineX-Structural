/**
 * CalcSheetHeader — Phase 11e
 *
 * প্লানের চাহিদা: "Header (প্রতি পাতায় repeat): Member ID/mark,
 * element type (Beam/Column/Slab/Footing), story/location, grid
 * reference; Design code reference (BNBC 2020 Cl. X.X / ACI 318-19
 * Section X.X)"।
 *
 * সততার সাথে সীমাবদ্ধতা: "grid reference" — element.ts এর কোনো
 * StructuralElement এ pre-computed নিকটতম-গ্রিড লেবেল সংরক্ষিত নেই
 * (শুধু startPoint/endPoint কোঅর্ডিনেট আছে)। এই কোডবেসে কোথাও
 * "nearest grid" computation ও নেই (nearest-grid বের করতে একটা
 * distance-to-grid-line হিসাব লাগবে, যা দুই-দিকের grid coordinate
 * এর বিপরীতে element এর position tolerance-সহ মেলানো — এটা একটা
 * নতুন geometry ফাংশন, শুধু Documentation Engine এর জন্য এখানে
 * অনুমান করে বসানো ঠিক হতো না)। তাই এই ফিল্ড "Not specified" দেখায়
 * — story/location এর মতো অন্য ফিল্ডগুলো storyId → GeometryCore.stories
 * lookup থেকে সঠিকভাবে আসে।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { pdfColors, pdfFontSize } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { DesignResult } from "@/lib/design/firestore";

export interface CalcSheetHeaderProps {
  context: ReportContext;
  result: DesignResult;
  elementTypeLabel: string;
  /** যেমন "ACI 318-19 Section 9.3" — caller প্রতিটা check-এর জন্য নির্দিষ্ট ক্লজ পাঠাবে, না দিলে প্রজেক্টের overall design code দেখায়। */
  codeReference?: string;
}

const styles = StyleSheet.create({
  block: {
    borderWidth: 1,
    borderColor: pdfColors.hairlineStrong,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.hairline,
  },
  rowLast: {
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 0.5,
    borderRightColor: pdfColors.hairline,
  },
  cellLast: {
    flex: 1,
    padding: 6,
  },
  label: {
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
  },
  value: {
    fontSize: pdfFontSize.body,
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
  },
});

export function CalcSheetHeader({
  context,
  result,
  elementTypeLabel,
  codeReference,
}: CalcSheetHeaderProps) {
  const story = context.geometry.stories.find((s) => s.storyId === result.storyId);
  const designCode = context.hub?.projectInfo.designCode;
  const defaultCodeRef = designCode ? `${designCode.concrete} / ${designCode.seismic}` : "Not specified";

  return (
    <View style={styles.block} fixed>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.label}>Member ID</Text>
          <Text style={styles.value}>{result.elementLabel}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Element Type</Text>
          <Text style={styles.value}>{elementTypeLabel}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Story / Location</Text>
          <Text style={styles.value}>{story?.name ?? "Not specified"}</Text>
        </View>
        <View style={styles.cellLast}>
          <Text style={styles.label}>Grid Reference</Text>
          <Text style={styles.value}>Not specified</Text>
        </View>
      </View>
      <View style={styles.rowLast}>
        <View style={styles.cellLast}>
          <Text style={styles.label}>Design Code Reference</Text>
          <Text style={styles.value}>{codeReference ?? defaultCodeRef}</Text>
        </View>
      </View>
    </View>
  );
}
