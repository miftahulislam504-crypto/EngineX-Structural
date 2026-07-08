import { create } from "zustand";
import type { MaterialLibrary, SectionLibrary } from "@/lib/library/firestore";
import { createEmptyMaterialLibrary, createEmptySectionLibrary } from "@/lib/library/firestore";

interface LibraryStoreState {
  materialLibrary: MaterialLibrary;
  sectionLibrary: SectionLibrary;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;

  setMaterialLibrary: (library: MaterialLibrary) => void;
  setSectionLibrary: (library: SectionLibrary) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setLoadError: (error: string | null) => void;
}

/**
 * Phase 1-এর useGeometryStore এর মতোই — এই store শুধু client-side
 * reflection, Firestore-ই source of truth। useMaterialSectionLibrary
 * hook (একই ফোল্ডারে) এটাকে subscribe করে আপডেট রাখবে।
 */
export const useLibraryStore = create<LibraryStoreState>((set) => ({
  materialLibrary: createEmptyMaterialLibrary(),
  sectionLibrary: createEmptySectionLibrary(),
  isLoading: true,
  isSaving: false,
  loadError: null,

  setMaterialLibrary: (materialLibrary) => set({ materialLibrary }),
  setSectionLibrary: (sectionLibrary) => set({ sectionLibrary }),
  setLoading: (isLoading) => set({ isLoading }),
  setSaving: (isSaving) => set({ isSaving }),
  setLoadError: (loadError) => set({ loadError }),
}));
