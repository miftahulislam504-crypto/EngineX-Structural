import { create } from "zustand";
import type { StructuralElement } from "@/lib/types/element";

interface ElementsStoreState {
  elements: StructuralElement[];
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;

  setElements: (elements: StructuralElement[]) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setLoadError: (error: string | null) => void;
}

/**
 * useGeometryStore (Phase 1) এর মতোই প্যাটার্ন — client-side reflection,
 * Firestore-ই source of truth। useElementsCore hook এটাকে subscribe
 * করে আপডেট রাখবে।
 */
export const useElementsStore = create<ElementsStoreState>((set) => ({
  elements: [],
  isLoading: true,
  isSaving: false,
  loadError: null,

  setElements: (elements) => set({ elements }),
  setLoading: (isLoading) => set({ isLoading }),
  setSaving: (isSaving) => set({ isSaving }),
  setLoadError: (loadError) => set({ loadError }),
}));
