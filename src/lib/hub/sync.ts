"use client";

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import type { HubIncomingPackage } from "@/lib/types/hub";
import type { OutgoingHubPackage } from "@/lib/types/hub-outgoing";

/**
 * Hub থেকে Project Information, Architectural Model, Material Library,
 * Site Information, Geotechnical Data পড়ে আনে (Section 20: Receive from Hub)।
 *
 * এই App এই ডেটা কখনো এডিট করবে না — শুধু পড়বে ও ব্যবহার করবে।
 */
export async function fetchHubIncomingPackage(
  projectId: string
): Promise<HubIncomingPackage | null> {
  const ref = doc(db(), firestorePaths.hubSyncIncoming(projectId));
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as HubIncomingPackage;
}

/**
 * Structural Model, Analysis Results, Design Results ইত্যাদি Hub-কে
 * ফেরত পাঠায় (Section 20: Send back to Hub)।
 *
 * এই ফাংশন পুরো প্যাকেজ ওভাররাইট করে না — merge করে, যাতে একটা অংশ
 * (যেমন শুধু analysisResults) আপডেট করলে বাকি অংশ (designResults ইত্যাদি)
 * অক্ষত থাকে।
 */
export async function pushHubOutgoingPackage(
  projectId: string,
  partial: Partial<Omit<OutgoingHubPackage, "projectId" | "lastSyncedAt">>
): Promise<void> {
  const ref = doc(db(), firestorePaths.hubSyncOutgoing(projectId));

  await setDoc(
    ref,
    {
      projectId,
      ...partial,
      lastSyncedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * বর্তমান outgoing package পড়ে (UI-তে sync status দেখানোর জন্য)।
 */
export async function fetchHubOutgoingPackage(
  projectId: string
): Promise<OutgoingHubPackage | null> {
  const ref = doc(db(), firestorePaths.hubSyncOutgoing(projectId));
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as OutgoingHubPackage;
}
