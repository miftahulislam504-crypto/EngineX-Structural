/**
 * SidebarTab / LoadSubTab / DesignSubTab টাইপগুলো আগে শুধু page.tsx এর
 * ভেতরে ছিল। Workflow Layer কে stage → tab mapping করতে হলে এই
 * টাইপগুলো দরকার, তাই এখানে বের করে আনা হয়েছে এবং page.tsx থেকে
 * re-export করা হচ্ছে (কোনো import path ভাঙেনি — page.tsx এ
 * `export type { SidebarTab, LoadSubTab, DesignSubTab }` থাকবে)।
 *
 * Phase 0.5 (Sidebar পুনর্গঠন) এ যা বদলেছে:
 *   - "optimization" এবং "documentation" আগে "design" tab এর sub-tab
 *     ছিল (OPTIMIZATION_DESIGN_SUB_TABS দিয়ে চিহ্নিত অংশ, আর
 *     detailing/documentation গ্রুপের ৮টা sub-tab) — এখন দুটোই
 *     independent top-level SidebarTab, কারণ নতুন vertical Sidebar এ
 *     সব main section একই level এ ফ্ল্যাট থাকে (কোনো nested dropdown
 *     না, শুধু Design tab এর নিজের ভেতরে RC/Steel/Foundation/Advanced
 *     sub-tab bar থাকে, canvas এর উপরে)।
 *   - DesignSubTab থেকে সরিয়ে আনা মান দুই ভাগে গেছে:
 *     OptimizationSubTab (৫টা) এবং DocumentationSubTab (৮টা,
 *     rebar-layout থেকে drawing-sync পর্যন্ত — ব্যবহারকারীর নির্দেশ
 *     অনুযায়ী এইগুলো Documentation এ যাবে, Detailing এ না; Detailing
 *     tab শুধু rebar viewport canvas, কোনো sub-tab নেই)।
 */
export type SidebarTab =
  | "geometry"
  | "library"
  | "elements"
  | "loads"
  | "analysis"
  | "validation"
  | "design"
  | "optimization"
  | "visualization"
  | "detailing"
  | "documentation";

export type LoadSubTab = "patterns" | "wind" | "seismic" | "apply" | "combinations";

export type DesignSubTab =
  | "beam"
  | "column"
  | "steel-beam"
  | "steel-column"
  | "slab"
  | "wall"
  | "footing"
  | "combined-footing"
  | "strip-footing"
  | "mat-foundation"
  | "pile"
  | "pile-cap"
  | "connection"
  | "retaining-wall"
  | "geotechnical"
  | "base-isolation"
  | "collapse-prediction";

export type OptimizationSubTab =
  | "foundation-optimization"
  | "section-optimization"
  | "weight-optimization"
  | "cost-optimization"
  | "construction-ai-topology-optimization";

export type DocumentationSubTab =
  | "rebar-layout"
  | "stirrup-tie-zones"
  | "development-length"
  | "bar-bending-schedule"
  | "section-detail"
  | "connection-detail"
  | "general-notes"
  | "drawing-sync";

/** Verification stage-এ যাওয়ার সময় Design ট্যাবের কোন sub-tab-এ নামানো ভালো (Collapse Prediction, Phase 8/9 এর ভেরিফিকেশন-ঘেঁষা চেক)। */
export const VERIFICATION_DESIGN_SUB_TAB: DesignSubTab = "collapse-prediction";

import type { StageDef } from "@/lib/workflow/types";

export const STAGES: StageDef[] = [
  {
    id: "preliminary",
    order: 1,
    label: "Preliminary",
    labelBn: "প্রাথমিক সেটআপ",
    description: "Material ও Section library সেটআপ করুন — ডিজাইনের ভিত্তি।",
    targetTab: "library",
  },
  {
    id: "model",
    order: 2,
    label: "Model",
    labelBn: "মডেল",
    description: "Grid/Story জ্যামিতি বসান, তারপর Beam/Column/Slab/Wall/Footing এলিমেন্ট যোগ করুন।",
    targetTab: "geometry",
  },
  {
    id: "loads",
    order: 3,
    label: "Loads",
    labelBn: "লোড",
    description: "Load pattern, Wind/Seismic ক্যালকুলেটর, element-এ লোড প্রয়োগ, ও Load Combination।",
    targetTab: "loads",
  },
  {
    id: "analysis",
    order: 4,
    label: "Analysis",
    labelBn: "বিশ্লেষণ",
    description: "FE Solver চালান — element forces, reactions, displacement বের করুন।",
    targetTab: "analysis",
  },
  {
    id: "design",
    order: 5,
    label: "Design",
    labelBn: "ডিজাইন",
    description: "RC/Steel member design — flexure, shear, P-M interaction, foundation sizing।",
    targetTab: "design",
  },
  {
    id: "optimization",
    order: 6,
    label: "Optimization",
    labelBn: "অপ্টিমাইজেশন",
    description: "Section/Weight/Cost অপ্টিমাইজেশন — ঐচ্ছিক ধাপ, ডিজাইন ফাইনাল করার আগে রিফাইন করতে।",
    targetTab: "optimization",
  },
  {
    id: "verification",
    order: 7,
    label: "Validation",
    labelBn: "যাচাই",
    description: "Model Health Score, Design Verification, ও Collapse Prediction দিয়ে চূড়ান্ত পরীক্ষা।",
    targetTab: "validation",
  },
  {
    id: "detailing",
    order: 8,
    label: "Detailing",
    labelBn: "ডিটেইলিং",
    description: "Rebar geometry viewport — element-ভিত্তিক reinforcement দেখুন।",
    targetTab: "detailing",
  },
  {
    id: "documentation",
    order: 9,
    label: "Documentation",
    labelBn: "ডকুমেন্টেশন",
    description: "Bar Bending Schedule, Rebar/Stirrup Layout, Development Length, রিপোর্ট ও ড্রয়িং।",
    targetTab: "documentation",
  },
  {
    id: "export",
    order: 10,
    label: "Export",
    labelBn: "এক্সপোর্ট",
    description: "Hub-এ ফলাফল পাঠানো ও ফাইল এক্সপোর্ট — শীঘ্রই আসছে (Phase 11+)।",
    targetTab: "documentation",
    isPlaceholder: true,
  },
];
