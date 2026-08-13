import { create } from "zustand";
import type { SupportOverride } from "@/lib/compute/client";

interface SupportOverrideStoreState {
  /**
   * ইঞ্জিনিয়ার এখনও পর্যন্ত apply করা সব support override — coordinate
   * (x,y,z) দিয়ে key করা, একই coordinate-এ দ্বিতীয়বার apply করলে
   * আগেরটা replace হয় (duplicate entry backend-এ পাঠানো ঠিক না,
   * client.ts-এর SupportOverride কমেন্ট অনুযায়ী "কোনো element
   * endpoint এর সাথে না মিললে warning দিয়ে বাদ যায়" — দুইটা override
   * একই coordinate-এ থাকলে backend কোনটা নেবে অনির্দিষ্ট)।
   */
  overrides: SupportOverride[];
  addOrReplaceOverride: (override: SupportOverride) => void;
  removeOverride: (x: number, y: number, z: number) => void;
  clearAll: () => void;
}

/**
 * useSupportOverrideStore.ts — Phase 5 wiring।
 * ------------------------------------------------------------------
 * FoundationOptimizationPanel (deriveFoundationTypeSuggestion +
 * deriveSupportOverrideSuggestion চালিয়ে suggestion বানায়) ও
 * AnalysisPanel (runLinearStaticAnalysis ইত্যাদির supportOverrides
 * প্যারামিটারে পাঠায়) — দুটো আলাদা route/component, কোনো parent-child
 * সম্পর্ক নেই (analysis ও design আলাদা sidebar tab)। useAnalysisResultStore.ts
 * এর ঠিক একই কারণে (dual-panel local state cross-panel এ পড়া যায় না)
 * এই ছোট shared store — শুধু SupportOverride array, পুরো panel state
 * global করা হয়নি।
 *
 * এই স্টোর কখনো silently কোনো override যোগ করে না — শুধু
 * addOrReplaceOverride() explicit call এ, ইঞ্জিনিয়ার
 * FoundationOptimizationPanel এ suggestion দেখে "Apply as Support
 * Override" বাটনে চাপলেই (deriveSupportOverrideSuggestion.ts এর
 * হেডার কমেন্টের নীতি অক্ষুণ্ণ — suggestion কখনো নিজে থেকে প্রয়োগ হয়
 * না)।
 */
export const useSupportOverrideStore = create<SupportOverrideStoreState>((set) => ({
  overrides: [],
  addOrReplaceOverride: (override) =>
    set((state) => ({
      overrides: [
        ...state.overrides.filter(
          (o) => !(o.x === override.x && o.y === override.y && o.z === override.z)
        ),
        override,
      ],
    })),
  removeOverride: (x, y, z) =>
    set((state) => ({
      overrides: state.overrides.filter((o) => !(o.x === x && o.y === y && o.z === z)),
    })),
  clearAll: () => set({ overrides: [] }),
}));
