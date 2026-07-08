import { create } from "zustand";
import type { GeometryCore } from "@/lib/types/geometry";
import { createEmptyGeometryCore } from "@/lib/types/geometry";

interface GeometryStoreState {
  geometry: GeometryCore;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;

  setGeometry: (geometry: GeometryCore) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setLoadError: (error: string | null) => void;
}

/**
 * এই store শুধু client-side reflection — Firestore-ই source of truth।
 * `subscribeToGeometryCore` (src/lib/geometry/firestore.ts) এই store
 * কে আপডেট করবে, আর component গুলো এখান থেকে পড়বে।
 *
 * নোট (Phase 2a): Selection state আগে এই ফাইলে ছিল (GeometrySelection),
 * কিন্তু এখন src/lib/viewport/useSelectionStore.ts এ সরানো হয়েছে —
 * কারণ selection এখন শুধু grid/story না, element-ও (এবং ভবিষ্যতে
 * load/analysis result) সিলেক্টযোগ্য, যা এই "geometry" store-এর
 * নামের সাথে সাংঘর্ষিক হতো।
 */
export const useGeometryStore = create<GeometryStoreState>((set) => ({
  geometry: createEmptyGeometryCore(),
  isLoading: true,
  isSaving: false,
  loadError: null,

  setGeometry: (geometry) => set({ geometry }),
  setLoading: (isLoading) => set({ isLoading }),
  setSaving: (isSaving) => set({ isSaving }),
  setLoadError: (loadError) => set({ loadError }),
}));
