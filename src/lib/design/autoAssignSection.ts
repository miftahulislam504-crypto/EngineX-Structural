/**
 * autoAssignSection.ts — Beam/Column এর জন্য span/category ভিত্তিক
 * preliminary section auto-select।
 * ------------------------------------------------------------------
 * Miftahul এর অনুরোধ: "section আমি বসাতে চাই না, এটা অটোমেটিক সব
 * সেকশন হয়ে থাকবে" — element তৈরির সময় ইঞ্জিনিয়ারকে আর ম্যানুয়ালি
 * "Standard Size" dropdown থেকে বাছতে হবে না, এই ফাংশন span থেকে
 * preliminary sizing বের করে existing preset library
 * (@/lib/library/standardSectionPresets) থেকে নিকটতম উপযুক্ত size
 * নিজে বেছে দেয়।
 *
 * এটা deriveSelfWeightLoads.ts এর ঠিক একই প্যাটার্ন — pure function,
 * কোনো Firestore write বা side-effect নেই। caller (element creation
 * flow) এই ফাংশনের রেজাল্ট থেকে হয় existing library section এর
 * sectionId ব্যবহার করবে, অথবা matchedExisting না থাকলে
 * newSectionToCreate অবজেক্টটা library তে save করে সেই sectionId
 * ব্যবহার করবে — persist করা caller এর দায়িত্ব।
 *
 * সততার সাথে সীমাবদ্ধতা (preliminary sizing, চূড়ান্ত ডিজাইন না):
 *   - Beam depth rule: h ≈ span/12 (BNBC 2020 সাধারণ deflection-control
 *     প্র্যাকটিসে ব্যবহৃত মোটামুটি রেঞ্জ, simply-supported থেকে
 *     continuous span-এর মধ্যবর্তী একটা reasonable প্রথম অনুমান)।
 *     b তারপর h/2 এর কাছাকাছি ধরা হয় (সাধারণ b:h ≈ 1:2 অনুপাত), তারপর
 *     STANDARD_BEAM_PRESETS থেকে নিকটতম মিলিয়ে (b, h) বাছাই।
 *   - Column rule: এই ফাংশনে কোনো tributary-area load calculation
 *     নেই (সেটার জন্য elements/loads/story height সব লাগবে, এই
 *     module এর scope এর বাইরে) — storey height থেকে slenderness
 *     বিবেচনায় একটা conservative minimum size (300×300) থেকে শুরু
 *     করে, height বাড়লে ধাপে ধাপে বড় preset এ যায়। এটা নিছক একটা
 *     starting point — চূড়ান্ত column size ভবিষ্যতে Design Engine
 *     (load-based capacity check) থেকে iterate হওয়া উচিত, এই ফাংশন
 *     সেই iterate-loop প্রতিস্থাপন করে না, শুধু প্রথম non-empty মডেল
 *     তৈরির জন্য একটা reasonable default দেয়।
 *   - Brace/Pile এর জন্য কোনো rule নেই (ইচ্ছাকৃতভাবে) — bracing
 *     configuration ও pile capacity BNBC-তে বহুবিধ factor (soil
 *     capacity, axial force path) নির্ভর করে যা এই সরল rule দিয়ে
 *     honest ভাবে অনুমান করা যায় না। সেগুলোর জন্য এখনো ম্যানুয়াল
 *     section নির্বাচন লাগবে (ElementPanel এ শুধু Beam/Column
 *     auto-assign হয়, Brace/Pile এ dropdown থেকেই যায়)।
 *   - এই preliminary size পরবর্তীতে Design Engine (Phase 6, RC/Steel
 *     capacity check) থেকে অপর্যাপ্ত প্রমাণিত হলে ইঞ্জিনিয়ার
 *     SectionPanel দিয়ে ম্যানুয়ালি বড় preset এ পরিবর্তন করতে পারবেন —
 *     এই ফাংশন শুধু initial auto-fill, চূড়ান্ত sizing না।
 */

