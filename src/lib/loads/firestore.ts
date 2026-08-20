import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import type { LoadPattern, LoadCase } from "@/lib/types/load";
import type { LoadCombination } from "@/lib/loads/loadCombinations";
import { generateDefaultLoadCombinations } from "@/lib/loads/loadCombinations";

/**
 * NOTE: এই ফাইলে আগে ভুলবশত "use client" ডিরেক্টিভ ছিল (geometry/
 * firestore.ts, elements/firestore.ts এর মতো একই বাগ) — এই ফাইলের
 * নিজের docstring অনুযায়ীই fetchLoadCases বানানো হয়েছিল
 * reportContext.ts এর server-side route.tsx হ্যান্ডলার থেকে কল হওয়ার
 * জন্য, অথচ "use client" থাকায় ঠিক সেই কলটাই Next.js reject করছিল।
 * ডিরেক্টিভ সরানো হয়েছে — client component/hook থেকে আগের মতোই
 * ব্যবহার করা যাবে।
 *
 * Load Pattern ও Load Combination — MaterialLibrary/SectionLibrary
 * (Phase 2a) এর মতোই single-document প্যাটার্ন, কারণ সংখ্যায় কম।
 * Load Case — StructuralElements (Phase 2a) এর মতোই subcollection,
 * কারণ প্রতিটা element একাধিক load case নিতে পারে এবং মোট সংখ্যা
 * element সংখ্যার সমানুপাতিক হতে পারে।
 */

export interface LoadPatternLibrary {
  patterns: LoadPattern[];
  updatedAt: string;
}

export interface LoadCombinationLibrary {
  combinations: LoadCombination[];
  updatedAt: string;
}

export function createEmptyLoadPatternLibrary(): LoadPatternLibrary {
  return { patterns: [], updatedAt: new Date().toISOString() };
}

/**
 * ডিফল্ট Load Pattern সেট — Load Combination-এর মতোই (নিচে দেখুন),
 * প্রায় প্রতিটা প্রজেক্টেই কমপক্ষে Dead ও Live Load pattern লাগে,
 * তাই খালি library দিয়ে শুরু করানোর বদলে এই দুটো auto-create করে
 * দেওয়া হচ্ছে — ইউজারকে "Dead Load (DL)" টাইপ করে + বাটনে চাপার
 * friction থেকে বাঁচানোর জন্য। Wind/Earthquake pattern এখানে
 * অন্তর্ভুক্ত না — কারণ সেগুলো WindLoadPanel/SeismicLoadPanel-এ
 * সাইট-নির্দিষ্ট প্যারামিটার (exposure category, seismic zone
 * ইত্যাদি) সেট করার পর নিজে থেকেই pattern তৈরি করে, আগে থেকে খালি
 * pattern বসিয়ে রাখলে সেই ফ্লো এর সাথে duplicate/conflict হতে পারত।
 */
export function createDefaultLoadPatternLibrary(): LoadPatternLibrary {
  const now = new Date().toISOString();
  return {
    patterns: [
      {
        patternId: "pattern-default-dead",
        name: "Dead Load (DL)",
        category: "dead",
        selfWeightMultiplier: 1.0,
        createdAt: now,
        updatedAt: now,
      },
      {
        patternId: "pattern-default-live",
        name: "Live Load (LL)",
        category: "live",
        createdAt: now,
        updatedAt: now,
      },
    ],
    updatedAt: now,
  };
}

/**
 * খালি combination library না দিয়ে ডিফল্ট ACI 318-19 combination
 * গুলো দিয়ে শুরু করা হচ্ছে — কারণ এগুলো standard এবং প্রায় সব
 * প্রজেক্টেই প্রয়োজন হয়, ইউজারকে বারবার ম্যানুয়ালি টাইপ করানো
 * অপ্রয়োজনীয় friction তৈরি করত।
 */
export function createDefaultLoadCombinationLibrary(): LoadCombinationLibrary {
  return {
    combinations: generateDefaultLoadCombinations(),
    updatedAt: new Date().toISOString(),
  };
}

// ---- Load Pattern Library ----

export async function fetchLoadPatternLibrary(projectId: string): Promise<LoadPatternLibrary> {
  const ref = doc(db(), firestorePaths.loadPatterns(projectId));
  const snapshot = await getDoc(ref);
  return snapshot.exists()
    ? (snapshot.data() as LoadPatternLibrary)
    : createDefaultLoadPatternLibrary();
}

export async function saveLoadPatternLibrary(
  projectId: string,
  library: Omit<LoadPatternLibrary, "updatedAt">
): Promise<void> {
  const ref = doc(db(), firestorePaths.loadPatterns(projectId));
  await setDoc(ref, { ...library, updatedAt: serverTimestamp() });
}

