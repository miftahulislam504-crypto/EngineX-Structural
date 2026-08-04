/**
 * SidebarTab / LoadSubTab / DesignSubTab টাইপগুলো আগে শুধু page.tsx এর
 * ভেতরে ছিল। Workflow Layer কে stage → tab mapping করতে হলে এই
 * টাইপগুলো দরকার, তাই এখানে বের করে আনা হয়েছে এবং page.tsx থেকে
 * re-export করা হচ্ছে (কোনো import path ভাঙেনি — page.tsx এ
 * `export type { SidebarTab, LoadSubTab, DesignSubTab }` থাকবে)।
 */
export type SidebarTab =
  | "geometry"
  | "library"
  | "elements"
  | "loads"
  | "analysis"
  | "validation"
  | "design"
  | "visualization"
  | "detailing";

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
  | "foundation-optimization"
  | "section-optimization"
  | "weight-optimization"
  | "cost-optimization"
  | "construction-ai-topology-optimization"
  | "base-isolation"
  | "collapse-prediction"
  | "rebar-layout"
  | "stirrup-tie-zones"
  | "development-length"
  | "bar-bending-schedule"
  | "section-detail"
  | "connection-detail"
  | "general-notes"
  | "drawing-sync";

/** Design sub-tab গুলোর মধ্যে কোনগুলো "Design" stage বনাম "Optimization" stage-এর অন্তর্গত (Master Plan Phase 6 বনাম Phase 9)। */
export const OPTIMIZATION_DESIGN_SUB_TABS: DesignSubTab[] = [
  "foundation-optimization",
  "section-optimization",
  "weight-optimization",
  "cost-optimization",
  "construction-ai-topology-optimization",
];

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
    targetTab: "design",
  },
  {
    id: "verification",
    order: 7,
    label: "Verification",
    labelBn: "যাচাই",
    description: "Model Health Score, Design Verification, ও Collapse Prediction দিয়ে চূড়ান্ত পরীক্ষা।",
    targetTab: "validation",
  },
  {
    id: "documentation",
    order: 8,
    label: "Documentation",
    labelBn: "ডকুমেন্টেশন",
    description: "রিপোর্ট ও ড্রয়িং জেনারেশন — শীঘ্রই আসছে (Phase 11+)।",
    targetTab: "detailing",
    isPlaceholder: true,
  },
  {
    id: "export",
    order: 9,
    label: "Export",
    labelBn: "এক্সপোর্ট",
    description: "Hub-এ ফলাফল পাঠানো ও ফাইল এক্সপোর্ট — শীঘ্রই আসছে (Phase 11+)।",
    targetTab: "detailing",
    isPlaceholder: true,
  },
];
