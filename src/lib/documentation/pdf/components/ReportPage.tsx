/**
 * ReportPage — Phase 11b
 *
 * Design Report এর প্রতিটা section (A-J, Phase 11c+) এই wrapper
 * ব্যবহার করবে, portrait A4 তে। Drawing Sheets (S-00 থেকে S-11,
 * Phase 11h) landscape A3 তে যাবে, প্রতিটা sheet এ Titleblock
 * (titleblock.tsx) যুক্ত থাকবে — সেই কারণে size prop এখানেই রাখা
 * হলো, প্রতিটা caller নিজে না ঠিক করে।
 *
 * @react-pdf/renderer এর <Page> নিজেই size/orientation নেয়, কিন্তু
 * margin/pageNumber/footer প্রতিটা document আলাদাভাবে বসালে অসঙ্গতি
 * তৈরি হতো (কোনো sheet এ পেজ নম্বর বামে, কোনোটায় ডানে) — এই wrapper
 * সেই common অংশ একবার ঠিক করে দেয়।
 */

import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { pdfColors, pdfFonts, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";

export type ReportPageSize = "A4" | "A3";
export type ReportPageOrientation = "portrait" | "landscape";

export interface ReportPageProps {
  size?: ReportPageSize;
  orientation?: ReportPageOrientation;
  /** নিচে ফুটারে দেখানো হবে, যেমন "Design Report — Section C: General Information"। */
  footerLabel?: string;
  /** react-pdf এর render prop pattern — প্রতিটা পেজে বর্তমান/মোট পেজ নম্বর বসাতে। */
  showPageNumber?: boolean;
  children: ReactNode;
}

const styles = StyleSheet.create({
  page: {
    padding: `${pdfSpacing.pageMarginMm}mm`,
    fontFamily: pdfFonts.body,
    fontSize: pdfFontSize.body,
    color: pdfColors.ink,
    backgroundColor: pdfColors.paper,
  },
  footer: {
    position: "absolute",
    bottom: 8,
    left: `${pdfSpacing.pageMarginMm}mm`,
    right: `${pdfSpacing.pageMarginMm}mm`,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: pdfFontSize.caption,
    color: pdfColors.inkMuted,
    borderTopWidth: 0.5,
    borderTopColor: pdfColors.hairline,
    paddingTop: 3,
  },
});

/**
 * Design Report এর body sections এর জন্য — Titleblock ছাড়া, শুধু
 * margin/footer/page-number। Drawing Sheets এর জন্য নিচে ReportSheetPage
 * (Titleblock-সহ) ব্যবহার হবে।
 */
export function ReportPage({
  size = "A4",
  orientation = "portrait",
  footerLabel,
  showPageNumber = true,
  children,
}: ReportPageProps) {
  return (
    <Page size={size} orientation={orientation} style={styles.page}>
      {children}
      {(footerLabel || showPageNumber) && (
        <View style={styles.footer} fixed>
          <Text>{footerLabel ?? ""}</Text>
          {showPageNumber && (
            <Text
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          )}
        </View>
      )}
    </Page>
  );
}
