"use client";

/**
 * useGlobalModelSubscriptions.ts — layout-level read-only Firestore
 * subscription, real-time load auto-sync এর জন্য।
 * ------------------------------------------------------------------
 * Miftahul এর সিদ্ধান্ত (Step 3 শুরুর আগে কনফার্ম করা): "Layout এ ৪টা
 * subscription ও তুলে আনি (সব সময় active থাকবে, ETABS-এর মতো ট্রু
 * real-time)"।
 *
 * layout.tsx এর আগের (Phase 4) সিদ্ধান্ত ছিল প্রতিটা domain hook
 * (useElementsCore ইত্যাদি) শুধু তার নিজের page এ mount হবে, কারণ সেই
 * hook গুলোতে subscription ও mutation-action closure একসাথে bundled
 * — layout এ move করলে action closures শুধু সেই hook call করা component
 * এই ব্যবহারযোগ্য থাকত, child page এ prop-drilling সম্ভব ছিল না।
 *
 * এই ফাইল সেই সিদ্ধান্ত ভাঙছে না — বরং একটা আলাদা, সংকীর্ণ (narrower)
 * hook তৈরি করছে যেটা **শুধু subscription অংশ** (Firestore listener →
 * Zustand setter) duplicate করে, কোনো mutation action এখানে নেই।
 * এটা নিরাপদ কারণ:
 *   - Firestore এর onSnapshot() একই query তে একাধিক independent
 *     listener সমর্থন করার জন্যই ডিজাইন করা (প্রতিটা listener নিজের
 *     unsubscribe function পায়, একে অপরের সাথে conflict করে না)।
 *   - দুটো listener (এই hook এর + page-level hook এর, ইউজার সেই page
 *     এ থাকলে) একই setElements()/setGeometry() ইত্যাদি কল করে — এটা
 *     idempotent write (Firestore থেকে আসা একই ডেটা), race condition
 *     তৈরি করে না (Phase 1 এ যে lost-update race এর কথা বলা হয়েছিল
 *     সেটা ছিল local-mutation-vs-remote-snapshot race, দুটো
 *     independent remote-snapshot listener একসাথে চলার race না)।
 *
 * mutation action (addElement, addSection, addPattern, addLoadCase
 * ইত্যাদি) এখনো তাদের নিজের domain page এ useElementsCore/
 * useMaterialSectionLibrary/useLoadCore/useGeometryCore কল করেই
 * পেতে হবে — এই hook শুধু ডেটা সবসময় সচল রাখে, mutation UI না।
 *
 * useAutoLoadSync.ts এই hook এর mount এর উপর নির্ভরশীল — layout.tsx
 * এ দুটোই একসাথে (এই hook আগে) কল করা উচিত, নাহলে useAutoLoadSync
 * চিরকাল isLoading=true দেখে কখনো sync চালাবে না।
 */

import { useEffect } from "react";
import { useEnsureAuth } from "@/lib/firebase/useEnsureAuth";

import { useElementsStore } from "@/lib/elements/useElementsStore";
import { subscribeToElements } from "@/lib/elements/firestore";

import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { subscribeToGeometryCore } from "@/lib/geometry/firestore";

import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { subscribeToMaterialLibrary, subscribeToSectionLibrary } from "@/lib/library/firestore";

import { useLoadStore } from "@/lib/loads/useLoadStore";
import {
  subscribeToLoadPatternLibrary,
  subscribeToLoadCombinationLibrary,
  subscribeToLoadCases,
} from "@/lib/loads/firestore";

/**
 * Elements subscription — page-level useElementsCore এর subscription
 * অংশের হুবহু ডুপ্লিকেট (mutation action ছাড়া)।
 */
function useElementsSubscription(projectId: string, isAuthReady: boolean, authError: string | null) {
  const setElements = useElementsStore((s) => s.setElements);
  const setLoading = useElementsStore((s) => s.setLoading);
  const setLoadError = useElementsStore((s) => s.setLoadError);

  useEffect(() => {
    if (!isAuthReady) return;
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
}

/** Geometry subscription — page-level useGeometryCore এর subscription অংশের ডুপ্লিকেট। */
function useGeometrySubscription(projectId: string, isAuthReady: boolean, authError: string | null) {
  const setGeometry = useGeometryStore((s) => s.setGeometry);
  const setLoading = useGeometryStore((s) => s.setLoading);
  const setLoadError = useGeometryStore((s) => s.setLoadError);

  useEffect(() => {
    if (!isAuthReady) return;
    if (authError) {
      setLoadError(authError);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToGeometryCore(
      projectId,
      (geometry) => {
        setGeometry(geometry);
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
}

/** Material + Section library subscription — page-level useMaterialSectionLibrary এর subscription অংশের ডুপ্লিকেট। */
function useLibrarySubscription(projectId: string, isAuthReady: boolean, authError: string | null) {
  const setMaterialLibrary = useLibraryStore((s) => s.setMaterialLibrary);
  const setSectionLibrary = useLibraryStore((s) => s.setSectionLibrary);
  const setLoading = useLibraryStore((s) => s.setLoading);
  const setLoadError = useLibraryStore((s) => s.setLoadError);

  useEffect(() => {
    if (!isAuthReady) return;
    if (authError) {
      setLoadError(authError);
      setLoading(false);
      return;
    }
    setLoading(true);

    let materialLoaded = false;
    let sectionLoaded = false;
    function checkAllLoaded() {
      if (materialLoaded && sectionLoaded) setLoading(false);
    }

    const unsubMaterial = subscribeToMaterialLibrary(
      projectId,
      (library) => {
        setMaterialLibrary(library);
        materialLoaded = true;
        checkAllLoaded();
      },
      (error) => {
        setLoadError(error.message);
        materialLoaded = true;
        checkAllLoaded();
      }
    );
    const unsubSection = subscribeToSectionLibrary(
      projectId,
      (library) => {
        setSectionLibrary(library);
        sectionLoaded = true;
        checkAllLoaded();
      },
      (error) => {
        setLoadError(error.message);
        sectionLoaded = true;
        checkAllLoaded();
      }
    );

    return () => {
      unsubMaterial();
      unsubSection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isAuthReady, authError]);
}

/** Load Pattern + Combination + Case subscription — page-level useLoadCore এর subscription অংশের ডুপ্লিকেট। */
function useLoadsSubscription(projectId: string, isAuthReady: boolean, authError: string | null) {
  const setPatternLibrary = useLoadStore((s) => s.setPatternLibrary);
  const setCombinationLibrary = useLoadStore((s) => s.setCombinationLibrary);
  const setLoadCases = useLoadStore((s) => s.setLoadCases);
  const setLoading = useLoadStore((s) => s.setLoading);
  const setLoadError = useLoadStore((s) => s.setLoadError);

  useEffect(() => {
    if (!isAuthReady) return;
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
      if (patternLoaded && combinationLoaded && casesLoaded) setLoading(false);
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
}

/**
 * layout.tsx এ একবার কল করলেই elements/geometry/library/loads — চারটা
 * store সবসময় সচল থাকে, ইউজার সংশ্লিষ্ট page ভিজিট না করলেও।
 * useAutoLoadSync এই ডেটার উপর নির্ভর করে real-time sync চালায়।
 */
export function useGlobalModelSubscriptions(projectId: string) {
  const { isReady: isAuthReady, error: authError } = useEnsureAuth();

  useElementsSubscription(projectId, isAuthReady, authError);
  useGeometrySubscription(projectId, isAuthReady, authError);
  useLibrarySubscription(projectId, isAuthReady, authError);
  useLoadsSubscription(projectId, isAuthReady, authError);
}
