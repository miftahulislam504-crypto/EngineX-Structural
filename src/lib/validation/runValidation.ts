/**
 * Phase 5 — Model Validation & Quality Control, top-level orchestrator।
 *
 * Model Checker + Load Verification + Design Verification + Code
 * Compliance Checker — এই চারটা সাব-সিস্টেমের সব issue একসাথে জড়ো
 * করে একটা ValidationReport (Model Health Score সহ) বানায়। কোনো
 * network/Firestore কল নেই এখানে — শুধু ইতিমধ্যে-লোড-করা client-side
 * state (elements/materials/sections/loadCases/patterns) নিয়ে কাজ
 * করে, তাই এটা সিঙ্ক্রোনাস ও দ্রুত — analysis চালানোর আগে UI তে
 * তাৎক্ষণিক দেখানো যায়।
 */

import type { StructuralElement } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import type { StructuralSection } from "@/lib/types/section";
import type { LoadCase, LoadPattern } from "@/lib/types/load";
import { runModelChecks } from "@/lib/validation/modelChecker";
import { runLoadVerification } from "@/lib/validation/loadVerification";
import { runDesignVerification } from "@/lib/validation/designVerification";
import { runCodeComplianceChecks } from "@/lib/validation/codeCompliance";
import { buildValidationReport, type ValidationReport } from "@/lib/validation/types";

export interface RunValidationInput {
  elements: StructuralElement[];
  materials: StructuralMaterial[];
  sections: StructuralSection[];
  loadCases: LoadCase[];
  patterns: LoadPattern[];
}

export function runValidation(input: RunValidationInput): ValidationReport {
  const { elements, materials, sections, loadCases, patterns } = input;

  const issues = [
    ...runModelChecks(elements),
    ...runLoadVerification(loadCases, elements, patterns),
    ...runDesignVerification(elements, materials, sections),
    ...runCodeComplianceChecks(elements, sections),
  ];

  return buildValidationReport(issues);
}

export type { ValidationReport, ValidationIssue, ValidationSeverity, ValidationCategory } from "@/lib/validation/types";
