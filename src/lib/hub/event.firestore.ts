"use client";

// src/lib/hub/event.firestore.ts
//
// Ported from EngineXDraw's apps/web/src/lib/hub/event.firestore.ts,
// itself ported from CivilOS Hub's lib/firestore/event.firestore.ts. Two
// things changed from Draw's copy, both purely wiring, not logic:
//
//   1. db import — this app's src/lib/firebase/client.ts exports db() as
//      a lazy getter (not a plain `db` value like Draw's
//      firebase-client.ts), specifically so Firestore isn't initialized
//      at module-evaluation time during Next.js prerendering — see the
//      comment on that file. Every `db` reference below is `db()`.
//   2. Firestore paths go through firestorePaths
//      (src/lib/firebase/schema.ts) instead of hand-typed segments, per
//      that file's own "no hand-typed collection path" rule. The path
//      VALUES are unchanged — projects/{projectId}/events/{eventId} is
//      the exact same collection Hub, Draw, and every other app in the
//      ecosystem read/write.
//
// This file intentionally doesn't import dependency.firestore.ts,
// approval.firestore.ts, or (eventually) a hub-write.ts of our own —
// those import THIS file (to emit), not the other way around, matching
// Hub's and Draw's own import direction to avoid a circular import.

import {
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import type { HubEvent, HubEventType } from "./event.types";
import type { SourceApp } from "./contract.types";

function toISO(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return new Date().toISOString();
}

function toEvent(id: string, d: Record<string, unknown>): HubEvent {
  return {
    id,
    projectId: d.projectId as string,
    type: d.type as HubEventType,
    sourceApp: d.sourceApp as SourceApp,
    payload: d.payload as Record<string, unknown> | undefined,
    createdAt: toISO(d.createdAt),
  };
}

export async function emitEvent(
  projectId: string,
  type: HubEventType,
  sourceApp: SourceApp,
  payload?: Record<string, unknown>,
): Promise<void> {
  const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await setDoc(doc(db(), firestorePaths.hubModuleEvent(projectId, id)), {
    projectId,
    type,
    sourceApp,
    ...(payload ? { payload } : {}),
    createdAt: serverTimestamp(),
  });
}

export async function getProjectEvents(projectId: string, max = 20): Promise<HubEvent[]> {
  const snaps = await getDocs(
    query(collection(db(), firestorePaths.hubModuleEvents(projectId)), orderBy("createdAt", "desc"), limit(max)),
  );
  return snaps.docs.map((s) => toEvent(s.id, s.data()));
}

export function subscribeToEvents(
  projectId: string,
  onUpdate: (events: HubEvent[]) => void,
  max = 20,
): () => void {
  const q = query(collection(db(), firestorePaths.hubModuleEvents(projectId)), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map((s) => toEvent(s.id, s.data())));
    },
    () => {
      onUpdate([]); // permission/network error — show empty, don't crash
    },
  );
}
