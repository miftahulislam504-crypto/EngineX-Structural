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
  X,
} from "lucide-react";
import type { SidebarTab } from "@/lib/workflow/stageTabs";

/**
 * Main Navigation Sidebar (Phase 0.5; Phase 2-তে URL-sync যোগ হয়েছে)।
 *
 * EngineXDraw এর components/ProjectShell.tsx এর visual pattern অনুসরণ
 * করা হয়েছে (বাম পাশে fixed-width vertical column, header/nav/footer
 * তিন অংশ, active item এর জন্য soft-accent background) — কিন্তু এখনো
 * সরাসরি Link/usePathname-based route-navigation করে না, plain button
 * + onSelectTab callback-ই রাখা হয়েছে (Phase 2-এর সিদ্ধান্ত, page.tsx
 * এর কমেন্টে বিস্তারিত)।
 *
 * ⚠️ কেন এখনো Link না: এই মুহূর্তে সব ১১টা tab content আসলে একটাই
 * page.tsx এর ভেতরে activeTab state দিয়ে সুইচ হয় (Phase 4-এর আগ
 * পর্যন্ত, যখন প্রতিটা route নিজস্ব real content পাবে)। যদি এখানে
 * সরাসরি <Link href="/model/[id]/design"> বসানো হতো, প্রতি ক্লিকে
 * Phase 1-এর placeholder route hit হয়ে redirect() দিয়ে ফিরে আসত —
 * অর্থাৎ দুইবার navigation, পুরো page.tsx remount, ফর্মের মাঝপথের
 * ইনপুট হারানোর ঝুঁকি। তাই onSelectTab এখনো activeTab state সরাসরি
 * বদলায় (কোনো remount না) — কিন্তু page.tsx-এর নতুন useEffect
 * (activeTab বদলালেই router.replace) URL-টাও পিছন থেকে মিলিয়ে রাখে,
 * তাই ব্যবহারকারীর কাছে এখন সঠিক URL (?tab=design ইত্যাদি) দেখা যায়,
 * shareable ও refresh-safe — আগে (Phase 1-এর আগে) যা ছিল না।
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
  /**
   * ঐচ্ছিক — শুধু mobile drawer variant এ পাস করা হয় (page.tsx এর
   * mobileSidebarOpen ব্লক)। দেওয়া হলে header এ একটা visible ✕ বাটন
   * দেখায় (EngineXDraw এর ProjectShell এর headerAction slot এর মতো)।
   * Desktop permanent rail এ undefined থাকে — বন্ধ করার কোনো concept
   * নেই সেখানে, তাই বাটনও দেখায় না।
   */
  onClose?: () => void;
}

export function Sidebar({ activeTab, onSelectTab, onOpenWorkflow, onClose }: SidebarProps) {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-surface-border bg-surface-card">
      <div className="flex items-start justify-between gap-2 border-b border-surface-border px-4 py-4">
        <div className="min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-wider text-brand-600">
            CivilOS
          </div>
          <div className="text-base font-semibold text-text-primary">Structural</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        )}
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
