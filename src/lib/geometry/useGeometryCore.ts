"use client";

import { useEffect, useCallback } from "react";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useEnsureAuth } from "@/lib/firebase/useEnsureAuth";
import {
  subscribeToGeometryCore,
  saveGeometryCore,
  upsertGrid,
  removeGrid,
  upsertStory,
  removeStory,
} from "@/lib/geometry/firestore";
import type { StructuralGrid, StructuralStory, GeometryCore } from "@/lib/types/geometry";

/**
 * story.order কে elevation অনুযায়ী পুনর্গণনা করে — নিচেরটা 0, তার
 * উপরের 1, ইত্যাদি। এটা upsertStory এর ভিতরে না রেখে এখানে আলাদা
 * রাখা হয়েছে কারণ এটা পুরো geometry.stories অ্যারের উপর নির্ভরশীল
 * (শুধু একটা story-র উপর না), এবং save করার ঠিক আগে একবার চালানোই
 * যথেষ্ট।
 */
function withRecalculatedOrder(geometry: GeometryCore): GeometryCore {
  const sorted = [...geometry.stories].sort((a, b) => a.elevation - b.elevation);
  const stories = sorted.map((story, index) => ({ ...story, order: index }));
  return { ...geometry, stories };
}

/**
 * Phase 1 Geometry Core-এর জন্য একমাত্র orchestration hook।
 * ব্যবহার: প্রজেক্টের top-level কম্পোনেন্টে একবার কল করা হবে (যেমন
 * geometry পেজের রুট), এটা Firestore subscription চালু করবে এবং
 * mutation ফাংশনগুলো রিটার্ন করবে যা GridPanel/StoryPanel ব্যবহার করবে।
 */
export function useGeometryCore(projectId: string) {
  const setGeometry = useGeometryStore((s) => s.setGeometry);
  const setLoading = useGeometryStore((s) => s.setLoading);
  const setSaving = useGeometryStore((s) => s.setSaving);
  const setLoadError = useGeometryStore((s) => s.setLoadError);
  const geometry = useGeometryStore((s) => s.geometry);

  const { isReady: isAuthReady, error: authError } = useEnsureAuth();

  useEffect(() => {
    // auth সেশন (এই মুহূর্তে anonymous — src/lib/firebase/useEnsureAuth.ts
    // এর কমেন্ট দেখুন) প্রস্তুত না হওয়া পর্যন্ত Firestore subscribe করা
    // হচ্ছে না, কারণ firestore.rules এ request.auth != null চেক আছে —
    // আগে subscribe করলে "permission-denied" এরর আসবে।
    if (!isAuthReady) {
      return;
    }

    if (authError) {
      setLoadError(authError);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToGeometryCore(
      projectId,
      (updated) => {
        setGeometry(updated);
        setLoading(false);
        setLoadError(null);
      },
      (error) => {
        setLoadError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isAuthReady, authError]);

  /**
   * সীমাবদ্ধতা (ইচ্ছাকৃতভাবে Phase 1-এ সমাধান করা হয়নি): persist()
   * প্রতিবার local `geometry` স্ন্যাপশট থেকে শুরু করে upsert করে,
   * তারপর Firestore-এ লেখে। যদি দুটো mutation প্রায় একই সময়ে শুরু হয়
   * (প্রথমটার Firestore write শেষ হওয়ার আগেই দ্বিতীয়টা শুরু হয়), তাহলে
   * দ্বিতীয়টা প্রথমটার পরিবর্তন হারিয়ে ফেলতে পারে (lost update)।
   *
   * এটা এখন গ্রহণযোগ্য কারণ UI ফর্ম-চালিত এবং একজন ইউজার একবারে একটা
   * বাটন চাপেন। একাধিক ইউজার একই প্রজেক্টে একসাথে গ্রিড/স্টোরি এডিট
   * করলে (multi-user concurrent editing) এই সমস্যা বাস্তবে দেখা দিতে
   * পারে — সেটা সমাধান করতে হলে Firestore transaction
   * (runTransaction) ব্যবহার করতে হবে, যা পরের কোনো Phase-এ
   * প্রয়োজন হলে যোগ করা যাবে।
   */
  const persist = useCallback(
    async (next: GeometryCore) => {
      setSaving(true);
      try {
        await saveGeometryCore(projectId, next);
        // এখানে setGeometry(next) কল করা হচ্ছে না — subscribeToGeometryCore
        // এর onSnapshot নিজেই আপডেটেড ডেটা ফিরিয়ে আনবে সাথে সাথেই, যা
        // Firestore-কে single source of truth রাখে (optimistic local
        // state এর সাথে সার্ভার state এর অসামঞ্জস্যের ঝুঁকি এড়াতে)।
      } finally {
        setSaving(false);
      }
    },
    [projectId, setSaving]
  );

  const addGrid = useCallback(
    (grid: StructuralGrid) => persist(upsertGrid(geometry, grid)),
    [geometry, persist]
  );

  const updateGrid = useCallback(
    (grid: StructuralGrid) => persist(upsertGrid(geometry, grid)),
    [geometry, persist]
  );

  const deleteGrid = useCallback(
    (gridId: string) => persist(removeGrid(geometry, gridId)),
    [geometry, persist]
  );

  const addStory = useCallback(
    (story: StructuralStory) => persist(withRecalculatedOrder(upsertStory(geometry, story))),
    [geometry, persist]
  );

  const updateStory = useCallback(
    (story: StructuralStory) => persist(withRecalculatedOrder(upsertStory(geometry, story))),
    [geometry, persist]
  );

  const deleteStory = useCallback(
    (storyId: string) => persist(withRecalculatedOrder(removeStory(geometry, storyId))),
    [geometry, persist]
  );

  return { addGrid, updateGrid, deleteGrid, addStory, updateStory, deleteStory };
}
