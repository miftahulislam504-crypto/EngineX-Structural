/**
 * Design Verification
 * Phase 5 — Master Plan: "Design Verification"
 *
 * Design Engine (Phase 6, rebar/capacity design) এখনো নেই, তাই এই
 * ধাপে "design verification" মানে rebar/safety-ratio check না —
 * বরং element-level ডেটা ইন্টিগ্রিটি যা একটা ভবিষ্যৎ design check
 * এর পূর্বশর্ত: material/section reference বৈধ কিনা, এবং কিছু
 * known solver limitation (Footing skip, single-end pin না থাকা)
 * যা ইঞ্জিনিয়ারের আগে থেকেই জানা দরকার যাতে ফলাফল ভুল ব্যাখ্যা না
 * করেন।
 */

import type { StructuralElement } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import type { StructuralSection } from "@/lib/types/section";
import type { ValidationIssue } from "@/lib/validation/types";

const SECTIONED_LINE_CATEGORIES = new Set(["beam", "column", "brace", "pile"]);

/**
 * Material/Section reference integrity — element এর materialId/
 * sectionId যদি library তে না থাকে (ডিলিট হয়ে গেছে কিন্তু element
 * থেকে গেছে), সেই element কার্যত অসম্পূর্ণ — analysis এ ভুল/অনুপস্থিত
 * property ব্যবহৃত হবে বা backend request ব্যর্থ হবে।
 */
export function checkMaterialSectionReferences(
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const materialIds = new Set(materials.map((m) => m.materialId));
  const sectionIds = new Set(sections.map((s) => s.sectionId));

  for (const e of elements) {
    if (!materialIds.has(e.materialId)) {
      issues.push({
        id: `reference-integrity:${e.elementId}:material`,
        severity: "error",
        category: "reference-integrity",
        message: `${e.category} "${e.label}" references material "${e.materialId}", which no longer exists in the Material Library.`,
        elementIds: [e.elementId],
      });
    }

    if (SECTIONED_LINE_CATEGORIES.has(e.category) && "sectionId" in e) {
      if (!sectionIds.has(e.sectionId)) {
        issues.push({
          id: `reference-integrity:${e.elementId}:section`,
          severity: "error",
          category: "reference-integrity",
          message: `${e.category} "${e.label}" references section "${e.sectionId}", which no longer exists in the Section Library.`,
          elementIds: [e.elementId],
        });
      }
    }
  }

  return issues;
}

/**
 * Foundation solver-limitation surfacing — backend এখনো Footing এবং
 * Phase 7-এর বাকি foundation category গুলো (Combined/Strip/Mat) solve
 * করে না (analysis_orchestration.py এর UNSUPPORTED_ELEMENT_CATEGORIES
 * দেখুন — সবগুলোই foundation-soil interaction element, যা এখনো
 * implement করা হয়নি)। এই চেক সেই একই সীমাবদ্ধতা model-validation
 * ধাপেই আগেভাগে জানায়, যাতে ইঞ্জিনিয়ার analysis চালানোর পরে বিস্মিত
 * না হন কেন এই element গুলোর কোনো ফলাফল নেই।
 */
export function checkFootingSolverLimitation(elements: StructuralElement[]): ValidationIssue[] {
  const unsupportedFoundationCategories = new Set([
    "footing",
    "combined-footing",
    "strip-footing",
    "mat-foundation",
    "pile-cap",
    "pile-group",
  ]);
  const foundations = elements.filter((e) => unsupportedFoundationCategories.has(e.category));
  if (foundations.length === 0) return [];

  return [
    {
      id: "solver-limitation:footing",
      severity: "warning",
      category: "solver-limitation",
      message: `${foundations.length} foundation element(s) (Footing/Combined Footing/Strip Footing/Mat Foundation/Pile Cap/Pile Group) are present but not yet solved by the analysis engine (foundation-soil interaction is planned for a future phase) — their effect is not reflected in analysis results.`,
      elementIds: foundations.map((e) => e.elementId),
    },
  ];
}

/**
 * Single-end pin-release limitation surfacing — solver এর
 * connectionType বর্তমানে element-level single string (element.ts
 * দেখুন), তাই "pin" মানে উভয় প্রান্তই release হয় — এক প্রান্ত moment,
 * আরেক প্রান্ত pin এমন আংশিক release মডেল করা যায় না। এই সীমাবদ্ধতা
 * নিজে কোনো ভুল না (data model এ ইচ্ছাকৃত সিদ্ধান্ত), কিন্তু ইঞ্জিনিয়ার
 * যদি বাস্তবে single-end pin আশা করে থাকেন (যেমন একটা brace-এর একদিক
 * rigid, অন্যদিক pinned), সেটা এই মডেলে প্রকাশযোগ্য না — তাই info
 * হিসেবে জানানো, শুধু pin-connected element থাকলেই।
 */
export function checkPinConnectionLimitation(elements: StructuralElement[]): ValidationIssue[] {
  const pinElements = elements.filter(
    (e) => "connectionType" in e && e.connectionType === "pin"
  );
  if (pinElements.length === 0) return [];

  return [
    {
      id: "solver-limitation:pin-connection",
      severity: "info",
      category: "solver-limitation",
      message: `${pinElements.length} element(s) use pin connection — note that the solver releases both ends together (single-end-only pin release is not yet supported).`,
      elementIds: pinElements.map((e) => e.elementId),
    },
  ];
}

/** Design Verification এর সব সাব-চেক একসাথে চালায়। */
export function runDesignVerification(
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): ValidationIssue[] {
  return [
    ...checkMaterialSectionReferences(elements, materials, sections),
    ...checkFootingSolverLimitation(elements),
    ...checkPinConnectionLimitation(elements),
  ];
}
