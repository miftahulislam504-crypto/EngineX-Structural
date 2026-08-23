/**
 * useStructuralAutoSyncStatusStore.ts — useStructuralAutoSync (layout.tsx
 * এ একবার mount) এর sync status অন্য component (ViewportStatusChip)
 * থেকে read করার জন্য global store।
 * ------------------------------------------------------------------
 * ঠিক useAutoLoadSyncStatusStore.ts এর একই কারণে আলাদা store:
 * useStructuralAutoSync নিজে layout.tsx এ একবারই mount হওয়া উচিত
 * (ডুপ্লিকেট Hub push এড়াতে) — কিন্তু তার status (syncing/synced/error)
 * ViewportStatusChip এও দরকার। useStructuralAutoSync কে সরাসরি
 * ViewportStatusChip এ আবার কল করলে সেটা আবার নতুন subscribeToElements
 * listener + debounce timer শুরু করত (ডুপ্লিকেট Hub push) — এই ছোট
 * store দিয়ে status broadcast করে সেই সমস্যা এড়ানো হলো।
 */

import { create } from "zustand";
import type { StructuralAutoSyncStatus } from "./useStructuralAutoSync";

interface StructuralAutoSyncStatusState {
  status: StructuralAutoSyncStatus;
  lastError: string | null;
  lastSyncedVersion: number | null;
  setStatus: (status: {
    status: StructuralAutoSyncStatus;
    lastError: string | null;
    lastSyncedVersion: number | null;
  }) => void;
}

export const useStructuralAutoSyncStatusStore = create<StructuralAutoSyncStatusState>((set) => ({
  status: "idle",
  lastError: null,
  lastSyncedVersion: null,
  setStatus: (status) => set(status),
}));
