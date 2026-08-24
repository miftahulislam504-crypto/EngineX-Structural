import type {
  LoadSubTab,
  DesignSubTab,
  OptimizationSubTab,
  DocumentationSubTab,
} from "@/lib/workflow/stageTabs";
import type { SubTabGroup, SubTabItem } from "@/components/workflow/SubTabBar";
import type { HubGroup, HubItem } from "@/components/workflow/SubTabHub";
import {
  Square,
  Columns,
  Grid,
  Layout,
  GitBranch,
  Layers,
  Anchor,
  Circle,
  Zap,
  Shield,
  Triangle,
  AlertTriangle,
  Building,
  Ruler,
  DollarSign,
  Sparkles,
  Grid3x3,
  Hexagon,
  FileText,
  Target,
  Package,
  RefreshCw,
  Download,
} from "lucide-react";

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
      { id: "stair", label: "Stair" },
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
  { id: "reports-export", label: "Reports & Export" },
];

/**
 * Redesign (২০২৬-০৮) — Design/Optimization/Documentation এর দুই-ধাপ
 * নেভিগেশন hub-এর জন্য icon+description সহ ডেটা (SubTabHub কম্পোনেন্ট
 * ব্যবহার করে)। উপরের SubTabItem/SubTabGroup লিস্টগুলো (SubTabBar এর
 * জন্য) থেকে ইচ্ছাকৃতভাবে আলাদা এক্সপোর্ট — pill-bar আর card-hub দুই
 * ভিন্ন UI, কিন্তু একই sub-tab id/label ডেটার উপর ভিত্তি করে, তাই
 * ডুপ্লিকেট না করে একই id সেট পুনর্ব্যবহার করা হলো, শুধু presentation
 * layer আলাদা (icon/description hub-এর জন্যই লাগে, pill bar এ না)।
 */
export const DESIGN_HUB_GROUPS: HubGroup<DesignSubTab>[] = [
  {
    groupLabel: "RC Design",
    items: [
      { id: "beam", label: "RC Beam", description: "ফ্লেক্সার, শিয়ার, রিবার ডিজাইন", icon: Square },
      { id: "column", label: "RC Column", description: "P-M ইন্টারঅ্যাকশন, টাই স্পেসিং", icon: Columns },
      { id: "slab", label: "RC Slab", description: "ওয়ান-ওয়ে/টু-ওয়ে স্ল্যাব ডিজাইন", icon: Grid },
      { id: "wall", label: "RC Wall", description: "শিয়ার ওয়াল ডিজাইন", icon: Layout },
      { id: "stair", label: "Stair", description: "ওয়েস্ট-স্ল্যাব সিঁড়ি ডিজাইন", icon: Layers },
    ],
  },
  {
    groupLabel: "Steel Design",
    items: [
      { id: "steel-beam", label: "Steel Beam", description: "সেকশন ক্যাপাসিটি চেক", icon: Square },
      { id: "steel-column", label: "Steel Column", description: "বাকলিং, কম্প্রেশন ডিজাইন", icon: GitBranch },
      { id: "connection", label: "Connection", description: "স্টিল কানেকশন ডিজাইন", icon: Layers },
    ],
  },
  {
    groupLabel: "Foundation",
    items: [
      { id: "footing", label: "Footing", description: "আইসোলেটেড ফুটিং", icon: Anchor },
      { id: "combined-footing", label: "Combined Footing", description: "কম্বাইন্ড ফুটিং ডিজাইন", icon: Grid3x3 },
      { id: "strip-footing", label: "Strip Footing", description: "স্ট্রিপ ফুটিং ডিজাইন", icon: Ruler },
      { id: "mat-foundation", label: "Mat Foundation", description: "ম্যাট ফাউন্ডেশন ডিজাইন", icon: Hexagon },
      { id: "pile", label: "Pile", description: "পাইল ক্যাপাসিটি ডিজাইন", icon: Circle },
      { id: "pile-cap", label: "Pile Cap", description: "পাইল ক্যাপ ডিজাইন", icon: Package },
      { id: "retaining-wall", label: "Retaining Wall", description: "রিটেইনিং ওয়াল ডিজাইন", icon: Shield },
      { id: "geotechnical", label: "Geotechnical", description: "জিওটেকনিক্যাল টুলস", icon: Triangle },
    ],
  },
  {
    groupLabel: "Advanced",
    items: [
      { id: "base-isolation", label: "Base Isolation", description: "বেস আইসোলেশন ও এনার্জি ডিসিপেশন", icon: Zap },
      { id: "collapse-prediction", label: "Collapse Prediction", description: "কোলাপ্স প্রেডিকশন যাচাই", icon: AlertTriangle },
    ],
  },
];

