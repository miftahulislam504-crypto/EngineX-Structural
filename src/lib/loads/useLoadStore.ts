import { create } from "zustand";
import type { LoadPatternLibrary, LoadCombinationLibrary } from "@/lib/loads/firestore";
import {
  createDefaultLoadPatternLibrary,
  createDefaultLoadCombinationLibrary,
} from "@/lib/loads/firestore";
import type { LoadCase } from "@/lib/types/load";

interface LoadStoreState {
  patternLibrary: LoadPatternLibrary;
  combinationLibrary: LoadCombinationLibrary;
  loadCases: LoadCase[];
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;

  setPatternLibrary: (library: LoadPatternLibrary) => void;
  setCombinationLibrary: (library: LoadCombinationLibrary) => void;
  setLoadCases: (cases: LoadCase[]) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setLoadError: (error: string | null) => void;
}

/**
 * useLibraryStore (Phase 2a) এর মতোই প্যাটার্ন — client-side reflection,
 * Firestore-ই source of truth। useLoadCore hook এটাকে subscribe করে
 * আপডেট রাখবে।
 */
export const useLoadStore = create<LoadStoreState>((set) => ({
  patternLibrary: createDefaultLoadPatternLibrary(),
  combinationLibrary: createDefaultLoadCombinationLibrary(),
  loadCases: [],
  isLoading: true,
  isSaving: false,
  loadError: null,

  setPatternLibrary: (patternLibrary) => set({ patternLibrary }),
  setCombinationLibrary: (combinationLibrary) => set({ combinationLibrary }),
  setLoadCases: (loadCases) => set({ loadCases }),
  setLoading: (isLoading) => set({ isLoading }),
  setSaving: (isSaving) => set({ isSaving }),
  setLoadError: (loadError) => set({ loadError }),
}));
