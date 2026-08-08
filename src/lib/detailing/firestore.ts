/**
 * Detailing Result Persistence — Documentation Engine dependency
 * (Phase 11 merge)।
 *
 * useDetailingStore.ts ইচ্ছাকৃতভাবে session-scoped রাখা হয়েছিল (দেখুন
 * সেই ফাইলের docblock — analysis result persist না হওয়ায় detailing ও
 * করা হয়নি)। এখন analysis/firestore.ts ও design/firestore.ts persist
 * করে, তাই detailing কেও persist করা এখন সামঞ্জস্যপূর্ণ — Bar Bending
 * Schedule (BBS) ও Drawing Sheets (Documentation Engine) কে actual
 * rebar geometry পড়তে হয়, শুধু session-এ generate হওয়া অস্থায়ী state
 * থেকে না (পেজ রিলোড করলে Documentation Engine এ কিছুই দেখাবে না,
 * নাহলে)।
 *
 * elementDetailingResults collection path schema.ts এ Phase 10j থেকেই
 * সংজ্ঞায়িত ছিল (subcollection, elements এর সাথে ১:১) — শুধু read/write
 * function এই ফাইলে প্রথমবার লেখা হলো।
 */

"use client";

import { doc, getDocs, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import type { DetailingResult } from "@/lib/detailing/types";

/** একটা element এর detailing result persist করে (upsert — elementId ই doc id)। */
export async function persistDetailingResult(
  projectId: string,
  result: DetailingResult
): Promise<void> {
  const ref = doc(
    db(),
    firestorePaths.elementDetailingResults(projectId),
    result.elementId
  );
  await setDoc(ref, result);
}

/** প্রজেক্টের সব persisted detailing result ফেরত দেয়। */
export async function fetchAllDetailingResults(
  projectId: string
): Promise<DetailingResult[]> {
  const ref = collection(db(), firestorePaths.elementDetailingResults(projectId));
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((d) => d.data() as DetailingResult);
}
