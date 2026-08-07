import type {
  LoadSubTab,
  DesignSubTab,
  OptimizationSubTab,
  DocumentationSubTab,
} from "@/lib/workflow/stageTabs";
import type { SubTabGroup, SubTabItem } from "@/components/workflow/SubTabBar";

/**
 * Sub-tab লেবেল ডেটা (Phase 0.5)।
 *
 * আগে এই লিস্টগুলো components/workflow/TabNavBar.tsx এর ভেতরেই ছিল
 * (MAIN_TABS/LOAD_SUB_TABS/DESIGN_SUB_TAB_GROUPS)। TabNavBar এখন
 * Sidebar.tsx + SubTabBar.tsx দিয়ে প্রতিস্থাপিত, তাই এই ডেটা এখানে
 * সরিয়ে আনা হলো (ডেটা আর UI component আলাদা রাখা ভালো অভ্যাস, আর
 * page.tsx থেকেও import করা সহজ হয়)।
 *
 * Optimization এর ৫টা এবং Documentation এর ৮টা sub-tab আগে
 * DESIGN_SUB_TAB_GROUPS এর অংশ ছিল ("Optimization" ও "Detailing &
 * Documentation" গ্রুপ হিসেবে) — এখন independent tab হওয়ায় নিজস্ব
 * তালিকায় সরানো হয়েছে।
 */

export const LOAD_SUB_TABS: SubTabItem<LoadSubTab>[] = [
  { id: "patterns", label: "Patterns" },
  { id: "wind", label: "Wind" },
  { id: "seismic", label: "Seismic (EQ)" },
  { id: "apply", label: "Apply to Elements" },
  { id: "combinations", label: "Combinations" },
];

export const DESIGN_SUB_TAB_GROUPS: SubTabGroup<DesignSubTab>[] = [
  {
    groupLabel: "RC Design",
    tabs: [
      { id: "beam", label: "RC Beam" },
      { id: "column", label: "RC Column" },
      { id: "slab", label: "RC Slab" },
      { id: "wall", label: "RC Wall" },
    ],
  },
  {
    groupLabel: "Steel Design",
    tabs: [
      { id: "steel-beam", label: "Steel Beam" },
      { id: "steel-column", label: "Steel Column" },
      { id: "connection", label: "Connection" },
    ],
  },
  {
    groupLabel: "Foundation",
    tabs: [
      { id: "footing", label: "Footing" },
      { id: "combined-footing", label: "Combined Footing" },
      { id: "strip-footing", label: "Strip Footing" },
      { id: "mat-foundation", label: "Mat Foundation" },
      { id: "pile", label: "Pile" },
      { id: "pile-cap", label: "Pile Cap" },
      { id: "retaining-wall", label: "Retaining Wall" },
      { id: "geotechnical", label: "Geotechnical" },
    ],
  },
  {
    groupLabel: "Advanced",
    tabs: [
      { id: "base-isolation", label: "Base Isolation" },
      { id: "collapse-prediction", label: "Collapse Prediction" },
    ],
  },
];

export const OPTIMIZATION_SUB_TABS: SubTabItem<OptimizationSubTab>[] = [
  { id: "foundation-optimization", label: "Foundation" },
  { id: "section-optimization", label: "Section" },
  { id: "weight-optimization", label: "Weight" },
  { id: "cost-optimization", label: "Cost" },
  { id: "construction-ai-topology-optimization", label: "Construction/AI/Topology" },
];

export const DOCUMENTATION_SUB_TABS: SubTabItem<DocumentationSubTab>[] = [
  { id: "rebar-layout", label: "Rebar Layout" },
  { id: "stirrup-tie-zones", label: "Stirrup/Tie Zones" },
  { id: "development-length", label: "Development/Lap Length" },
  { id: "bar-bending-schedule", label: "Bar Bending Schedule" },
  { id: "section-detail", label: "Section Detail" },
  { id: "connection-detail", label: "Connection Detail" },
  { id: "general-notes", label: "General Notes" },
  { id: "drawing-sync", label: "Drawing Sync" },
];
