/**
 * useAutoLoadSyncStatusStore.ts — useAutoLoadSync (layout.tsx এ একবার
 * mount) এর sync status অন্য component (যেমন AnalysisPanel, Step 4
 * stale-banner) থেকে read করার জন্য global store।
 * ------------------------------------------------------------------
 * কেন আলাদা store, useAutoLoadSync এর component state না: useAutoLoadSync
 * নিজে layout.tsx এ একবারই mount হওয়া উচিত (ডুপ্লিকেট Firestore
 * write এড়াতে) — কিন্তু তার status (lastSyncedAt, warnings) অন্য
 * component এও দরকার (Analysis panel এ "stale" banner দেখাতে)।
 * useAutoLoadSync কে সরাসরি AnalysisPanel এ আবার কল করলে সেটা আবার
 * নতুন effect mount করত (আবার subscribe/derive/write চক্র শুরু হতো) —
 * এই ছোট store দিয়ে status broadcast করে সেই সমস্যা এড়ানো হলো।
 */

import { create } from "zustand";

interface AutoLoadSyncStatusState {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  warnings: string[];
  setStatus: (status: { isSyncing: boolean; lastSyncedAt: string | null; warnings: string[] }) => void;
}

export const useAutoLoadSyncStatusStore = create<AutoLoadSyncStatusState>((set) => ({
  isSyncing: false,
  lastSyncedAt: null,
  warnings: [],
  setStatus: (status) => set(status),
}));
