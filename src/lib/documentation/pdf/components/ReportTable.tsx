/**
 * ReportTable — Phase 11b
 *
 * প্রায় প্রতিটা document এ টেবিল আছে (Design Report এর C-J প্রায়
 * সবই টেবিল, BBS পুরোটাই টেবিল, QC Report এর Issues Summary টেবিল,
 * General Notes এর ৫টা আলাদা টেবিল)। প্রতিটা template নিজে নিজে
 * <View>/<Text> দিয়ে টেবিল বানালে column-width/border/header-style
 * এ অসঙ্গতি হতো — তাই একটাই generic, column-config-driven টেবিল
 * primitive।
 *
 * @react-pdf/renderer এ HTML <table> নেই (flexbox-ভিত্তিক View/Text
 * দিয়েই টেবিল বানাতে হয়) — তাই এই component সেই flexbox pattern
 * একবার সঠিকভাবে বানিয়ে বাকি সব template কে সেটা থেকে মুক্তি দেয়।
 */

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { pdfColors, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";

export interface ReportTableColumn<T> {
  key: string;
  header: string;
  /** flex-grow অনুপাত — না দিলে 1 (সমান ভাগ)। সংখ্যাসূচক কলাম (dia, count) সাধারণত ছোট width চায়। */
  flex?: number;
  align?: "left" | "center" | "right";
  /** raw ভ্যালুর বদলে custom রেন্ডার (যেমন StatusBadge বসাতে)। না দিলে String(row[key]) দেখাবে। */
  render?: (row: T) => ReactNode;
}

export interface ReportTableProps<T> {
  columns: ReportTableColumn<T>[];
  rows: T[];
  /** টেবিল পেজ-ব্রেকে হেডার রো রিপিট করবে কিনা — লম্বা টেবিলে (BBS, Design Summary) সবসময় true রাখা উচিত। */
  repeatHeader?: boolean;
  /** BBS এর element-type-wise sub-table গ্রুপিং এর জন্য — প্রতি group এর আগে একটা label row। */
  groupLabel?: string;
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 0.5,
    borderColor: pdfColors.hairline,
    marginBottom: pdfSpacing.sectionGap,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: pdfColors.panel,
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.hairlineStrong,
  },
  bodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.hairline,
  },
  cell: {
    paddingVertical: pdfSpacing.rowPaddingV,
    paddingHorizontal: pdfSpacing.rowPaddingH,
  },
  headerText: {
    fontSize: pdfFontSize.tableHeader,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.ink,
  },
  bodyText: {
    fontSize: pdfFontSize.tableBody,
    color: pdfColors.ink,
  },
  groupLabelRow: {
    backgroundColor: pdfColors.panel,
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.hairlineStrong,
    paddingVertical: pdfSpacing.rowPaddingV,
    paddingHorizontal: pdfSpacing.rowPaddingH,
  },
  groupLabelText: {
    fontSize: pdfFontSize.tableHeader,
    fontFamily: "Helvetica-Bold",
  },
});

function alignToJustify(align: "left" | "center" | "right" = "left") {
  return align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
}

/**
 * generic টেবিল — row অবজেক্টের টাইপ T ক্যালারের নিজের (BbsEntry,
 * DesignResult সারাংশ row, ইত্যাদি) হতে পারে, column config দিয়ে
 * কোন key কোন header এ যাবে তা ঠিক হয়।
 *
 * T কে আগে Record<string, unknown> দিয়ে constrain করা হয়েছিল, যাতে
 * row[col.key] ইনডেক্স করা যায় — কিন্তু codebase এর আসল ডেটা টাইপ
 * (DesignResult, BbsEntry ইত্যাদি) সবই plain interface, কোনোটারই
 * নিজস্ব index signature নেই, তাই সেই constraint প্রতিটা caller কে
 * ব্যর্থ করত। এখানে T এর উপর কোনো constraint নেই — শুধু render()
 * fallback এর ভেতরে (যেখানে সত্যিই ডাইনামিক key lookup দরকার) একটা
 * লোকাল cast ব্যবহার করা হয়েছে।
 */
export function ReportTable<T>({
  columns,
  rows,
  repeatHeader = true,
  groupLabel,
}: ReportTableProps<T>) {
  return (
    <View style={styles.table}>
      {groupLabel && (
        <View style={styles.groupLabelRow}>
          <Text style={styles.groupLabelText}>{groupLabel}</Text>
        </View>
      )}
      <View style={styles.headerRow} fixed={repeatHeader}>
        {columns.map((col) => (
          <View
            key={col.key}
            style={[styles.cell, { flex: col.flex ?? 1, alignItems: alignToJustify(col.align) }]}
          >
            <Text style={styles.headerText}>{col.header}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.bodyRow} wrap={false}>
          {columns.map((col) => (
            <View
              key={col.key}
              style={[styles.cell, { flex: col.flex ?? 1, alignItems: alignToJustify(col.align) }]}
            >
              {col.render ? (
                col.render(row)
              ) : (
                <Text style={styles.bodyText}>
                  {String((row as Record<string, unknown>)[col.key] ?? "—")}
                </Text>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
