/**
 * SidebarTab / LoadSubTab / DesignSubTab টাইপগুলো আগে শুধু page.tsx এর
 * ভেতরে ছিল, এখানে বের করে আনা হয়েছে যাতে একাধিক ফাইল (Sidebar,
 * layout.tsx, প্রতিটা route page) একই টাইপ শেয়ার করতে পারে।
 *
 * এই ফাইলে আগে ৯-Stage Workflow Wizard এর STAGES array/StageDef ও
 * ছিল (Sidebar-এর "Workflow" বাটনে ক্লিক করলে যে guided panel খুলত) —
 * ব্যবহারকারীর নির্দেশে সেই পুরো wizard ফিচার (WorkflowSidebar.tsx,
 * useWorkflowProgress.ts, useWorkflowUiStore.ts, workflow/types.ts)
 * মুছে ফেলা হয়েছে। মূল flat Sidebar (Sidebar.tsx) ও প্রতিটা tab-এর
 * নিজস্ব route/sub-tab navigation অপরিবর্তিত আছে — শুধু বিকল্প
 * guided-wizard overlay সরানো হয়েছে।
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
 *
 * ২০২৬-০৮: "stair" DesignSubTab-এ যোগ হলো (StairDesignPanel.tsx) —
 * আগে stair Draw থেকে import হতো কিন্তু কোনো design panel-ই ছিল না
 * (dead-load derivation, design panel, drawing sheet — তিনটাই gap
 * ছিল, একে একে ভরাট করা হচ্ছে; stairDesign.ts, stairGeometry.ts,
 * deriveStairSelfWeightLoads.ts দেখুন)।
 */
export type SidebarTab =
  | "geometry"
  | "library"
  | "import"
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
  | "stair"
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
  | "drawing-sync"
  | "reports-export";