import type { Point3D } from "@/lib/types/element";
import { distanceBetweenPoints } from "@/lib/types/element";
import type { RectangularSection, StructuralSection } from "@/lib/types/section";
import {
  STANDARD_BEAM_PRESETS,
  STANDARD_COLUMN_PRESETS,
  type StandardSizePreset,
} from "@/lib/library/standardSectionPresets";

export interface AutoAssignSectionResult {
  /** Library তে আগে থেকেই এই dimension এর section থাকলে সেটার sectionId — caller সরাসরি এটা reuse করবে, নতুন কিছু তৈরি করবে না। */
  matchedExistingSectionId: string | null;
  /**
   * Library তে মিল না পেলে caller কে যা তৈরি করে save করতে হবে
   * (sectionId/createdAt/updatedAt বাদে — caller এইগুলো generate করবে,
   * ঠিক SectionPanel.tsx এর handleSubmit যেভাবে করে সেভাবেই)।
   */
  newSectionToCreate: Omit<RectangularSection, "sectionId" | "createdAt" | "updatedAt"> | null;
  /** যে preset rule থেকে এই সাইজ এসেছে — UI তে "auto-selected: span/12 rule" জাতীয় tooltip দেখানোর জন্য। */
  ruleApplied: string;
  warnings: string[];
}

/** span (মিটার) থেকে beam-এর target width/depth (mm) — h ≈ span/12, b ≈ h/2। */
function targetBeamDimensions(spanM: number): { targetWidth: number; targetDepth: number } {
  const targetDepthRaw = (spanM * 1000) / 12;
  const targetDepth = Math.max(300, targetDepthRaw);
  const targetWidth = Math.max(200, targetDepth / 2);
  return { targetWidth, targetDepth };
}

/**
 * Column-এর target size — storey height (মিটার) থেকে ধাপে ধাপে
 * (conservative, load calculation ছাড়া)। height যত বেশি, slenderness
 * সমস্যা এড়াতে তত বড় preset।
 */
function targetColumnDimensions(storyHeightM: number | null): { targetWidth: number; targetDepth: number } {
  const h = storyHeightM ?? 3.0; // storyHeight অজানা হলে সাধারণ 3m floor-to-floor ধরা হলো
  if (h <= 3.2) return { targetWidth: 300, targetDepth: 300 };
  if (h <= 3.8) return { targetWidth: 350, targetDepth: 350 };
  if (h <= 4.5) return { targetWidth: 400, targetDepth: 400 };
  return { targetWidth: 450, targetDepth: 450 };
}

