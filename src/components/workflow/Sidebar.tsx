"use client";

import {
  Grid3x3,
  Layers,
  DownloadCloud,
  Boxes,
  ArrowDownToLine,
  Sigma,
  CheckCircle2,
  PenTool,
  TrendingUp,
  Eye,
  Ruler,
  FileText,
  X,
  FolderOpen,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SidebarTab } from "@/lib/workflow/stageTabs";
import { useAuthStore } from "@/lib/auth/useAuthStore";

/**
 * Main Navigation Sidebar (Phase 0.5; Phase 2-তে URL-sync; Phase 4-এ
 * layout.tsx এ move + সত্যিকারের route navigation)।
 *
 * EngineXDraw এর components/ProjectShell.tsx এর visual pattern অনুসরণ
 * করা হয়েছে (বাম পাশে fixed-width vertical column, header/nav/footer
 * তিন অংশ, active item এর জন্য soft-accent background)।
 *
 * এখনো plain button + onSelectTab callback (সরাসরি <Link> না) —
 * কিন্তু এখন কারণটা ভিন্ন Phase 2-এর সময়ের চেয়ে। Phase 4-এ প্রতিটা
 * tab সত্যিকারের route পেয়েছে আর এই Sidebar নিজেই layout.tsx-এ
 * (persistent shell) সরে গেছে — onSelectTab এখন model/[projectId]/
 * layout.tsx-এর handleSelectTab/handleMobileSelectTab কল করে, যেটা
 * router.replace() দিয়ে প্রকৃত navigation করে (আগের মতো local state
 * বদল না)। তাও callback pattern রাখা হয়েছে (সরাসরি <Link
 * href={`/model/${id}/${tab}`}> না) কারণ: (১) mobile variant এ
 * navigation-এর সাথে drawer বন্ধ করা + panel sheet খোলা (দুটো
 * অতিরিক্ত state update) একসাথে দরকার — callback এ সেটা এক জায়গায়
 * bundle করা যায়, Link এ আলাদা onClick handler লাগত যেটা কার্যত একই
 * জিনিস আরেকভাবে লেখা; (২) geometry tab-এর route path বাকি ১০টার
 * থেকে আলাদা (কোনো suffix নেই, /model/[id] নিজেই) — এই সামান্য
 * asymmetry callback-এর ভেতরে (navigateToTab) এক জায়গায় লুকানো, Link
 * href বসাতে গেলে এই সিদ্ধান্ত এখানেও ডুপ্লিকেট করতে হতো।
 *
 * সব tab একই level এ ফ্ল্যাট (কোনো group/nest/dropdown নেই) —
 * ব্যবহারকারীর স্পষ্ট নির্দেশ অনুযায়ী। Design/Loads/Optimization/
 * Documentation এর নিজস্ব sub-tab আছে, কিন্তু সেটা এই sidebar-এ না
 * — content area এর উপরে আলাদা horizontal SubTabBar এ (দেখুন
 * components/workflow/SubTabBar.tsx), প্রতিটা নিজের route page-এ।
 */

interface SidebarItem {
  id: SidebarTab;
  label: string;
  icon: typeof Grid3x3;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "geometry", label: "Geometry", icon: Grid3x3 },
  { id: "library", label: "Materials", icon: Layers },
  { id: "import", label: "Import", icon: DownloadCloud },
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
  /**
   * ঐচ্ছিক — শুধু mobile drawer variant এ পাস করা হয় (layout.tsx এর
   * mobileSidebarOpen ব্লক, useShellUiStore থেকে)। দেওয়া হলে header এ
   * একটা visible ✕ বাটন দেখায় (EngineXDraw এর ProjectShell এর
   * headerAction slot এর মতো)। Desktop permanent rail এ undefined
   * থাকে — বন্ধ করার কোনো concept নেই সেখানে, তাই বাটনও দেখায় না।
   */
  onClose?: () => void;
  /**
   * Redesign (২০২৬-০৮) — বর্তমান প্রজেক্টের নাম, layout.tsx এর
   * useProjectInfoCore থেকে আসে। Firestore থেকে এখনো না এলে বা
   * ডকুমেন্ট না পাওয়া গেলে null/undefined — তখন এই header আগের মতোই
   * "CivilOS / Structural" ব্র্যান্ড লেবেল দেখায় (raw projectId কখনোই
   * এখানে fallback হিসেবে দেখানো হয় না, কারণ এই সময়টুকু সংক্ষিপ্ত আর
   * ব্র্যান্ড লেবেল ইতিমধ্যেই একটা যুক্তিসঙ্গত neutral placeholder)।
   */
  projectName?: string | null;
}

export function Sidebar({ activeTab, onSelectTab, onClose, projectName }: SidebarProps) {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-surface-border bg-surface-card">
      <div className="flex items-start justify-between gap-2 border-b border-surface-border px-4 py-4">
        <Link href="/" className="min-w-0 group">
          <div className="font-mono text-[11px] uppercase tracking-wider text-brand-600 group-hover:text-brand-700">
            CivilOS
          </div>
          {projectName ? (
            <div
              className="text-base font-semibold text-text-primary group-hover:text-brand-800 transition-colors truncate"
              title={projectName}
            >
              {projectName}
            </div>
          ) : (
            <div className="text-base font-semibold text-text-primary group-hover:text-brand-800 transition-colors">
              Structural
            </div>
          )}
        </Link>
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
        <Link
          href="/"
          className="mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <FolderOpen size={16} className="flex-shrink-0" />
          প্রজেক্ট লিস্ট
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-red-600 transition-colors"
        >
          <LogOut size={16} className="flex-shrink-0" />
          সাইন-আউট
        </button>
      </div>
    </aside>
  );
}
