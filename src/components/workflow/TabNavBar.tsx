"use client";

import { useEffect, useRef, useState } from "react";
import type { SidebarTab, LoadSubTab, DesignSubTab } from "@/lib/workflow/stageTabs";

/**
 * পুরনো tab bar এ ৯টা main tab আর (Design এর ভেতরে) ৩০টা sub-tab সবই
 * `flex-1` দিয়ে এক row এ বসানো ছিল — wrap বা scroll কোনোটাই ছিল না,
 * তাই ছোট স্ক্রিনে (phone) বেশিরভাগ tab ভিউপোর্টের বাইরে চলে যেত এবং
 * ক্লিক করা যেত না (স্ক্রিনশট দ্রষ্টব্য)।
 *
 * এই কম্পোনেন্ট সেটা প্রতিস্থাপন করে:
 * - Main tab গুলো wrap করে (flex-wrap) — সবগুলো সবসময় দেখা যায়, কোনো
 *   scroll বা hidden overflow নেই।
 * - যে tab এর sub-tab আছে (Loads, Design) সেটায় ক্লিক করলে নিচে একটা
 *   dropdown প্যানেল খোলে (popover, absolute positioned) — বাকি main
 *   tab row এর জায়গা দখল করে না।
 * - Design এর ৩০টা sub-tab একসাথে গাদাগাদি না করে category অনুযায়ী
 *   গ্রুপ করা (RC ডিজাইন, স্টিল, ফাউন্ডেশন, অপ্টিমাইজেশন/AI,
 *   ডিটেইলিং/ডকুমেন্টেশন) — dropdown এর ভেতরে scroll করা যায়,
 *   max-height বাঁধা।
 *
 * State ownership অপরিবর্তিত থাকে: activeTab/activeLoadSubTab/
 * activeDesignSubTab সব page.tsx এ-ই থাকে, এই কম্পোনেন্ট শুধু setter
 * গুলো prop হিসেবে নেয় — তাই কোনো panel কম্পোনেন্ট স্পর্শ করতে হয় না।
 */

const MAIN_TABS: { id: SidebarTab; label: string; icon: string; hasSubTabs?: boolean }[] = [
  { id: "geometry", label: "Geometry", icon: "▦" },
  { id: "library", label: "Materials", icon: "◆" },
  { id: "elements", label: "Elements", icon: "⬡" },
  { id: "loads", label: "Loads", icon: "↓", hasSubTabs: true },
  { id: "analysis", label: "Analysis", icon: "∑" },
  { id: "validation", label: "Validation", icon: "✓" },
  { id: "design", label: "Design", icon: "✎", hasSubTabs: true },
  { id: "detailing", label: "Detailing", icon: "▤" },
  { id: "visualization", label: "Visualization", icon: "◎" },
];

const LOAD_SUB_TABS: { id: LoadSubTab; label: string }[] = [
  { id: "patterns", label: "Patterns" },
  { id: "wind", label: "Wind" },
  { id: "seismic", label: "Seismic (EQ)" },
  { id: "apply", label: "Apply to Elements" },
  { id: "combinations", label: "Combinations" },
];

interface DesignSubTabGroup {
  groupLabel: string;
  tabs: { id: DesignSubTab; label: string }[];
}

const DESIGN_SUB_TAB_GROUPS: DesignSubTabGroup[] = [
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
    groupLabel: "Optimization",
    tabs: [
      { id: "foundation-optimization", label: "Foundation Optimization" },
      { id: "section-optimization", label: "Section Optimization" },
      { id: "weight-optimization", label: "Weight Optimization" },
      { id: "cost-optimization", label: "Cost Optimization" },
      { id: "construction-ai-topology-optimization", label: "Construction/AI/Topology" },
    ],
  },
  {
    groupLabel: "Advanced / Verification",
    tabs: [
      { id: "base-isolation", label: "Base Isolation" },
      { id: "collapse-prediction", label: "Collapse Prediction" },
    ],
  },
  {
    groupLabel: "Detailing & Documentation",
    tabs: [
      { id: "rebar-layout", label: "Rebar Layout" },
      { id: "stirrup-tie-zones", label: "Stirrup/Tie Zones" },
      { id: "development-length", label: "Development/Lap Length" },
      { id: "bar-bending-schedule", label: "Bar Bending Schedule" },
      { id: "section-detail", label: "Section Detail" },
      { id: "connection-detail", label: "Connection Detail" },
      { id: "general-notes", label: "General Notes" },
      { id: "drawing-sync", label: "Drawing Sync" },
    ],
  },
];

