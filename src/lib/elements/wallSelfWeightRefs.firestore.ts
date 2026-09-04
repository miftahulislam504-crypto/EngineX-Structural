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
import type { WallSelfWeightRef } from "@/lib/hub/hub-geometry-parser";
import { stripUndefinedDeep } from "@/lib/utils";

/**
 * elements/firestore.ts এর হুবহু একই subcollection প্যাটার্ন — প্রতিটা
 * ordinary wall নিজের ডকুমেন্ট (structuralElements-এর মতোই সংখ্যায় বড়
 * হতে পারে বলে একই কারণে single-document না)। schema.ts এর হেডার
 * কমেন্ট ও hub-geometry-parser.ts এর WallSelfWeightRef কমেন্ট দেখুন
 * কেন এই আলাদা subcollection দরকার (StructuralElement না বলে
 * structuralElements এ যায় না)।
 */
export async function saveWallSelfWeightRef(
  projectId: string,
  ref: WallSelfWeightRef
): Promise<void> {
  const docRef = doc(db(), firestorePaths.wallSelfWeightRef(projectId, ref.refId));
  await setDoc(docRef, { ...stripUndefinedDeep(ref), updatedAt: serverTimestamp() });
}

export async function deleteWallSelfWeightRef(projectId: string, refId: string): Promise<void> {
  const docRef = doc(db(), firestorePaths.wallSelfWeightRef(projectId, refId));
  await deleteDoc(docRef);
}

/**
 * Import confirm এর সময় পুরনো সেট পাল্টে নতুন সেট বসাতে হয় (একটা wall
 * Draw এ ডিলিট হলে যেন এখানে stale থেকে না যায়) — তাই confirm flow
 * আগের সব refId মুছে তারপর নতুনগুলো লেখে। elements/firestore.ts এর
 * addElement()-এর মতো per-item save না, কারণ elements এর ক্ষেত্রে
 * ইঞ্জিনিয়ার review করে বেছে বেছে "resolved" element যোগ করেন
 * (material/section লাগে), কিন্তু wall self-weight ref এ review করার
 * কিছু নেই (material/section resolve লাগে না) — তাই পুরো ব্যাচ একসাথে
 * replace করা সহজ ও correct, useArchitecturalImport.ts এর
 * buildMergedGeometry()-এর মতোই "merge, replace stale" নীতি।
 */
export async function replaceAllWallSelfWeightRefs(
  projectId: string,
  refs: WallSelfWeightRef[]
): Promise<void> {
  const existing = await fetchAllWallSelfWeightRefs(projectId);
  await Promise.all(existing.map((r) => deleteWallSelfWeightRef(projectId, r.refId)));
  await Promise.all(refs.map((r) => saveWallSelfWeightRef(projectId, r)));
}

export async function fetchAllWallSelfWeightRefs(projectId: string): Promise<WallSelfWeightRef[]> {
  const ref = collection(db(), firestorePaths.wallSelfWeightRefs(projectId));
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((d) => d.data() as WallSelfWeightRef);
}

export function subscribeToWallSelfWeightRefs(
  projectId: string,
  onUpdate: (refs: WallSelfWeightRef[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = collection(db(), firestorePaths.wallSelfWeightRefs(projectId));

  return onSnapshot(
    ref,
    (snapshot) => {
      const refs = snapshot.docs.map((d) => d.data() as WallSelfWeightRef);
      onUpdate(refs);
    },
    (error) => onError?.(error)
  );
}
