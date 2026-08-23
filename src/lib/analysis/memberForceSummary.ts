/**
 * Member Forces Summary (Report-Audit Phase A5) — Beam/Column/Wall/
 * Slab এর elementEndForces কে category অনুযায়ী আলাদা টেবিলে ভাগ করে,
 * প্রতি category-তে governing (max magnitude) axial/shear/moment
 * বের করে।
 *
 * elementEndForces এ elementId আছে কিন্তু category নেই — এই মডিউল
 * context.elements (StructuralElement[]) থেকে elementId→category
 * lookup বানিয়ে join করে। কোনো elementId elements[] এ না পাওয়া গেলে
 * (স্টেল ডেটা বা mismatch) সেই force entry silently বাদ যাবে না —
 * "unknown" category তে গণনা হবে, যাতে missing-mapping চোখে পড়ে।
 *
 * শুধু per-element PEAK (start/end এর মধ্যে যেটার magnitude বেশি)
 * দেখানো হয় — pull প্রতিটা sub-segment (subStartRatio/subEndRatio)
 * এর row আলাদা দেখালে টেবিল শত শত row হয়ে যেত এবং summary-র উদ্দেশ্য
 * (per-category governing force এক নজরে) নষ্ট হতো। প্রতিটা elementId
 * এর জন্য সব sub-segment এর মধ্যে সবচেয়ে বড় magnitude ধরা হয়।
 */

import type { ElementEndForce } from "@/lib/analysis/runAnalysis";
import type { StructuralElement, ElementCategory } from "@/lib/types/element";

export type MemberForceGroupCategory = "beam" | "column" | "wall" | "slab" | "other";

export interface MemberForceSummaryRow {
  elementId: string;
  /** ওই element-এর সব sub-segment এর মধ্যে সর্বোচ্চ |axial force|, kN। */
  peakAxial: number;
  /** সর্বোচ্চ resultant shear (shearY, shearZ এর মধ্যে যেটা বড়), kN। */
  peakShear: number;
  /** সর্বোচ্চ resultant moment (momentY, momentZ এর মধ্যে যেটা বড়), kN·m। */
  peakMoment: number;
}

export interface MemberForceGroup {
  category: MemberForceGroupCategory;
  rows: MemberForceSummaryRow[];
}

export interface MemberForceSummary {
  groups: MemberForceGroup[];
  warnings: string[];
}

function mapElementCategory(category: ElementCategory): MemberForceGroupCategory {
  switch (category) {
    case "beam":
      return "beam";
    case "column":
    case "brace":
    case "pile":
      return "column"; // brace/pile আচরণগতভাবে axial-dominant vertical/diagonal member, column table-এর সাথে group করা হলো
    case "wall":
    case "shear-wall":
    case "core-wall":
      return "wall";
    case "slab":
      return "slab";
    default:
      return "other"; // footing/mat-foundation/pile-cap ইত্যাদি — এদের ভিন্ন design track (Foundation), এই member-force summary তে "other" এ পড়বে যদি elementEndForces আসে
  }
}

export function computeMemberForceSummary(
  elementEndForces: ElementEndForce[] | undefined,
  elements: StructuralElement[]
): MemberForceSummary {
  const warnings: string[] = [];

  if (!elementEndForces || elementEndForces.length === 0) {
    return {
      groups: [],
      warnings: ["Member Forces — এই analysis run-এ elementEndForces ডেটা পাওয়া যায়নি।"],
    };
  }

  const categoryById = new Map<string, ElementCategory>();
  for (const el of elements) {
    categoryById.set(el.elementId, el.category);
  }

  // elementId → সব sub-segment এর মধ্যে peak magnitude row তে reduce করা
  const peakByElement = new Map<string, MemberForceSummaryRow>();
  let unknownCount = 0;

  for (const f of elementEndForces) {
    const axial = Math.max(Math.abs(f.startAxial), Math.abs(f.endAxial));
    const shear = Math.max(
      Math.sqrt(f.startShearY ** 2 + f.startShearZ ** 2),
      Math.sqrt(f.endShearY ** 2 + f.endShearZ ** 2)
    );
    const moment = Math.max(
      Math.sqrt(f.startMomentY ** 2 + f.startMomentZ ** 2),
      Math.sqrt(f.endMomentY ** 2 + f.endMomentZ ** 2)
    );

    const existing = peakByElement.get(f.elementId);
    if (!existing) {
      peakByElement.set(f.elementId, { elementId: f.elementId, peakAxial: axial, peakShear: shear, peakMoment: moment });
    } else {
      existing.peakAxial = Math.max(existing.peakAxial, axial);
      existing.peakShear = Math.max(existing.peakShear, shear);
      existing.peakMoment = Math.max(existing.peakMoment, moment);
    }

    if (!categoryById.has(f.elementId)) unknownCount++;
  }

  if (unknownCount > 0) {
    warnings.push(
      `⚠️ ${unknownCount}টা force entry-র elementId বর্তমান elements তালিকায় পাওয়া যায়নি — "Other" category-তে দেখানো হয়েছে।`
    );
  }

  const grouped = new Map<MemberForceGroupCategory, MemberForceSummaryRow[]>();
  for (const row of peakByElement.values()) {
    const category = categoryById.has(row.elementId)
      ? mapElementCategory(categoryById.get(row.elementId)!)
      : "other";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(row);
  }

  const order: MemberForceGroupCategory[] = ["beam", "column", "wall", "slab", "other"];
  const groups: MemberForceGroup[] = order
    .filter((c) => grouped.has(c))
    .map((c) => ({
      category: c,
      rows: grouped.get(c)!.sort((a, b) => b.peakMoment - a.peakMoment),
    }));

  return { groups, warnings };
}
