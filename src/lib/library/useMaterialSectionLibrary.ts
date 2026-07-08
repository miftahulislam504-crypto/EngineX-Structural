"use client";

import { useEffect, useCallback } from "react";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useEnsureAuth } from "@/lib/firebase/useEnsureAuth";
import {
  subscribeToMaterialLibrary,
  subscribeToSectionLibrary,
  saveMaterialLibrary,
  saveSectionLibrary,
  upsertMaterial,
  removeMaterial,
  upsertSection,
  removeSection,
  type MaterialLibrary,
  type SectionLibrary,
} from "@/lib/library/firestore";
import type { StructuralMaterial } from "@/lib/types/material";
import type { StructuralSection } from "@/lib/types/section";

/**
 * Material ও Section Library-এর জন্য orchestration hook। useGeometryCore
 * (Phase 1) এর মতোই প্যাটার্ন — auth ready হওয়া পর্যন্ত অপেক্ষা করে,
 * তারপর দুটো আলাদা Firestore ডকুমেন্ট (materialLibrary, sectionLibrary)
 * subscribe করে।
 *
 * দুটো আলাদা subscription এক hook-এ রাখা হয়েছে কারণ UI-তে এগুলো প্রায়
 * সবসময় একসাথে দরকার হয় (Section ফর্মে Material picker থাকে), তাই
 * একটা hook কল করেই দুটোর ডেটা ও mutation ফাংশন পাওয়া সুবিধাজনক।
 */
export function useMaterialSectionLibrary(projectId: string) {
  const setMaterialLibrary = useLibraryStore((s) => s.setMaterialLibrary);
  const setSectionLibrary = useLibraryStore((s) => s.setSectionLibrary);
  const setLoading = useLibraryStore((s) => s.setLoading);
  const setSaving = useLibraryStore((s) => s.setSaving);
  const setLoadError = useLibraryStore((s) => s.setLoadError);

  const materialLibrary = useLibraryStore((s) => s.materialLibrary);
  const sectionLibrary = useLibraryStore((s) => s.sectionLibrary);

  const { isReady: isAuthReady, error: authError } = useEnsureAuth();

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (authError) {
      setLoadError(authError);
      setLoading(false);
      return;
    }

    setLoading(true);

    // দুটো subscription স্বাধীনভাবে চলে — একটা fail করলে আরেকটা তবুও
    // কাজ করবে (উদাহরণ: material library ঠিকমতো লোড হলো কিন্তু section
    // library তে সাময়িক নেটওয়ার্ক সমস্যা, তাহলে material দিয়ে অন্তত
    // কাজ চালিয়ে যাওয়া যায়)।
    let materialLoaded = false;
    let sectionLoaded = false;

    function checkBothLoaded() {
      if (materialLoaded && sectionLoaded) {
        setLoading(false);
      }
    }

    const unsubMaterial = subscribeToMaterialLibrary(
      projectId,
      (updated) => {
        setMaterialLibrary(updated);
        materialLoaded = true;
        checkBothLoaded();
      },
      (error) => {
        setLoadError(error.message);
        materialLoaded = true;
        checkBothLoaded();
      }
    );

    const unsubSection = subscribeToSectionLibrary(
      projectId,
      (updated) => {
        setSectionLibrary(updated);
        sectionLoaded = true;
        checkBothLoaded();
      },
      (error) => {
        setLoadError(error.message);
        sectionLoaded = true;
        checkBothLoaded();
      }
    );

    return () => {
      unsubMaterial();
      unsubSection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isAuthReady, authError]);

  const persistMaterials = useCallback(
    async (next: MaterialLibrary) => {
      setSaving(true);
      try {
        await saveMaterialLibrary(projectId, next);
      } finally {
        setSaving(false);
      }
    },
    [projectId, setSaving]
  );

  const persistSections = useCallback(
    async (next: SectionLibrary) => {
      setSaving(true);
      try {
        await saveSectionLibrary(projectId, next);
      } finally {
        setSaving(false);
      }
    },
    [projectId, setSaving]
  );

  const addMaterial = useCallback(
    (material: StructuralMaterial) => persistMaterials(upsertMaterial(materialLibrary, material)),
    [materialLibrary, persistMaterials]
  );

  const updateMaterial = useCallback(
    (material: StructuralMaterial) => persistMaterials(upsertMaterial(materialLibrary, material)),
    [materialLibrary, persistMaterials]
  );

  const deleteMaterial = useCallback(
    (materialId: string) => persistMaterials(removeMaterial(materialLibrary, materialId)),
    [materialLibrary, persistMaterials]
  );

  const addSection = useCallback(
    (section: StructuralSection) => persistSections(upsertSection(sectionLibrary, section)),
    [sectionLibrary, persistSections]
  );

  const updateSection = useCallback(
    (section: StructuralSection) => persistSections(upsertSection(sectionLibrary, section)),
    [sectionLibrary, persistSections]
  );

  const deleteSection = useCallback(
    (sectionId: string) => persistSections(removeSection(sectionLibrary, sectionId)),
    [sectionLibrary, persistSections]
  );

  return {
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addSection,
    updateSection,
    deleteSection,
  };
}
