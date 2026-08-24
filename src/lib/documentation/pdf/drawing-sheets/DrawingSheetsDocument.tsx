/**
 * DrawingSheetsDocument — Phase 11h (composer)
 *
 * এই ফাইলটাই GradeBeamDetailsSheet.tsx/TypicalFloorBeamDetailsSheet.tsx
 * এর docblock গুলোতে আগে থেকে forward-reference করা ছিল ("for bundling
 * in DrawingSheetsDocument.tsx") — এতদিন তৈরি হয়নি, এই commit এ প্রথমবার।
 *
 * উদ্দেশ্য: S-00 থেকে S-19 (S-01 বাদে, যেটা Phase 11g তে আলাদা ফোল্ডারে
 * তৈরি হয়েছে — general-notes/GeneralNotesSheet.tsx), S-20 (Beam
 * Schedule, Phase B2), S-21 (Column Starter/Splice Detail, Phase B3),
 * S-22 (Column Reinforcement Detail, Phase B4), S-23 (Beam-Column
 * Joint Detail, Phase B5), S-24 (Wall/Shear Wall Layout Plan,
 * Phase B1 — এর পেয়ার Wall Calc Sheet CalcSheetsDocument.tsx এ, এই
 * drawing-sheets বান্ডলে না, calc-sheets এর নিজস্ব বান্ডলে), এবং S-25
 * (Parapet Layout Plan, 2026-08-24 — S-24-এর ঠিক একই প্যাটার্নে, Wall
 * Calc Sheet-এর মতো কোনো পেয়ার calc sheet নেই কারণ parapet-এর নিজস্ব
 * কোনো design check এই App-এ নেই, শুধু self-weight contribution) —
 * সবগুলো মূল ২০-এন্ট্রি reference set এর বাইরে — সবগুলো sheet কে একটাই
 * react-pdf Document এ, ধারাবাহিক ক্রমে জুড়ে একটা single downloadable
 * "Structural Working Drawings" PDF বানায় — ঠিক যেভাবে আসল MICON
 * রেফারেন্স ড্রয়িং সেট (ব্যবহারকারীর দেওয়া) একটাই bound sheet-set
 * হিসেবে ডেলিভার হয়।
 *
 * unmodeled sheet গুলো (S-12, S-17, S-18, S-19 — Machine Room/O.H.W.T
 * Beam+Slab Details, Stair, U.G.W.R) আলাদা ফাইল হিসেবে বানানো হয়নি,
 * কারণ প্রতিটাই একই generic UnmodeledSheetPlaceholder.tsx কে
 * sheetIndex.ts এর entry দিয়ে parameterize করে — আলাদা ফাইলে ডুপ্লিকেট
 * করলে "titleblock + honest note" ছাড়া আর কিছুই আলাদা থাকত না।
 *
 * প্রতিটা sheet এর "...Content" export ব্যবহার করা হয়েছে (Document
 * wrapper ছাড়া, শুধু ReportSheetPage/Fragment) — প্রতিটা sheet ফাইলের
 * নিজস্ব "...Sheet" export (Document সহ) standalone single-sheet
 * ডাউনলোডের জন্য আলাদা রাখা হয়েছে, দুটো ব্যবহারের ক্ষেত্র (একটা sheet
 * vs পুরো সেট) আলাদা প্রয়োজন মেটায়।
 */

