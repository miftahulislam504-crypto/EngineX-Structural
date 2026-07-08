"use client";

import { useEffect, useCallback } from "react";
import { useLoadStore } from "@/lib/loads/useLoadStore";
import { useEnsureAuth } from "@/lib/firebase/useEnsureAuth";
import {
  subscribeToLoadPatternLibrary,
  subscribeToLoadCombinationLibrary,
  subscribeToLoadCases,
  saveLoadPatternLibrary,
  saveLoadCombinationLibrary,
  saveLoadCase,
  deleteLoadCase,
  upsertLoadPattern,
  removeLoadPattern,
  type LoadPatternLibrary,
  type LoadCombinationLibrary,
} from "@/lib/loads/firestore";
import type { LoadPattern, LoadCase } from "@/lib/types/load";
import type { LoadCombination } from "@/lib/loads/loadCombinations";

/**
 * Load Pattern, Load Combination, Load Case — তিনটা independent
 * Firestore subscription একসাথে চালায় (useMaterialSectionLibrary,
 * Phase 2a এর প্যাটার্ন অনুসরণ করে, কিন্তু এখানে দুইয়ের বদলে তিনটা)।
 * প্রতিটা subscription আলাদাভাবে loaded/error track করে, যাতে একটার
 * সমস্যা বাকি দুটোর কাজ বন্ধ না করে।
 */
export function useLoadCore(projectId: string) {
  const setPatternLibrary = useLoadStore((s) => s.setPatternLibrary);
  const setCombinationLibrary = useLoadStore((s) => s.setCombinationLibrary);
  const setLoadCases = useLoadStore((s) => s.setLoadCases);
  const setLoading = useLoadStore((s) => s.setLoading);
  const setSaving = useLoadStore((s) => s.setSaving);
  const setLoadError = useLoadStore((s) => s.setLoadError);

  const patternLibrary = useLoadStore((s) => s.patternLibrary);

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

    let patternLoaded = false;
    let combinationLoaded = false;
    let casesLoaded = false;

    function checkAllLoaded() {
      if (patternLoaded && combinationLoaded && casesLoaded) {
        setLoading(false);
      }
    }

    const unsubPattern = subscribeToLoadPatternLibrary(
      projectId,
      (updated) => {
        setPatternLibrary(updated);
        patternLoaded = true;
        checkAllLoaded();
      },
      (error) => {
        setLoadError(error.message);
        patternLoaded = true;
        checkAllLoaded();
      }
    );

    const unsubCombination = subscribeToLoadCombinationLibrary(
      projectId,
      (updated) => {
        setCombinationLibrary(updated);
        combinationLoaded = true;
        checkAllLoaded();
      },
      (error) => {
        setLoadError(error.message);
        combinationLoaded = true;
        checkAllLoaded();
      }
    );

    const unsubCases = subscribeToLoadCases(
      projectId,
      (updated) => {
        setLoadCases(updated);
        casesLoaded = true;
        checkAllLoaded();
      },
      (error) => {
        setLoadError(error.message);
        casesLoaded = true;
        checkAllLoaded();
      }
    );

    return () => {
      unsubPattern();
      unsubCombination();
      unsubCases();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isAuthReady, authError]);

  const persistPatterns = useCallback(
    async (next: Omit<LoadPatternLibrary, "updatedAt">) => {
      setSaving(true);
      try {
        await saveLoadPatternLibrary(projectId, next);
      } finally {
        setSaving(false);
      }
    },
    [projectId, setSaving]
  );

  const persistCombinations = useCallback(
    async (next: Omit<LoadCombinationLibrary, "updatedAt">) => {
      setSaving(true);
      try {
        await saveLoadCombinationLibrary(projectId, next);
      } finally {
        setSaving(false);
      }
    },
    [projectId, setSaving]
  );

  const addPattern = useCallback(
    (pattern: LoadPattern) => persistPatterns(upsertLoadPattern(patternLibrary, pattern)),
    [patternLibrary, persistPatterns]
  );

  const deletePattern = useCallback(
    (patternId: string) => persistPatterns(removeLoadPattern(patternLibrary, patternId)),
    [patternLibrary, persistPatterns]
  );

  /**
   * নোট: এখানে useLoadStore.getState() সরাসরি কল করা হচ্ছে (hook দিয়ে
   * subscribe না করে) — ইচ্ছাকৃত প্যাটার্ন। useCallback dependency তে
   * combinationLibrary রাখলে প্রতিবার library বদলালে এই ফাংশনের নতুন
   * reference তৈরি হতো (child component গুলোতে অপ্রয়োজনীয় re-render
   * ঘটাতে পারত), কিন্তু getState() দিয়ে ফাংশন call হওয়ার মুহূর্তের
   * latest state পড়া যায় stale closure এর ঝুঁকি ছাড়াই — এটা Zustand
   * এর ডকুমেন্টেড প্যাটার্ন React lifecycle এর বাইরে থেকে state read
   * করার জন্য।
   */
  const toggleCombination = useCallback(
    (combinationId: string, isEnabled: boolean) => {
      const combinationLibrary = useLoadStore.getState().combinationLibrary;
      const combinations = combinationLibrary.combinations.map((c) =>
        c.combinationId === combinationId ? { ...c, isEnabled } : c
      );
      return persistCombinations({ combinations });
    },
    [persistCombinations]
  );

  const addCustomCombination = useCallback(
    (combination: LoadCombination) => {
      const combinationLibrary = useLoadStore.getState().combinationLibrary;
      return persistCombinations({
        combinations: [...combinationLibrary.combinations, combination],
      });
    },
    [persistCombinations]
  );

  const addLoadCase = useCallback(
    async (loadCase: LoadCase) => {
      setSaving(true);
      try {
        await saveLoadCase(projectId, loadCase);
      } finally {
        setSaving(false);
      }
    },
    [projectId, setSaving]
  );

  const removeLoadCase = useCallback(
    async (loadCaseId: string) => {
      setSaving(true);
      try {
        await deleteLoadCase(projectId, loadCaseId);
      } finally {
        setSaving(false);
      }
    },
    [projectId, setSaving]
  );

  return {
    addPattern,
    deletePattern,
    toggleCombination,
    addCustomCombination,
    addLoadCase,
    removeLoadCase,
  };
}
