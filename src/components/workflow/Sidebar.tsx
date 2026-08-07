"use client";

import {
  Grid3x3,
  Layers,
  Boxes,
  ArrowDownToLine,
  Sigma,
  CheckCircle2,
  PenTool,
  TrendingUp,
  Eye,
  Ruler,
  FileText,
  ListTree,
} from "lucide-react";
import type { SidebarTab } from "@/lib/workflow/stageTabs";

/**
 * Main Navigation Sidebar (Phase 0.5)।
 *
 * EngineXDraw এর components/Sidebar.tsx এর visual pattern অনুসরণ করা
 * হয়েছে (বাম পাশে fixed-width vertical column, header/nav/footer তিন
 * অংশ) — কিন্তু সেটা route-navigation (Link/usePathname) করত, এটা করে
 * না। এখানে ১০টা main tab + Workflow item সবই একই App-এর ভেতরে
 * activeTab state পরিবর্তন করে (কোনো URL বদলায় না), তাই plain button
 * + onSelectTab callback দিয়ে বানানো হয়েছে।
 *
 * সব tab একই level এ ফ্ল্যাট (কোনো group/nest/dropdown নেই) —
 * ব্যবহারকারীর স্পষ্ট নির্দেশ অনুযায়ী। Design/Loads/Optimization/
 * Documentation এর নিজস্ব sub-tab আছে, কিন্তু সেটা এই sidebar-এ না
 * — content area এর উপরে আলাদা horizontal SubTabBar এ (দেখুন
 * components/workflow/SubTabBar.tsx)।
 */

interface SidebarItem {
  id: SidebarTab;
  label: string;
  icon: typeof Grid3x3;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "geometry", label: "Geometry", icon: Grid3x3 },
  { id: "library", label: "Materials", icon: Layers },
  { id: "elements", label: "Elements", icon: Boxes },
  { id: "loads", label: "Loads", icon: ArrowDownToLine },
  { id: "analysis", label: "Analysis", icon: Sigma },
  { id: "validation", label: "Validation", icon: CheckCircle2 },
  { id: "design", label: "Design", icon: PenTool },
  { id: "optimization", label: "Optimization", icon: TrendingUp },
  { id: "visualization", label: "Visualization", icon: Eye },
  { id: "detailing", label: "Detailing", icon: Ruler },
  { id: "documentation", label: "Documentation", icon: FileText },
];

interface SidebarProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  onOpenWorkflow: () => void;
}

export function Sidebar({ activeTab, onSelectTab, onOpenWorkflow }: SidebarProps) {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-surface-border bg-surface-card">
      <div className="border-b border-surface-border px-4 py-4">
        <div className="font-mono text-[11px] uppercase tracking-wider text-brand-600">
          CivilOS
        </div>
        <div className="text-base font-semibold text-text-primary">Structural</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-800"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-surface-border px-2.5 py-3">
        <button
          type="button"
          onClick={onOpenWorkflow}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <ListTree size={16} className="flex-shrink-0" />
          Workflow
        </button>
      </div>
    </aside>
  );
}
