/**
 * ReportPage — Phase 11b, extended 2026-08-25 for the CivilOS-wide
 * unified sheet design spec (SHEET-DESIGN-SPEC.md) to optionally carry
 * the same vertical-sidebar Titleblock used by Drawing Sheets
 * (ReportSheetPage). Design Report / BBS / Calc Sheets / QC Report /
 * General Notes sections previously rendered with NO titleblock at
 * all — only Drawing Sheets got one, through the separate
 * ReportSheetPage wrapper. This closes that gap for the remaining 5
 * document kinds without requiring each of those 16+ section/sheet
 * files to restructure their own layout: they pass one new
 * `titleblock` prop instead, and this component does the row-wrap.
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
 *
 * SectionA_Cover (Design Report এর নিজস্ব full-page centered cover
 * layout) ইচ্ছাকৃতভাবে `titleblock` prop ব্যবহার করে না — MICON
 * রেফারেন্স সেটেও Content Sheet এর আগে একটা আলাদা full-page cover
 * থাকে (কোনো sidebar ছাড়া), তাই এটা spec এর ব্যতিক্রম না, বরং spec
 * নিজেই সেই ধরনের cover কে আলাদা রাখার সুযোগ দেয় (spec section 5)।
 */

import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { pdfColors, pdfFonts, pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import { Titleblock, type TitleblockProps } from "@/lib/documentation/pdf/components/Titleblock";

export type ReportPageSize = "A4" | "A3";
export type ReportPageOrientation = "portrait" | "landscape";

export interface ReportPageProps {
  size?: ReportPageSize;
  orientation?: ReportPageOrientation;
  /** নিচে ফুটারে দেখানো হবে, যেমন "Design Report — Section C: General Information"। */
  footerLabel?: string;
  /** react-pdf এর render prop pattern — প্রতিটা পেজে বর্তমান/মোট পেজ নম্বর বসাতে। */
  showPageNumber?: boolean;
  /**
   * দেওয়া হলে, children এর ডানে full-height vertical sidebar বসে
   * (ReportSheetPage এর row-layout এর same pattern, এখানে সব
   * ReportPage caller এর জন্য সাধারণীকরণ করা হলো)। SectionA_Cover এর
   * মতো ইচ্ছাকৃতভাবে titleblock ছাড়া থাকা page এ omit করাই যথেষ্ট।
   */
  titleblock?: TitleblockProps;
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
  contentRow: {
    flex: 1,
    flexDirection: "row",
  },
  contentLeft: {
    flex: 1,
    // Defense-in-depth: a caller whose own content includes a
    // flexDirection:"row" line where the value <Text> has no flex/width
    // (common in "label: value" meta rows) can render wider than this
    // column and bleed straight across the sidebar — confirmed via an
    // isolated react-pdf test during this change, this is react-pdf's
    // own row-overflow behavior, not something introduced by adding the
    // sidebar. overflow:"hidden" here won't fix a caller's row (that
    // still needs its own value <Text> to carry flex:1/flexShrink:1),
    // but it guarantees the failure mode is a caller's own content
    // getting clipped at this column's edge — never bleeding across the
    // titleblock and making the sidebar itself unreadable.
    overflow: "hidden",
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
 * Design Report এর body sections এর জন্য — সাথে ঐচ্ছিক titleblock
 * (দেওয়া হলে vertical sidebar, না দিলে আগের মতোই sidebar-less)।
 * Drawing Sheets এর জন্য এখনো ReportSheetPage (এই কম্পোনেন্টেরই
 * উপরে, titleblock prop টা internally পাস করে) ব্যবহার হয়।
 */
export function ReportPage({
  size = "A4",
  orientation = "portrait",
  footerLabel,
  showPageNumber = true,
  titleblock,
  children,
}: ReportPageProps) {
  // Guard confirmed necessary by an isolated react-pdf test during this
  // change: a `fixed`-marked sidebar whose ~20 stacked blocks exceed the
  // page's available height causes @react-pdf/renderer's own pagination
  // to hang indefinitely (no error, no timeout — reproduced down to the
  // exact block-count threshold with a plain non-Titleblock test, so
  // this is react-pdf's own behavior, not specific to this component).
  // A3 landscape and A4 portrait both have enough height for the full
  // block sequence (verified via render+rasterize) and are the only
  // two size/orientation combinations any real caller in this app
  // actually uses. A4 landscape does not have enough height and no
  // caller currently requests it — this throws immediately instead of
  // letting a future caller silently hang a server process.
  if (titleblock && size === "A4" && orientation === "landscape") {
    throw new Error(
      "ReportPage: titleblock is not supported with size=\"A4\" orientation=\"landscape\" — " +
        "the full sidebar block sequence does not fit A4 landscape's available height, and " +
        "@react-pdf/renderer hangs indefinitely rather than erroring when a fixed element " +
        "overflows the page. Use size=\"A3\" (landscape, for drawing sheets) or the default " +
        "size=\"A4\" orientation=\"portrait\" (for report sections) instead."
    );
  }

  return (
    <Page size={size} orientation={orientation} style={styles.page}>
      {titleblock ? (
        <View style={styles.contentRow}>
          <View style={styles.contentLeft}>{children}</View>
          <Titleblock {...titleblock} />
        </View>
      ) : (
        children
      )}
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
