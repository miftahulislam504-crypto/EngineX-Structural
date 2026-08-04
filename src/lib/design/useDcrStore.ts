import { create } from "zustand";

/**
 * Phase 10k — DCR (Demand/Capacity Ratio) Aggregator।
 *
 * সমস্যা: utilizationRatio ডিজাইন ইঞ্জিনের বিভিন্ন ফাইলে ছড়ানো
 * (rcBeamFlexure, rcColumnPmInteraction, steelBeamFlexure, rcSlabPunchingShear,
 * rcShearWallShear, footingShear, ইত্যাদি) — প্রতিটা design panel নিজের
 * report-এর ভেতরে local state হিসেবে রাখে। Heat Map visualization-এর
 * জন্য দরকার elementId → single governing ratio-র একটা কেন্দ্রীয় map,
 * যেন 3D viewport প্রতিটা element কে DCR অনুযায়ী রং করতে পারে।
 *
 * প্যাটার্ন useDetailingStore.ts থেকে নেওয়া (elementId-keyed, session-
 * scoped, persisted না — কারণ analysis result-ই persist হয় না, DCR তার
 * derivative)। একটা element-এ একাধিক check থাকতে পারে (যেমন beam-এ
 * flexure + shear আলাদা), তাই per-element record-এ:
 *   - governingRatio: সব check-এর মধ্যে সর্বোচ্চ (worst-case, যেটা
 *     Heat Map রং নির্ধারণ করবে)
 *   - checks: প্রতিটা individual check-এর label + ratio (tooltip/detail
 *     panel-এর জন্য, যাতে "কোন check governing" সেটাও দেখানো যায়)
 *
 * "Send to Detailing Model" বাটনের প্যাটার্ন অনুসরণ করে design panel
 * থেকে explicit push হয় (handleRunDesign সফল হলেই push, রিয়েল-টাইম
 * নয়) — কারণ design result নিজেও local state, global না।
 */

export interface DcrCheckEntry {
  /** যেমন "Flexure", "Shear", "P-M Interaction" — কোন check এই ratio দিয়েছে */
  label: string;
  ratio: number;
}

export interface DcrElementRecord {
  elementId: string;
  elementLabel: string;
  governingRatio: number;
  governingCheckLabel: string;
  checks: DcrCheckEntry[];
}

interface DcrStoreState {
  /** elementId → সর্বশেষ DCR record। */
  records: Record<string, DcrElementRecord>;

  /**
   * একটা element-এর জন্য এক বা একাধিক check ratio সেট/আপডেট করে।
   * আগের কোনো check থাকলে merge হয় (একই label থাকলে replace, নতুন
   * label হলে যোগ) — governingRatio/governingCheckLabel পুনর্গণনা হয়।
   */
  setChecks: (elementId: string, elementLabel: string, checks: DcrCheckEntry[]) => void;
  removeElement: (elementId: string) => void;
  clearAll: () => void;
}

function computeGoverning(checks: DcrCheckEntry[]): { ratio: number; label: string } {
  let governing = checks[0];
  for (const c of checks) {
    if (c.ratio > governing.ratio) governing = c;
  }
  return { ratio: governing.ratio, label: governing.label };
}

export const useDcrStore = create<DcrStoreState>((set) => ({
  records: {},

  setChecks: (elementId, elementLabel, newChecks) =>
    set((state) => {
      if (newChecks.length === 0) return state;
      const existing = state.records[elementId];
      const mergedByLabel = new Map<string, number>();
      if (existing) {
        for (const c of existing.checks) mergedByLabel.set(c.label, c.ratio);
      }
      for (const c of newChecks) mergedByLabel.set(c.label, c.ratio);
      const merged: DcrCheckEntry[] = Array.from(mergedByLabel.entries()).map(([label, ratio]) => ({
        label,
        ratio,
      }));
      const { ratio, label } = computeGoverning(merged);
      return {
        records: {
          ...state.records,
          [elementId]: {
            elementId,
            elementLabel,
            governingRatio: ratio,
            governingCheckLabel: label,
            checks: merged,
          },
        },
      };
    }),

  removeElement: (elementId) =>
    set((state) => {
      const next = { ...state.records };
      delete next[elementId];
      return { records: next };
    }),

  clearAll: () => set({ records: {} }),
}));
