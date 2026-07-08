"use client";

import { useEffect, useCallback } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useEnsureAuth } from "@/lib/firebase/useEnsureAuth";
import { subscribeToElements, saveElement, deleteElement } from "@/lib/elements/firestore";
import type { StructuralElement } from "@/lib/types/element";

/**
 * useGeometryCore (Phase 1) এর মতোই প্যাটার্ন, কিন্তু persist লজিক
 * ভিন্ন — Grid/Story একটা ডকুমেন্টে থাকায় পুরো অ্যারে re-save হতো,
 * কিন্তু Elements subcollection হওয়ায় প্রতিটা element স্বাধীনভাবে
 * save/delete হয় (src/lib/elements/firestore.ts এর কমেন্ট দেখুন)।
 * এর একটা ভালো ফল হলো: এখানে Phase 1-এর lost-update race condition
 * নেই, কারণ দুটো ভিন্ন element যোগ করা মানে দুটো ভিন্ন Firestore
 * ডকুমেন্টে independent write, একে অপরকে overwrite করে না।
 */
export function useElementsCore(projectId: string) {
  const setElements = useElementsStore((s) => s.setElements);
  const setLoading = useElementsStore((s) => s.setLoading);
  const setSaving = useElementsStore((s) => s.setSaving);
  const setLoadError = useElementsStore((s) => s.setLoadError);

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
    const unsubscribe = subscribeToElements(
      projectId,
      (elements) => {
        setElements(elements);
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

  const addElement = useCallback(
    async (element: StructuralElement) => {
      setSaving(true);
      try {
        await saveElement(projectId, element);
      } finally {
        setSaving(false);
      }
    },
    [projectId, setSaving]
  );

  const updateElement = useCallback(
    async (element: StructuralElement) => {
      setSaving(true);
      try {
        await saveElement(projectId, element);
      } finally {
        setSaving(false);
      }
    },
    [projectId, setSaving]
  );

  const removeElement = useCallback(
    async (elementId: string) => {
      setSaving(true);
      try {
        await deleteElement(projectId, elementId);
      } finally {
        setSaving(false);
      }
    },
    [projectId, setSaving]
  );

  return { addElement, updateElement, removeElement };
}
