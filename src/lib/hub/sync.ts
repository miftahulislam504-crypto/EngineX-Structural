"use client";

/**
 * @deprecated (Hub-Structural Integration Phase 0)
 *
 * This file reads/writes projects/{projectId}/hubSync/{incoming,outgoing}
 * — a path Hub never writes to (fetchHubIncomingPackage() always resolves
 * null in production) and that nothing else reads (pushHubOutgoingPackage()
 * writes into a void). It was built before Hub's real Firestore schema was
 * known; src/lib/types/hub.ts's own header even calls itself the
 * "Section 20" contract, which never matched what Hub actually exposes.
 *
 * The real contract layer now lives in src/lib/hub/{contract,dependency,
 * event,approval,module-data}.{types,firestore}.ts, ported from
 * EngineXDraw's proven copy of the same files. New code should use that,
 * not this.
 *
 * This file is NOT deleted yet because src/lib/documentation/reportContext.ts
 * still calls fetchHubIncomingPackage() (to populate report titleblocks —
 * see Titleblock.tsx) and degrades gracefully to null today. Migrating
 * that call site to real Hub data is Phase 1 (Field Shape Mapper) work,
 * once there's a mapper that can turn Hub's actual fields into something
 * shaped like HubIncomingPackage — or once reportContext.ts is updated to
 * consume the new contract shapes directly.
 */

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