export const OPTIMIZATION_HUB_ITEMS: HubItem<OptimizationSubTab>[] = [
  { id: "foundation-optimization", label: "Foundation", description: "ফাউন্ডেশন অপ্টিমাইজেশন", icon: Building },
  { id: "section-optimization", label: "Section", description: "সেকশন সাইজ অপ্টিমাইজেশন", icon: Ruler },
  { id: "weight-optimization", label: "Weight", description: "স্ট্রাকচার ওজন কমানো", icon: Shield },
  { id: "cost-optimization", label: "Cost", description: "কস্ট অপ্টিমাইজেশন", icon: DollarSign },
  {
    id: "construction-ai-topology-optimization",
    label: "Construction / AI / Topology",
    description: "কনস্ট্রাকশন-অ্যাওয়্যার AI টপোলজি অপ্টিমাইজেশন",
    icon: Sparkles,
  },
];

/**
 * Redesign (২০২৬-০৮) — label lookup হেল্পার, detail পেজের breadcrumb/
 * header এ (design/[subtab]/page.tsx ইত্যাদি) sub-tab id থেকে
 * মানুষের-পড়ার-উপযোগী label বের করতে। HUB আইটেম লিস্টগুলোই একমাত্র
 * জায়গা যেখানে id→label ম্যাপিং ইতিমধ্যে আছে, তাই নতুন করে আলাদা
 * ম্যাপ না বানিয়ে সেখান থেকেই flatten করে বের করা।
 */
function buildLabelMap<T extends string>(
  groups: HubGroup<T>[] | undefined,
  items: HubItem<T>[] | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  groups?.forEach((g) => g.items.forEach((i) => (map[i.id] = i.label)));
  items?.forEach((i) => (map[i.id] = i.label));
  return map;
}

export const DESIGN_SUB_TAB_LABELS: Record<DesignSubTab, string> = buildLabelMap(
  DESIGN_HUB_GROUPS,
  undefined,
) as Record<DesignSubTab, string>;

export const DOCUMENTATION_HUB_ITEMS: HubItem<DocumentationSubTab>[] = [
  { id: "rebar-layout", label: "Rebar Layout", description: "রিবার লেআউট ডকুমেন্টেশন", icon: Grid3x3 },
  { id: "stirrup-tie-zones", label: "Stirrup/Tie Zones", description: "স্টিরাপ/টাই জোন ডকুমেন্টেশন", icon: Hexagon },
  {
    id: "development-length",
    label: "Development/Lap Length",
    description: "ডেভেলপমেন্ট ও ল্যাপ লেংথ ক্যালকুলেশন",
    icon: Ruler,
  },
  {
    id: "bar-bending-schedule",
    label: "Bar Bending Schedule",
    description: "BBS জেনারেট ও এক্সপোর্ট",
    icon: FileText,
  },
  { id: "section-detail", label: "Section Detail", description: "সেকশন ডিটেইল ড্রয়িং", icon: Target },
  { id: "connection-detail", label: "Connection Detail", description: "কানেকশন ডিটেইল ড্রয়িং", icon: Package },
  { id: "general-notes", label: "General Notes", description: "জেনারেল নোটস সম্পাদনা", icon: FileText },
  { id: "drawing-sync", label: "Drawing Sync", description: "EngineXDraw এর সাথে সিঙ্ক", icon: RefreshCw },
  { id: "reports-export", label: "Reports & Export", description: "রিপোর্ট ও ডকুমেন্ট এক্সপোর্ট", icon: Download },
];

export const OPTIMIZATION_SUB_TAB_LABELS: Record<OptimizationSubTab, string> = buildLabelMap(
  undefined,
  OPTIMIZATION_HUB_ITEMS,
) as Record<OptimizationSubTab, string>;

export const DOCUMENTATION_SUB_TAB_LABELS: Record<DocumentationSubTab, string> = buildLabelMap(
  undefined,
  DOCUMENTATION_HUB_ITEMS,
) as Record<DocumentationSubTab, string>;
