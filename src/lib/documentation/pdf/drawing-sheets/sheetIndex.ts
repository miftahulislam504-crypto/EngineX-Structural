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
 *   "unmodeled"   — এই element category/সাব-সিস্টেম (OHWT, UGWR,
 *                    machine room) app-এর data schema-তে কোথাও মডেল
 *                    করা নেই — placeholder sheet, titleblock+নোট
 *                    (২০২৬-০৮: স্টেয়ার/S-18 আগে এই ক্যাটাগরিতে ছিল,
 *                    Stair implementation Phase 1-4 এর পর এখন
 *                    "partial" — waist-slab flight geometry+design
 *                    real, landing beam এখনো মডেল করা নেই)
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
      "Slab boundary is plotted from stored polygon vertices. Bottom-layer bar run (E-W = local X-axis) is now shown for slabs with a completed design result (Phase B7, 2026-08-20); slabs without one show outline only. Top/negative bars are not shown here — see Calc Sheets / BBS. Slab openings are not a modeled attribute in this application (Phase B6, 2026-08-20) — must be added manually.",
    originalSheetNumbers: "S.T-11",
  },
  {
    sheetNumber: "S-11",
    title: "Typical Floor Slab Reinforcement Layout Plan (N-S Direction)",
    dataStatus: "partial",
    limitationNote:
      "Slab boundary is plotted from stored polygon vertices. Bottom-layer bar run (N-S = local Z-axis) is now shown for slabs with a completed design result (Phase B7, 2026-08-20); slabs without one show outline only. Top/negative bars are not shown here — see Calc Sheets / BBS. Slab openings are not a modeled attribute in this application (Phase B6, 2026-08-20) — must be added manually.",
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
      "Slab boundary is plotted from stored polygon vertices. Bottom-layer bar run (E-W = local X-axis) is now shown for slabs with a completed design result (Phase B7, 2026-08-20); slabs without one show outline only. Slab openings are not a modeled attribute in this application (Phase B6, 2026-08-20) — must be added manually.",
    originalSheetNumbers: "S.T-15, S.T-19",
  },
  {
    sheetNumber: "S-16",
    title: "Roof Floor Slab Reinforcement Layout Plan (N-S Direction)",
    dataStatus: "partial",
    limitationNote:
      "Slab boundary is plotted from stored polygon vertices. Bottom-layer bar run (N-S = local Z-axis) is now shown for slabs with a completed design result (Phase B7, 2026-08-20); slabs without one show outline only. Slab openings are not a modeled attribute in this application (Phase B6, 2026-08-20) — must be added manually.",
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
    dataStatus: "partial",
    limitationNote:
      "Landing beam (LB) schedule/details and a dedicated vertical section-cut view are not yet produced by this application — landings are not imported as a separate modeled element (Draw exports flight geometry only), and no section sketch exists for stairs yet. Flight plan + schedule (waist thickness, slope span/angle, riser, factored load, flexural reinforcement) reflect real model/design data (Stair implementation Phase 1-4, 2026-08).",
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
  {
    sheetNumber: "S-20",
    title: "Beam Schedule",
    dataStatus: "partial",
    limitationNote:
      "Added in Report-Audit Phase B2 (2026-08-20) — not part of the original 20-sheet MICON reference set, so it has no original sheet number. Lists span/size (from DesignResult.detail.input where a beam design was run) and final reinforcement summary (free-text, engineer-entered) per beam element, in a Beam Mark / Span / Size / Final Reinforcement / Stirrup Spacing format. This application does not store separately-tagged top-bar vs bottom-bar fields (only one free-text finalReinforcementSummary per element, same as Column/Footing Schedule) — so reinforcement is shown as one combined column, not split into Top/Bottom columns, to avoid guessing a split the underlying data doesn't actually have.",
    originalSheetNumbers: "N/A — new in this application, not in the original 20-sheet reference set",
  },
  {
    sheetNumber: "S-21",
    title: "Column Starter Bar & Splice Detail",
    dataStatus: "partial",
    limitationNote:
      "Added in Report-Audit Phase B3 (2026-08-20) — not part of the original 20-sheet MICON reference set. Per-column compression development length and lap splice length (ACI 318-19 §25.4.9.2/§25.4.9.3, §25.5.5.1), computed from each column's own bar diameter/fy/fc where a design result exists. Exact splice location along the column height is not given as a number — that is an engineer decision this application does not calculate a recommendation for. Confinement reduction (spiral/tie, ×0.75 per §25.4.9.3) is not applied — this application has no derived confinement-adequacy flag, so lengths shown are conservative (safe-side, may be longer than strictly required if confinement is adequate).",
    originalSheetNumbers: "N/A — new in this application, not in the original 20-sheet reference set",
  },
  {
    sheetNumber: "S-22",
    title: "Column Reinforcement Detail",
    dataStatus: "partial",
    limitationNote:
      "Added in Report-Audit Phase B4 (2026-08-20) — not part of the original 20-sheet MICON reference set (Column Layout Plan/Schedule, S-02/S-03, existed but no cross-section detail sheet, unlike Beam's S-09). Cross-section sketch (real bar perimeter position + tie) per column, from persisted DetailingResult where available — columns without one show \"No detailing data\" rather than a guessed bar arrangement re-derived from the design's required steel area (which can differ from the engineer's final selected bars).",
    originalSheetNumbers: "N/A — new in this application, not in the original 20-sheet reference set",
  },
  {
    sheetNumber: "S-23",
    title: "Beam-Column Joint Detail",
    dataStatus: "partial",
    limitationNote:
      "Added in Report-Audit Phase B5 (2026-08-20) — not part of the original 20-sheet MICON reference set. This application has no formal ACI 318-19 Ch. 15/18 joint-shear capacity check (verified absent, not built here either — that would be a new design-engine feature, outside documentation-gap scope). Shows only what real data supports: per-column ACI §18.7.5.1 seismic confinement zone length and tie spacing at the joint (layoutColumnTieZones, previously only used in a UI panel, never in a PDF). Seismic confinement is assumed true by default (conservative) — override in the Stirrup/Tie Zone panel if the project is confirmed non-seismic.",
    originalSheetNumbers: "N/A — new in this application, not in the original 20-sheet reference set",
  },
  {
    sheetNumber: "S-24",
    title: "Wall / Shear Wall Layout Plan",
    dataStatus: "partial",
    limitationNote:
      "Added in Report-Audit Phase B1 (2026-08-20) — not part of the original 20-sheet MICON reference set (no Wall Layout Plan existed at all, unlike Column's S-02). Walls are plotted as a single plan-view centerline (the two farthest-apart vertices in XZ projection) — this application has no general 3D vertical-plane area renderer (documented pre-existing gap in quantitySummary.ts), so wall thickness/elevation extent is not drawn, only position/length. See the paired Wall Calc Sheet (in Calculation Sheets) for thickness, axial/shear capacity, and reinforcement.",
    originalSheetNumbers: "N/A — new in this application, not in the original 20-sheet reference set",
  },
  {
    sheetNumber: "S-25",
    title: "Parapet Layout Plan",
    dataStatus: "partial",
    limitationNote:
      "Added following the Draw→Structural Parapet gap closure (2026-08-24) — not part of the original 20-sheet MICON reference set, and Parapet was not modeled or exported to Hub at all before this. Parapet is plotted the same way as Wall/Shear Wall (S-24) — a single plan-view centerline, no thickness/elevation extent drawn. This application has no dedicated structural design check for parapets (no wind/seismic guard-rail capacity check) — parapet self-weight is included in the building's dead load only.",
    originalSheetNumbers: "N/A — new in this application, not in the original 20-sheet reference set",
  },
];