import { Document } from "@react-pdf/renderer";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { SHEET_INDEX } from "@/lib/documentation/pdf/drawing-sheets/sheetIndex";
import { UnmodeledSheetPlaceholderContent } from "@/lib/documentation/pdf/drawing-sheets/UnmodeledSheetPlaceholder";
import { ContentSheetContent } from "@/lib/documentation/pdf/drawing-sheets/ContentSheet";
// GeneralNotesSheet (S-01) ইচ্ছাকৃতভাবে এখানে বান্ডল করা হয়নি — নিচের
// docblock/render এর ঠিক আগে ব্যাখ্যা দেখুন।
import { ColumnLayoutPlanSheetContent } from "@/lib/documentation/pdf/drawing-sheets/ColumnLayoutPlanSheet";
import { ColumnScheduleSheetContent } from "@/lib/documentation/pdf/drawing-sheets/ColumnScheduleSheet";
import { FootingLayoutPlanSheetContent } from "@/lib/documentation/pdf/drawing-sheets/FootingLayoutPlanSheet";
import { FootingScheduleSheetContent } from "@/lib/documentation/pdf/drawing-sheets/FootingScheduleSheet";
import { GradeBeamLayoutPlanSheetContent } from "@/lib/documentation/pdf/drawing-sheets/GradeBeamLayoutPlanSheet";
import { GradeBeamDetailsSheetContent } from "@/lib/documentation/pdf/drawing-sheets/GradeBeamDetailsSheet";
import { TypicalFloorBeamLayoutPlanSheetContent } from "@/lib/documentation/pdf/drawing-sheets/TypicalFloorBeamLayoutPlanSheet";
import { TypicalFloorBeamDetailsSheetContent } from "@/lib/documentation/pdf/drawing-sheets/TypicalFloorBeamDetailsSheet";
import { BeamScheduleSheetContent } from "@/lib/documentation/pdf/drawing-sheets/BeamScheduleSheet";
import { ColumnSpliceDetailSheetContent } from "@/lib/documentation/pdf/drawing-sheets/ColumnSpliceDetailSheet";
import { ColumnReinforcementDetailSheetContent } from "@/lib/documentation/pdf/drawing-sheets/ColumnReinforcementDetailSheet";
import { BeamColumnJointDetailSheetContent } from "@/lib/documentation/pdf/drawing-sheets/BeamColumnJointDetailSheet";
import { WallLayoutPlanSheetContent } from "@/lib/documentation/pdf/drawing-sheets/WallLayoutPlanSheet";
import { ParapetLayoutPlanSheetContent } from "@/lib/documentation/pdf/drawing-sheets/ParapetLayoutPlanSheet";
import { TypicalFloorSlabLayoutEWSheetContent } from "@/lib/documentation/pdf/drawing-sheets/TypicalFloorSlabLayoutEWSheet";
import { TypicalFloorSlabLayoutNSSheetContent } from "@/lib/documentation/pdf/drawing-sheets/TypicalFloorSlabLayoutNSSheet";
import { RoofFloorBeamLayoutPlanSheetContent } from "@/lib/documentation/pdf/drawing-sheets/RoofFloorBeamLayoutPlanSheet";
import { RoofFloorBeamDetailsSheetContent } from "@/lib/documentation/pdf/drawing-sheets/RoofFloorBeamDetailsSheet";
import { RoofFloorSlabLayoutEWSheetContent } from "@/lib/documentation/pdf/drawing-sheets/RoofFloorSlabLayoutEWSheet";
import { RoofFloorSlabLayoutNSSheetContent } from "@/lib/documentation/pdf/drawing-sheets/RoofFloorSlabLayoutNSSheet";

export interface DrawingSheetsDocumentProps {
  context: ReportContext;
  revisionNumber: string;
}

export function DrawingSheetsDocument({ context, revisionNumber }: DrawingSheetsDocumentProps) {
  const project = context.hub?.projectInfo ?? null;
  const props = { context, revisionNumber };

  const unmodeledEntry = (sheetNumber: string) => SHEET_INDEX.find((s) => s.sheetNumber === sheetNumber)!;

  return (
    <Document
      title={`${project?.projectName ?? "Untitled Project"} — Structural Working Drawings`}
      creator="CivilOS Structural — Documentation Engine"
    >
      <ContentSheetContent {...props} />
      {/* S-01 General Notes এখানে বান্ডল করা হয়নি — GeneralNotesSheet.tsx
          (Phase 11g) ইতিমধ্যে নিজস্ব standalone Document/props shape এ
          তৈরি, এই composer এর অন্য সব sheet এর মতো "...Content" split
          প্যাটার্ন অনুসরণ করে না। এটা ভাঙা ছাড়া মেলানো এই ফেজের স্কোপে
          একটা নতুন refactor হয়ে যেত (11g এর ফাইল বদলানো) — তাই honest
          gap হিসেবে এখানে রাখা হলো: বর্তমানে ব্যবহারকারীকে S-01 আলাদাভাবে
          ডাউনলোড করতে হবে (GeneralNotesSheet), এই combined bundle এ না। */}
      <ColumnLayoutPlanSheetContent {...props} />
      <ColumnScheduleSheetContent {...props} />
      <FootingLayoutPlanSheetContent {...props} />
      <FootingScheduleSheetContent {...props} />
      <GradeBeamLayoutPlanSheetContent {...props} />
      <GradeBeamDetailsSheetContent {...props} />
      <TypicalFloorBeamLayoutPlanSheetContent {...props} />
      <TypicalFloorBeamDetailsSheetContent {...props} />
      <TypicalFloorSlabLayoutEWSheetContent {...props} />
      <TypicalFloorSlabLayoutNSSheetContent {...props} />
      <UnmodeledSheetPlaceholderContent {...props} entry={unmodeledEntry("S-12")} />
      <RoofFloorBeamLayoutPlanSheetContent {...props} />
      <RoofFloorBeamDetailsSheetContent {...props} />
      <RoofFloorSlabLayoutEWSheetContent {...props} />
      <RoofFloorSlabLayoutNSSheetContent {...props} />
      <UnmodeledSheetPlaceholderContent {...props} entry={unmodeledEntry("S-17")} />
      <UnmodeledSheetPlaceholderContent {...props} entry={unmodeledEntry("S-18")} />
      <UnmodeledSheetPlaceholderContent {...props} entry={unmodeledEntry("S-19")} />
      <BeamScheduleSheetContent {...props} />
      <ColumnSpliceDetailSheetContent {...props} />
      <ColumnReinforcementDetailSheetContent {...props} />
      <BeamColumnJointDetailSheetContent {...props} />
      <WallLayoutPlanSheetContent {...props} />
      <ParapetLayoutPlanSheetContent {...props} />
    </Document>
  );
}
