import type { SidebarTab } from "@/lib/workflow/stageTabs";

/**
 * Workflow Layer — Master Plan এর "৯-Stage Wizard" সেকশন।
 *
 * এটা কোনো নতুন Phase না, এবং কোনো নতুন ডেটা তৈরি করে না — এটা একটা
 * UI orchestration layer যা Phase 1-10 এ যা ইতিমধ্যে বসানো আছে
 * (geometry/library/elements/loads/analysis/validation/design/
 * detailing tab) তাকেই একটা guided sequence এ সাজায়।
 *
 * Master Plan এর মূল ৯টা stage: Project → Preliminary → Model →
 * Loads → Analysis → Design → Optimization → Verification →
 * Documentation → Export — এখানে "Project" বাদ দেওয়া হয়েছে কারণ এই
 * App কখনো Project Create করে না (Hub থেকে projectId আসে, এটা
 * page.tsx এ আগে থেকেই handled), তাই wizard শুরু হয় Preliminary
 * (Materials/Sections library) দিয়ে। মোট ৯টা stage রাখা হয়েছে
 * Documentation ও Export কে আলাদা রেখে (যদিও দুটোই এখনো "coming
 * soon" — Phase 11+ scope, DrawingSyncPanel/BarBendingSchedule
 * থাকলেও কোনো centralized report/export builder এখনো নেই)।
 */
export type StageId =
  | "preliminary"
  | "model"
  | "loads"
  | "analysis"
  | "design"
  | "optimization"
  | "verification"
  | "detailing"
  | "documentation"
  | "export";

export type StageStatus = "locked" | "available" | "in-progress" | "complete";

export interface StageDef {
  id: StageId;
  order: number;
  label: string;
  labelBn: string;
  description: string;
  /** এই stage ক্লিক করলে কোন existing sidebar tab-এ যাবে। */
  targetTab: SidebarTab;
  /** এখনো কোনো real feature নেই (Phase 11+), শুধু placeholder দেখাবে। */
  isPlaceholder?: boolean;
}

export interface StageProgress {
  status: StageStatus;
  /** 0-100, completion সংক্রান্ত ছোট summary (যেমন "৪টা material, ১২টা element")। */
  detail: string;
  percent: number;
}
