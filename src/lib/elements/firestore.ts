import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import type { StructuralElement } from "@/lib/types/element";

/**
 * NOTE: এই ফাইলে আগে ভুলবশত "use client" ডিরেক্টিভ ছিল (geometry/
 * firestore.ts, library/firestore.ts এর মতো একই বাগ) — এই ফাইলের
 * নিজের docstring অনুযায়ীই fetchAllElements বানানো হয়েছিল
 * reportContext.ts (server-side Documentation API route) থেকে কল
 * হওয়ার জন্য, অথচ "use client" থাকায় ঠিক সেই কলটাই Next.js reject
 * করছিল। ডিরেক্টিভ সরানো হয়েছে — client component/hook থেকে আগের
 * মতোই ব্যবহার করা যাবে।
 *
 * Structural Elements — subcollection প্যাটার্ন (Grid/Story/Material/
 * Section এর single-document প্যাটার্নের বিপরীতে)।
 *
 * কারণ: একটা বাস্তব বিল্ডিং মডেলে শত-হাজার beam/column/slab থাকতে
 * পারে। সবগুলো একটা ডকুমেন্টে রাখলে Firestore এর 1MB per-document
 * সীমা ছুঁয়ে ফেলার ঝুঁকি থাকে এবং একটা মাত্র element বদলাতে পুরো
 * ডকুমেন্ট আবার লিখতে হয় (bandwidth/latency খারাপ)। subcollection এ
 * প্রতিটা element নিজের ডকুমেন্ট, তাই individual add/update/delete
 * সরাসরি, দ্রুত, এবং অন্য element প্রভাবিত হয় না।
 */

export async function saveElement(
  projectId: string,
  element: Omit<StructuralElement, "updatedAt">
): Promise<void> {
  const ref = doc(db(), firestorePaths.structuralElement(projectId, element.elementId));
  await setDoc(ref, { ...element, updatedAt: serverTimestamp() });
}

export async function deleteElement(projectId: string, elementId: string): Promise<void> {
  const ref = doc(db(), firestorePaths.structuralElement(projectId, elementId));
  await deleteDoc(ref);
}

/**
 * পুরো subcollection এর one-shot fetch — Documentation Engine
 * (reportContext.ts, Phase 11 merge) এর জন্য দরকার, যেখানে real-time
 * listener এর বদলে "এই মুহূর্তে সব element" চাওয়া হয় (PDF generate
 * করার সময় একবারই)। subscribeToElements() এর মতোই
 * firestorePaths.structuralElements(projectId) collection পড়ে, শুধু
 * getDocs (one-shot) ব্যবহার করে onSnapshot (live listener) এর বদলে।
 */
export async function fetchAllElements(projectId: string): Promise<StructuralElement[]> {
  const ref = collection(db(), firestorePaths.structuralElements(projectId));
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((d) => d.data() as StructuralElement);
}

/**
 * পুরো subcollection-এর real-time listener। ছোট থেকে মাঝারি সাইজের
 * মডেলে (কয়েক হাজার element পর্যন্ত) এটা যথেষ্ট — অনেক বড় মডেলে
 * (ভবিষ্যতে) pagination বা viewport-based lazy loading দরকার হতে
 * পারে, যেটা এখন Phase 2a এর স্কোপের বাইরে।
 */
export function subscribeToElements(
  projectId: string,
  onUpdate: (elements: StructuralElement[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = collection(db(), firestorePaths.structuralElements(projectId));

  return onSnapshot(
    ref,
    (snapshot) => {
      const elements = snapshot.docs.map((d) => d.data() as StructuralElement);
      onUpdate(elements);
    },
    (error) => onError?.(error)
  );
}
