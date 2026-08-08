/**
 * Document Registry — route.tsx (server, next/server import করে) এবং
 * DocumentationPanel.tsx (client component) উভয়েরই DOCUMENT_KEYS/
 * DOCUMENT_REGISTRY/DocumentKey দরকার। মূল Phase 11i প্যাকেজে এগুলো
 * route.tsx এর ভেতরেই define করা ছিল — কিন্তু DocumentationPanel.tsx
 * (client) থেকে সরাসরি route.tsx import করলে next/server ক্লায়েন্ট
 * bundle এ leak করে, Next.js build ভেঙে যায় ("You're importing a
 * component that needs next/server...")। তাই এই const/type গুলো এই
 * আলাদা, সম্পূর্ণ server-import-মুক্ত ফাইলে সরানো হলো (Phase 11 merge
 * fix) — route.tsx ও DocumentationPanel.tsx দুটোই এখন এখান থেকে
 * import করে, ডেটা duplicate হয় না।
 */

export const DOCUMENT_KEYS = [
  "design-report",
  "bbs",
  "calc-sheets",
  "qc-report",
  "general-notes",
  "drawing-sheets",
] as const;

export type DocumentKey = (typeof DOCUMENT_KEYS)[number];

/** panel UI (DocumentationPanel.tsx) এই তালিকা থেকেই বাটন বানায় — label/description এখানে একবার, দুই জায়গায় ডুপ্লিকেট না করে। */
export const DOCUMENT_REGISTRY: Record<
  DocumentKey,
  { label: string; description: string; filename: (projectName: string) => string }
> = {
  "design-report": {
    label: "Design Report",
    description:
      "Sections A-J — cover, design criteria, material properties, loads, analysis, design summary, validation, quantity summary, appendix.",
    filename: (p) => `${p} - Design Report.pdf`,
  },
  bbs: {
    label: "Bar Bending Schedule",
    description:
      "Project-wide rebar schedule (S-10 equivalent) — every element's bar marks, shapes, cut lengths, and total weight.",
    filename: (p) => `${p} - Bar Bending Schedule.pdf`,
  },
  "calc-sheets": {
    label: "Calculation Sheets",
    description:
      "Per-member design calculation sheets (beam/column/slab/footing) — optionally filtered by element category (?categories=beam,column).",
    filename: (p) => `${p} - Calculation Sheets.pdf`,
  },
  "qc-report": {
    label: "Model Validation / QC Report",
    description:
      "Model health score, issue counts, and full issue-by-issue breakdown (connectivity/geometry, load verification, code compliance).",
    filename: (p) => `${p} - QC Report.pdf`,
  },
  "general-notes": {
    label: "General Notes (S-01)",
    description:
      "Design criteria, material spec, cover requirements, concrete requirement, and development/lap/hook length table.",
    filename: (p) => `${p} - General Notes.pdf`,
  },
  "drawing-sheets": {
    label: "Drawing Sheets (S-00 to S-19)",
    description:
      "Structural working drawings — content sheet, column/footing/beam layout+schedule+details, slab layout. Note: does not yet include S-01 General Notes (download separately) — see Phase 11h known gap.",
    filename: (p) => `${p} - Drawing Sheets.pdf`,
  },
};

export function isDocumentKey(value: string): value is DocumentKey {
  return (DOCUMENT_KEYS as readonly string[]).includes(value);
}
