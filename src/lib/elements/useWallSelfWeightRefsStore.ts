import { create } from "zustand";
import type { WallSelfWeightRef } from "@/lib/hub/hub-geometry-parser";

interface WallSelfWeightRefsStoreState {
  refs: WallSelfWeightRef[];
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;

  setRefs: (refs: WallSelfWeightRef[]) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setLoadError: (error: string | null) => void;
}

/**
 * useElementsStore এর হুবহু একই প্যাটার্ন (client-side reflection,
 * Firestore-ই source of truth) — ordinary wall centerline+self-weight
 * ref এর জন্য, ২০২৬-০৯-০৪ Hub payload-size split (hub-write.ts,
 * hub-geometry-parser.ts এর WallSelfWeightRef কমেন্ট দেখুন)। এই refs
 * StructuralElement না বলে useElementsStore এ মেশানো হয়নি — আলাদা
 * store, আলাদা subcollection (wallSelfWeightRefs, schema.ts)।
 */
export const useWallSelfWeightRefsStore = create<WallSelfWeightRefsStoreState>((set) => ({
  refs: [],
  isLoading: true,
  isSaving: false,
  loadError: null,

  setRefs: (refs) => set({ refs }),
  setLoading: (isLoading) => set({ isLoading }),
  setSaving: (isSaving) => set({ isSaving }),
  setLoadError: (loadError) => set({ loadError }),
}));