/** নির্দিষ্ট target (width, depth) এর কাছাকাছি preset তালিকা থেকে নিকটতম বৈধ (>= target) preset খুঁজে বের করে — একেবারে ছোট সাইজ বেছে under-design এড়ানোর জন্য, তাই strictly-smaller preset বাদ দেওয়া হয় যদি বড় কোনো preset পাওয়া যায়। */
function findNearestPreset(
  presets: StandardSizePreset[],
  targetWidth: number,
  targetDepth: number
): StandardSizePreset {
  // প্রথমে সেই preset গুলো খুঁজি যারা target এর চেয়ে ছোট না (safe দিকে)
  const atLeastAsBig = presets.filter((p) => p.width >= targetWidth && p.depth >= targetDepth);
  const pool = atLeastAsBig.length > 0 ? atLeastAsBig : presets;

  let best = pool[0];
  let bestDist = Infinity;
  for (const p of pool) {
    const dist = (p.width - targetWidth) ** 2 + (p.depth - targetDepth) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

/** Library-তে ইতিমধ্যে এই exact (rectangular, width, depth) section আছে কিনা খোঁজে। */
function findMatchingLibrarySection(
  sections: StructuralSection[],
  width: number,
  depth: number
): StructuralSection | undefined {
  return sections.find(
    (s) => s.shape === "rectangular" && s.width === width && s.depth === depth
  );
}

/**
 * Beam-এর জন্য auto section — start/end point থেকে span বের করে,
 * span/12 rule দিয়ে target dimension, তারপর STANDARD_BEAM_PRESETS
 * থেকে নিকটতম preset।
 */
export function autoAssignBeamSection(
  startPoint: Point3D,
  endPoint: Point3D,
  existingSections: StructuralSection[]
): AutoAssignSectionResult {
  const warnings: string[] = [];
  const spanM = distanceBetweenPoints(startPoint, endPoint);

  if (spanM <= 0) {
    warnings.push("Beam span শূন্য বা অবৈধ — ডিফল্ট 250×450 preset ব্যবহার করা হলো।");
  }

  const { targetWidth, targetDepth } = targetBeamDimensions(spanM > 0 ? spanM : 5);
  const preset = findNearestPreset(STANDARD_BEAM_PRESETS, targetWidth, targetDepth);

  const existing = findMatchingLibrarySection(existingSections, preset.width, preset.depth);
  if (existing) {
    return {
      matchedExistingSectionId: existing.sectionId,
      newSectionToCreate: null,
      ruleApplied: `Beam auto: span ${spanM.toFixed(2)}m → h≈span/12 → ${preset.label}`,
      warnings,
    };
  }

  return {
    matchedExistingSectionId: null,
    newSectionToCreate: {
      name: preset.label,
      shape: "rectangular",
      source: "standard-database",
      width: preset.width,
      depth: preset.depth,
    },
    ruleApplied: `Beam auto: span ${spanM.toFixed(2)}m → h≈span/12 → ${preset.label}`,
    warnings,
  };
}

/**
 * Column-এর জন্য auto section — start/end point থেকে storey height
 * (vertical distance) বের করে, ধাপে ধাপে target dimension, তারপর
 * STANDARD_COLUMN_PRESETS থেকে নিকটতম (square-preferred) preset।
 *
 * সততার সাথে সীমাবদ্ধতা: এখানে কোনো axial load/tributary area
 * calculation নেই — শুধু height-based conservative starting point।
 * চূড়ান্ত sizing এর জন্য load-based capacity check লাগবে (future
 * Design Engine phase)।
 */
export function autoAssignColumnSection(
  startPoint: Point3D,
  endPoint: Point3D,
  existingSections: StructuralSection[]
): AutoAssignSectionResult {
  const warnings: string[] = [];
  const heightM = distanceBetweenPoints(startPoint, endPoint);

  if (heightM <= 0) {
    warnings.push("Column height শূন্য বা অবৈধ — ডিফল্ট 300×300 preset ব্যবহার করা হলো।");
  }

  const { targetWidth, targetDepth } = targetColumnDimensions(heightM > 0 ? heightM : null);
  // Column এ square preset প্রাধান্য দেওয়া হয় (সবচেয়ে প্রচলিত প্র্যাকটিস)
  const squarePresets = STANDARD_COLUMN_PRESETS.filter((p) => p.width === p.depth);
  const preset = findNearestPreset(squarePresets, targetWidth, targetDepth);

  const existing = findMatchingLibrarySection(existingSections, preset.width, preset.depth);
  if (existing) {
    return {
      matchedExistingSectionId: existing.sectionId,
      newSectionToCreate: null,
      ruleApplied: `Column auto: height ${heightM.toFixed(2)}m → ${preset.label} (preliminary, load check ছাড়া)`,
      warnings,
    };
  }

  return {
    matchedExistingSectionId: null,
    newSectionToCreate: {
      name: preset.label,
      shape: "rectangular",
      source: "standard-database",
      width: preset.width,
      depth: preset.depth,
    },
    ruleApplied: `Column auto: height ${heightM.toFixed(2)}m → ${preset.label} (preliminary, load check ছাড়া)`,
    warnings,
  };
}
