/**
 * Drawing Sheet Index — Phase 11h
 *
 * এই তালিকা আগের ধারণা ("S-00 থেকে S-11", Titleblock.tsx/ReportSheetPage.tsx
 * এর comment-এ) থেকে সম্পূর্ণ ভিন্ন — সেই ১২-সংখ্যাটা কোনো নিশ্চিত প্লান
 * ডকুমেন্ট থেকে না, আগের phase-এর একটা অনুমান ছিল। ব্যবহারকারীর দেওয়া
 * প্রকৃত রেফারেন্স ড্রয়িং সেট (MICON, "Doilipara" প্রজেক্ট, Content Sheet
 * S.T-00) অনুযায়ী আসল সেট নিচের ২০-এন্ট্রি তালিকা (S.T-00 থেকে S.T-24,
 * কিছু এন্ট্রি একাধিক sheet নম্বর জুড়ে — S.T-06~07 ইত্যাদি)।
 *
 * sheetNumber কনভেনশন — রেফারেন্স ড্রয়িং এ "S.T-XX" ফরম্যাট ব্যবহৃত;
 * এই কোডবেসের বাকি সব জায়গায় (Titleblock.tsx, BbsSheetDocument.tsx S-10,
 * GeneralNotesSheet.tsx S-01) "S-XX" ফরম্যাট (ডট ছাড়া) ব্যবহৃত হয়েছে —
 * সেই বিদ্যমান কনভেনশন এখানেও রাখা হলো (ডট বাদ), যাতে পুরো ডকুমেন্ট
 * বান্ডলে sheet number ফরম্যাট সামঞ্জস্যপূর্ণ থাকে।
 *
 * dataStatus — প্রতিটা entry-র সাথে honest ভাবে চিহ্নিত করা আছে এই
 * app-এর বর্তমান data model দিয়ে কতটুকু বানানো সম্ভব:
 *   "full"        — layout+schedule পুরোপুরি real ডেটা দিয়ে বানানো যায়
 *   "partial"     — layout/schedule অংশ real ডেটা দিয়ে, detail/section
 *                    অংশ আংশিক (approximate sketch, honest caption সহ)
 *   "unmodeled"   — এই element category/সাব-সিস্টেম (স্টেয়ার, OHWT,
 *                    UGWR, machine room) app-এর data schema-তে কোথাও
 *                    মডেল করা নেই — placeholder sheet, titleblock+নোট
 */

export type SheetDataStatus = "full" | "partial" | "unmodeled";

export interface SheetIndexEntry {
  sheetNumber: string;
  title: string;
  dataStatus: SheetDataStatus;
  /** dataStatus partial/unmodeled হলে — ঠিক কী কারণে সীমাবদ্ধতা, ব্যবহারকারীর জন্য explicit। */
  limitationNote?: string;
  /** রেফারেন্স ড্রয়িং এর মূল sheet নম্বর(গুলো) — traceability এর জন্য, যাতে কোনো S.T-XX "হারিয়ে" না যায় দুইটা directional view একসাথে merge করার কারণে। */
  originalSheetNumbers: string;
}

