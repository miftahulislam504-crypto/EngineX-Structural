"use client";

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
import {
  createEmptyGeometryCore,
  type GeometryCore,
  type StructuralGrid,
  type StructuralStory,
} from "@/lib/types/geometry";

/**
 * একবার Geometry Core পড়ে আনে। কোনো ডকুমেন্ট না থাকলে একটা খালি
 * কাঠামো ফেরত দেয় (নতুন প্রজেক্টের প্রথম ভিজিটে যা ঘটবে) — undefined/null
 * নিয়ে কল করা প্রতিটা জায়গায় আলাদাভাবে handle করতে হবে না।
 */
export async function fetchGeometryCore(projectId: string): Promise<GeometryCore> {
  const ref = doc(db(), firestorePaths.geometryCore(projectId));
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return createEmptyGeometryCore();
  }

  return snapshot.data() as GeometryCore;
}

/**
 * পুরো Geometry Core ডকুমেন্ট ওভাররাইট করে সেভ করে। Grid/Story যোগ,
 * এডিট, ডিলিট — সবকিছুর জন্য এই একটাই ফাংশন ব্যবহার হয়, কারণ
 * grids/stories অ্যারে হিসেবে থাকে (subcollection না), তাই পুরো
 * অ্যারে-সহ ডকুমেন্ট প্রতিবার নতুন করে লেখাই সহজ ও যথেষ্ট দ্রুত
 * (সংখ্যা সাধারণত কয়েকশোর বেশি হয় না)।
 */
export async function saveGeometryCore(
  projectId: string,
  geometry: Omit<GeometryCore, "updatedAt">
): Promise<void> {
  const ref = doc(db(), firestorePaths.geometryCore(projectId));
  await setDoc(ref, {
    ...geometry,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Real-time listener। 3D viewport এবং ফর্ম UI একই সাথে খোলা থাকলে
 * (একজনের করা পরিবর্তন আরেকজনের স্ক্রিনে সাথে সাথে দেখানোর জন্য,
 * অথবা একই ইউজারের দুই ট্যাবের জন্যও) এটা ব্যবহার হবে।
 *
 * ব্যবহার: useEffect এর ভিতরে কল করে, cleanup এ রিটার্ন করা
 * unsubscribe ফাংশনটা কল করতে হবে।
 */
export function subscribeToGeometryCore(
  projectId: string,
  onUpdate: (geometry: GeometryCore) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(db(), firestorePaths.geometryCore(projectId));

  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as GeometryCore);
      } else {
        onUpdate(createEmptyGeometryCore());
      }
    },
    (error) => {
      onError?.(error);
    }
  );
}

// ---- সুবিধাজনক হেল্পার: একটা গ্রিড/স্টোরি যোগ বা আপডেট করা ----
// এগুলো পুরো GeometryCore অবজেক্ট মিউটেট করে saveGeometryCore কল করে;
// UI লেয়ার (hook/component) এগুলো ব্যবহার করবে যাতে বারবার একই
// merge-logic লিখতে না হয়।

export function upsertGrid(
  geometry: GeometryCore,
  grid: StructuralGrid
): GeometryCore {
  const existingIndex = geometry.grids.findIndex((g) => g.gridId === grid.gridId);
  const grids = [...geometry.grids];

  if (existingIndex >= 0) {
    grids[existingIndex] = grid;
  } else {
    grids.push(grid);
  }

  return { ...geometry, grids };
}

export function removeGrid(geometry: GeometryCore, gridId: string): GeometryCore {
  return { ...geometry, grids: geometry.grids.filter((g) => g.gridId !== gridId) };
}

export function upsertStory(
  geometry: GeometryCore,
  story: StructuralStory
): GeometryCore {
  const existingIndex = geometry.stories.findIndex((s) => s.storyId === story.storyId);
  const stories = [...geometry.stories];

  if (existingIndex >= 0) {
    stories[existingIndex] = story;
  } else {
    stories.push(story);
  }

  // উচ্চতা অনুযায়ী সাজানো রাখা হয়, যাতে viewport ও তালিকা সবসময়
  // base থেকে উপরের দিকে সঠিক ক্রমে দেখায়।
  stories.sort((a, b) => a.elevation - b.elevation);

  return { ...geometry, stories };
}

export function removeStory(geometry: GeometryCore, storyId: string): GeometryCore {
  return { ...geometry, stories: geometry.stories.filter((s) => s.storyId !== storyId) };
}