export function subscribeToLoadPatternLibrary(
  projectId: string,
  onUpdate: (library: LoadPatternLibrary) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(db(), firestorePaths.loadPatterns(projectId));
  return onSnapshot(
    ref,
    (snapshot) => {
      // নোট: subscribeToLoadCombinationLibrary-এর মতোই — ডকুমেন্ট এখনো
      // তৈরি না হলে ডিফল্ট pattern (Dead + Live) দেখানো হয়, কিন্তু
      // Firestore-এ তখনই সেভ হয় যখন ইউজার প্রথমবার কিছু পরিবর্তন করেন
      // (addPattern/deletePattern কল হলে)। শুধু পড়ার জন্য প্রতি ভিজিটে
      // write করা অপ্রয়োজনীয়।
      onUpdate(
        snapshot.exists() ? (snapshot.data() as LoadPatternLibrary) : createDefaultLoadPatternLibrary()
      );
    },
    (error) => onError?.(error)
  );
}

export function upsertLoadPattern(
  library: LoadPatternLibrary,
  pattern: LoadPattern
): LoadPatternLibrary {
  const existingIndex = library.patterns.findIndex((p) => p.patternId === pattern.patternId);
  const patterns = [...library.patterns];
  if (existingIndex >= 0) {
    patterns[existingIndex] = pattern;
  } else {
    patterns.push(pattern);
  }
  return { ...library, patterns };
}

export function removeLoadPattern(
  library: LoadPatternLibrary,
  patternId: string
): LoadPatternLibrary {
  return { ...library, patterns: library.patterns.filter((p) => p.patternId !== patternId) };
}

// ---- Load Combination Library ----

export async function fetchLoadCombinationLibrary(
  projectId: string
): Promise<LoadCombinationLibrary> {
  const ref = doc(db(), firestorePaths.loadCombinations(projectId));
  const snapshot = await getDoc(ref);
  return snapshot.exists()
    ? (snapshot.data() as LoadCombinationLibrary)
    : createDefaultLoadCombinationLibrary();
}

export async function saveLoadCombinationLibrary(
  projectId: string,
  library: Omit<LoadCombinationLibrary, "updatedAt">
): Promise<void> {
  const ref = doc(db(), firestorePaths.loadCombinations(projectId));
  await setDoc(ref, { ...library, updatedAt: serverTimestamp() });
}

export function subscribeToLoadCombinationLibrary(
  projectId: string,
  onUpdate: (library: LoadCombinationLibrary) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(db(), firestorePaths.loadCombinations(projectId));
  return onSnapshot(
    ref,
    (snapshot) => {
      // নোট: প্রথমবার (ডকুমেন্ট এখনো তৈরি না হলে) ডিফল্ট combination
      // দেখানো হয় কিন্তু এখনো Firestore এ সেভ করা হয় না — সেভ হয়
      // শুধু ইউজার প্রথমবার কোনো পরিবর্তন করলে (persist ফাংশন কল
      // হলে)। এটা ইচ্ছাকৃত: শুধু পড়ার জন্য প্রতিটা প্রজেক্ট ভিজিটে
      // একটা write অপারেশন চালানো অপ্রয়োজনীয়।
      onUpdate(
        snapshot.exists()
          ? (snapshot.data() as LoadCombinationLibrary)
          : createDefaultLoadCombinationLibrary()
      );
    },
    (error) => onError?.(error)
  );
}

// ---- Load Cases (subcollection) ----

export async function saveLoadCase(
  projectId: string,
  loadCase: Omit<LoadCase, "updatedAt">
): Promise<void> {
  const ref = doc(db(), firestorePaths.loadCase(projectId, loadCase.loadCaseId));
  await setDoc(ref, { ...loadCase, updatedAt: serverTimestamp() });
}

export async function deleteLoadCase(projectId: string, loadCaseId: string): Promise<void> {
  const ref = doc(db(), firestorePaths.loadCase(projectId, loadCaseId));
  await deleteDoc(ref);
}

export function subscribeToLoadCases(
  projectId: string,
  onUpdate: (loadCases: LoadCase[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = collection(db(), firestorePaths.loadCases(projectId));
  return onSnapshot(
    ref,
    (snapshot) => {
      const loadCases = snapshot.docs.map((d) => d.data() as LoadCase);
      onUpdate(loadCases);
    },
    (error) => onError?.(error)
  );
}

/**
 * subscribeToLoadCases() এর one-shot সংস্করণ — Documentation Engine
 * (reportContext.ts, Phase 11 merge) PDF generate করার সময় একবারই
 * সব load case চায়, live listener না (route.tsx এর server-side GET
 * handler এ subscription রাখাও অর্থহীন — request শেষ হলেই handler
 * রিটার্ন করে)।
 */
export async function fetchLoadCases(projectId: string): Promise<LoadCase[]> {
  const ref = collection(db(), firestorePaths.loadCases(projectId));
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((d) => d.data() as LoadCase);
}
