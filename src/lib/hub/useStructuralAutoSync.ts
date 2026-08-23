"use client";

/**
 * Structural → Hub Auto-Sync
 * ------------------------------------------------------------------
 * EngineXDraw-এর useArchitecturalAutoSync.ts (apps/web/src/lib/hub/) এর
 * ঠিক একই প্যাটার্ন: element subcollection বদলালে debounce করে
 * publishStructuralToHub() (hub-structural-export.ts) কল হয়, যেটা
 * নিজেই fetch+assemble+push সব করে — এই hook নিজে কোনো element data
 * রাখে না/পাঠায় না।
 *
 * Draw-এর তুলনায় সরল কারণ এই app-এ প্রতিটা floor আলাদা subcollection
 * না — subscribeToElements() (elements/firestore.ts) পুরো project-এর
 * সব element একটা subcollection থেকে single listener-এ দেয়, তাই
 * per-floor listener fan-out/settle-timer জটিলতা এখানে দরকার নেই।
 * শুধু mount-এর প্রথম snapshot (initial load, real edit না) push
 * ট্রিগার করা এড়াতে একই "settle window" ধারণা ব্যবহার করা হলো,
 * single listener-এর জন্য সরলীকৃত।
 */

import { useEffect, useRef, useState } from "react";
import { subscribeToElements } from "@/lib/elements/firestore";
import { publishStructuralToHub } from "./hub-structural-export";
import { useStructuralAutoSyncStatusStore } from "./useStructuralAutoSyncStatusStore";

const DEBOUNCE_MS = 3000;
const INITIAL_SETTLE_MS = 2000;

export type StructuralAutoSyncStatus = "idle" | "pending" | "syncing" | "synced" | "error";

export interface StructuralAutoSyncState {
  status: StructuralAutoSyncStatus;
  lastError: string | null;
  lastSyncedVersion: number | null;
  lastSkippedElementCount: number | null;
}

export function useStructuralAutoSync(projectId: string | null): StructuralAutoSyncState {
  const [state, setState] = useState<StructuralAutoSyncState>({
    status: "idle",
    lastError: null,
    lastSyncedVersion: null,
    lastSkippedElementCount: null,
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settledRef = useRef(false);
  const setGlobalStatus = useStructuralAutoSyncStatusStore((s) => s.setStatus);

  useEffect(() => {
    if (!projectId) return;
    settledRef.current = false;

    const pushToHub = async () => {
      setState((prev) => ({ ...prev, status: "syncing" }));
      setGlobalStatus({ status: "syncing", lastError: null, lastSyncedVersion: null });
      try {
        const result = await publishStructuralToHub(projectId);
        if (result.success) {
          const next = {
            status: "synced" as const,
            lastError: null,
            lastSyncedVersion: result.moduleVersion,
            lastSkippedElementCount: result.skippedElementCount,
          };
          setState(next);
          setGlobalStatus({ status: "synced", lastError: null, lastSyncedVersion: result.moduleVersion });
        } else {
          setState((prev) => ({ ...prev, status: "error", lastError: result.error }));
          setGlobalStatus({ status: "error", lastError: result.error, lastSyncedVersion: null });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Hub-এ sync করতে ব্যর্থ";
        setState((prev) => ({
          ...prev,
          status: "error",
          lastError: message,
        }));
        setGlobalStatus({ status: "error", lastError: message, lastSyncedVersion: null });
      }
    };

    const scheduleDebouncedPush = () => {
      setState((prev) => ({ ...prev, status: "pending" }));
      setGlobalStatus({ status: "pending", lastError: null, lastSyncedVersion: null });
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(pushToHub, DEBOUNCE_MS);
    };

    const settleTimer = setTimeout(() => {
      settledRef.current = true;
    }, INITIAL_SETTLE_MS);

    const unsub = subscribeToElements(projectId, () => {
      if (!settledRef.current) return;
      scheduleDebouncedPush();
    });

    return () => {
      unsub();
      clearTimeout(settleTimer);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [projectId]);

  return state;
}
