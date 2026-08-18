import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import type { StructuralMaterial } from "@/lib/types/material";
import type { StructuralSection } from "@/lib/types/section";

/**
 * NOTE: এই ফাইলে আগে ভুলবশত "use client" ডিরেক্টিভ ছিল (geometry/
 * firestore.ts, hub/sync.ts এর মতো একই বাগ) — শুধু plain async
 * function/pure helper, কোনো hook/JSX নেই, কিন্তু reportContext.ts
 * (Documentation API route, server-side) fetchMaterialLibrary/
 * fetchSectionLibrary ইমপোর্ট করে। ডিরেক্টিভ থাকায় PDF ডাউনলোড ভাঙছিল।
 * সরানো হয়েছে — client component/hook থেকে আগের মতোই ব্যবহার করা যাবে।
 *
 * Material Library ও Section Library — প্রতিটা project-এর জন্য একটা
 * করে ডকুমেন্ট, যার ভিতরে একটা array থাকে। এই প্যাটার্নটা Phase 1-এর
 * GeometryCore এর মতোই (src/lib/geometry/firestore.ts দেখুন) — কারণ
 * material/section সংখ্যায় সাধারণত কম (কয়েক থেকে কয়েক-ডজন), এবং UI
 * সবসময় পুরো লাইব্রেরি একসাথে দেখায় (dropdown/picker এ), তাই একটা
 * ডকুমেন্টে রাখা subcollection-এর চেয়ে কম Firestore read লাগে।
 */

export interface MaterialLibrary {
  materials: StructuralMaterial[];
  updatedAt: string;
}

export interface SectionLibrary {
  sections: StructuralSection[];
  updatedAt: string;
}

export function createEmptyMaterialLibrary(): MaterialLibrary {
  return { materials: [], updatedAt: new Date().toISOString() };
}

export function createEmptySectionLibrary(): SectionLibrary {
  return { sections: [], updatedAt: new Date().toISOString() };
}

// ---- Material Library ----

export async function fetchMaterialLibrary(projectId: string): Promise<MaterialLibrary> {
  const ref = doc(db(), firestorePaths.materialLibrary(projectId));
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? (snapshot.data() as MaterialLibrary) : createEmptyMaterialLibrary();
}

export async function saveMaterialLibrary(
  projectId: string,
  library: Omit<MaterialLibrary, "updatedAt">
): Promise<void> {
  const ref = doc(db(), firestorePaths.materialLibrary(projectId));
  await setDoc(ref, { ...library, updatedAt: serverTimestamp() });
}

export function subscribeToMaterialLibrary(
  projectId: string,
  onUpdate: (library: MaterialLibrary) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(db(), firestorePaths.materialLibrary(projectId));
  return onSnapshot(
    ref,
    (snapshot) => {
      onUpdate(snapshot.exists() ? (snapshot.data() as MaterialLibrary) : createEmptyMaterialLibrary());
    },
    (error) => onError?.(error)
  );
}

export function upsertMaterial(
  library: MaterialLibrary,
  material: StructuralMaterial
): MaterialLibrary {
  const existingIndex = library.materials.findIndex((m) => m.materialId === material.materialId);
  const materials = [...library.materials];

  if (existingIndex >= 0) {
    materials[existingIndex] = material;
  } else {
    materials.push(material);
  }

  return { ...library, materials };
}

export function removeMaterial(library: MaterialLibrary, materialId: string): MaterialLibrary {
  return { ...library, materials: library.materials.filter((m) => m.materialId !== materialId) };
}

// ---- Section Library ----

export async function fetchSectionLibrary(projectId: string): Promise<SectionLibrary> {
  const ref = doc(db(), firestorePaths.sectionLibrary(projectId));
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? (snapshot.data() as SectionLibrary) : createEmptySectionLibrary();
}

export async function saveSectionLibrary(
  projectId: string,
  library: Omit<SectionLibrary, "updatedAt">
): Promise<void> {
  const ref = doc(db(), firestorePaths.sectionLibrary(projectId));
  await setDoc(ref, { ...library, updatedAt: serverTimestamp() });
}

export function subscribeToSectionLibrary(
  projectId: string,
  onUpdate: (library: SectionLibrary) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(db(), firestorePaths.sectionLibrary(projectId));
  return onSnapshot(
    ref,
    (snapshot) => {
      onUpdate(snapshot.exists() ? (snapshot.data() as SectionLibrary) : createEmptySectionLibrary());
    },
    (error) => onError?.(error)
  );
}

export function upsertSection(
  library: SectionLibrary,
  section: StructuralSection
): SectionLibrary {
  const existingIndex = library.sections.findIndex((s) => s.sectionId === section.sectionId);
  const sections = [...library.sections];

  if (existingIndex >= 0) {
    sections[existingIndex] = section;
  } else {
    sections.push(section);
  }

  return { ...library, sections };
}

export function removeSection(library: SectionLibrary, sectionId: string): SectionLibrary {
  return { ...library, sections: library.sections.filter((s) => s.sectionId !== sectionId) };
}