function findDesignLabel(id: DesignSubTab): string {
  for (const group of DESIGN_SUB_TAB_GROUPS) {
    const tab = group.tabs.find((t) => t.id === id);
    if (tab) return tab.label;
  }
  return id;
}

function findLoadLabel(id: LoadSubTab): string {
  return LOAD_SUB_TABS.find((t) => t.id === id)?.label ?? id;
}

interface TabNavBarProps {
  activeTab: SidebarTab;
  onChangeTab: (tab: SidebarTab) => void;
  activeLoadSubTab: LoadSubTab;
  onChangeLoadSubTab: (tab: LoadSubTab) => void;
  activeDesignSubTab: DesignSubTab;
  onChangeDesignSubTab: (tab: DesignSubTab) => void;
}

export function TabNavBar({
  activeTab,
  onChangeTab,
  activeLoadSubTab,
  onChangeLoadSubTab,
  activeDesignSubTab,
  onChangeDesignSubTab,
}: TabNavBarProps) {
  const [openDropdown, setOpenDropdown] = useState<"loads" | "design" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function handleMainTabClick(tab: (typeof MAIN_TABS)[number]) {
    onChangeTab(tab.id);
    if (tab.hasSubTabs) {
      setOpenDropdown((prev) => (prev === tab.id ? null : (tab.id as "loads" | "design")));
    } else {
      setOpenDropdown(null);
    }
  }

  return (
    <div ref={containerRef} className="relative border-b border-slate-800">
      {/* Main tab row — wraps instead of overflowing */}
      <div className="flex flex-wrap gap-1 p-2">
        {MAIN_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMainTabClick(tab)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-sky-600/20 text-sky-400 border border-sky-700"
                  : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <span className="text-sm leading-none">{tab.icon}</span>
              {tab.label}
              {tab.hasSubTabs && (
                <span className="text-[9px] text-slate-500">
                  {openDropdown === tab.id ? "▲" : "▼"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Current sub-tab indicator (when a dropdown-bearing tab is active but closed) */}
      {activeTab === "loads" && openDropdown !== "loads" && (
        <button
          type="button"
          onClick={() => setOpenDropdown("loads")}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-500 bg-slate-950/50 hover:text-slate-300 transition-colors"
        >
          <span>
            সাব-ট্যাব: <span className="text-sky-400">{findLoadLabel(activeLoadSubTab)}</span>
          </span>
          <span>▼</span>
        </button>
      )}
      {activeTab === "design" && openDropdown !== "design" && (
        <button
          type="button"
          onClick={() => setOpenDropdown("design")}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-500 bg-slate-950/50 hover:text-slate-300 transition-colors"
        >
          <span>
            সাব-ট্যাব: <span className="text-sky-400">{findDesignLabel(activeDesignSubTab)}</span>
          </span>
          <span>▼</span>
        </button>
      )}

      {/* Loads dropdown */}
      {openDropdown === "loads" && (
        <div className="absolute left-0 right-0 top-full z-20 bg-slate-900 border-b border-x border-slate-700 shadow-xl rounded-b-md p-2 max-h-[60vh] overflow-y-auto">
          <div className="flex flex-wrap gap-1">
            {LOAD_SUB_TABS.map((tab) => {
              const isActive = activeLoadSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    onChangeLoadSubTab(tab.id);
                    setOpenDropdown(null);
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "bg-sky-600 text-white"
                      : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Design dropdown — grouped by category */}
      {openDropdown === "design" && (
        <div className="absolute left-0 right-0 top-full z-20 bg-slate-900 border-b border-x border-slate-700 shadow-xl rounded-b-md p-2 max-h-[60vh] overflow-y-auto space-y-3">
          {DESIGN_SUB_TAB_GROUPS.map((group) => (
            <div key={group.groupLabel}>
              <p className="text-[10px] uppercase tracking-wide text-slate-600 mb-1 px-1">
                {group.groupLabel}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.tabs.map((tab) => {
                  const isActive = activeDesignSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        onChangeDesignSubTab(tab.id);
                        setOpenDropdown(null);
                      }}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                        isActive
                          ? "bg-sky-600 text-white"
                          : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