export const SHEET_INDEX: SheetIndexEntry[] = [
  { sheetNumber: "S-00", title: "Content Sheet", dataStatus: "full", originalSheetNumbers: "S.T-00" },
  { sheetNumber: "S-01", title: "General Notes", dataStatus: "full", originalSheetNumbers: "S.T-01" },
  { sheetNumber: "S-02", title: "Column Layout Plan", dataStatus: "full", originalSheetNumbers: "S.T-02" },
  { sheetNumber: "S-03", title: "Column Schedule", dataStatus: "full", originalSheetNumbers: "S.T-03" },
  {
    sheetNumber: "S-04",
    title: "Footing Layout Plan",
    dataStatus: "partial",
    limitationNote:
      "Footing position/outline is not independently stored in this data model (no confirmed position field, no explicit column-to-footing link) — plan shows grid lines and supporting column markers only.",
    originalSheetNumbers: "S.T-04",
  },
  { sheetNumber: "S-05", title: "Footing Schedule", dataStatus: "full", originalSheetNumbers: "S.T-05" },
  {
    sheetNumber: "S-06",
    title: "Grade Beam Layout Plan",
    dataStatus: "full",
    originalSheetNumbers: "S.T-06",
  },
  {
    sheetNumber: "S-07",
    title: "Grade Beam Details",
    dataStatus: "partial",
    limitationNote:
      "Section cut sketches show real bar count/diameter and top/bottom position (from DetailingResult.longitudinalBars where available, otherwise inferred from bar mark) — within-row bar spacing is evenly approximated, not exact shop-drawing placement.",
    originalSheetNumbers: "S.T-07",
  },
  { sheetNumber: "S-08", title: "Typical Floor Beam Layout Plan", dataStatus: "full", originalSheetNumbers: "S.T-08" },
  {
    sheetNumber: "S-09",
    title: "Typical Floor Beam Details",
    dataStatus: "partial",
    limitationNote:
      "Section cut sketches show real bar count/diameter and top/bottom position (from DetailingResult.longitudinalBars where available, otherwise inferred from bar mark) — within-row bar spacing is evenly approximated, not exact shop-drawing placement.",
    originalSheetNumbers: "S.T-09~10",
  },
  {
    sheetNumber: "S-10",
    title: "Typical Floor Slab Reinforcement Layout Plan (E-W Direction)",
    dataStatus: "partial",
    limitationNote:
      "Slab boundary is plotted from stored polygon vertices; bar-direction-wise (E-W) reinforcement split is not separately stored in this data model, so only the slab outline and category label are shown, not individual bar runs.",
    originalSheetNumbers: "S.T-11",
  },
  {
    sheetNumber: "S-11",
    title: "Typical Floor Slab Reinforcement Layout Plan (N-S Direction)",
    dataStatus: "partial",
    limitationNote:
      "Slab boundary is plotted from stored polygon vertices; bar-direction-wise (N-S) reinforcement split is not separately stored in this data model, so only the slab outline and category label are shown, not individual bar runs.",
    originalSheetNumbers: "S.T-12~13",
  },
  {
    sheetNumber: "S-12",
    title: "Machine Room & O.H.W.T Bottom & Top Beam Details",
    dataStatus: "unmodeled",
    limitationNote:
      "Machine room / overhead water tank (O.H.W.T) is not a modeled element category in this application's schema (no category value for it).",
    originalSheetNumbers: "S.T-14",
  },
  { sheetNumber: "S-13", title: "Roof Floor Beam Layout Plan", dataStatus: "full", originalSheetNumbers: "S.T-16" },
  {
    sheetNumber: "S-14",
    title: "Roof Floor Beam Details",
    dataStatus: "partial",
    limitationNote:
      "Section cut sketches show real bar count/diameter and top/bottom position (from DetailingResult.longitudinalBars where available, otherwise inferred from bar mark) — within-row bar spacing is evenly approximated, not exact shop-drawing placement.",
    originalSheetNumbers: "S.T-17~18",
  },
  {
    sheetNumber: "S-15",
    title: "Roof Floor Slab Reinforcement Layout Plan (E-W Direction)",
    dataStatus: "partial",
    limitationNote:
      "Slab boundary is plotted from stored polygon vertices; bar-direction-wise (E-W) reinforcement split is not separately stored in this data model.",
    originalSheetNumbers: "S.T-15, S.T-19",
  },
  {
    sheetNumber: "S-16",
    title: "Roof Floor Slab Reinforcement Layout Plan (N-S Direction)",
    dataStatus: "partial",
    limitationNote:
      "Slab boundary is plotted from stored polygon vertices; bar-direction-wise (N-S) reinforcement split is not separately stored in this data model.",
    originalSheetNumbers: "S.T-20",
  },
  {
    sheetNumber: "S-17",
    title: "Machine Room & O.H.W.T Bottom & Top Slab Details",
    dataStatus: "unmodeled",
    limitationNote:
      "Machine room / overhead water tank (O.H.W.T) is not a modeled element category in this application's schema.",
    originalSheetNumbers: "S.T-21",
  },
  {
    sheetNumber: "S-18",
    title: "Stair Plan & Section, Landing Beam (LB) Details",
    dataStatus: "unmodeled",
    limitationNote: "Stair and landing beam are not modeled element categories in this application's schema.",
    originalSheetNumbers: "S.T-22",
  },
  {
    sheetNumber: "S-19",
    title: "U.G.W.R Layout Plan & Section Details",
    dataStatus: "unmodeled",
    limitationNote:
      "Underground water reservoir (U.G.W.R) is not a modeled element category in this application's schema.",
    originalSheetNumbers: "S.T-23~24",
  },
];
