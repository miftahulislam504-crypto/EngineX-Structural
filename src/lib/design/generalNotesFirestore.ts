/**
 * General Notes Input Persistence — Documentation Engine dependency
 * (Phase 11 merge)।
 *
 * GeneralNotesPanel এর ইনপুট ফর্ম (project label, code basis, wind
 * speed, cover requirement ইত্যাদি) আগে সম্পূর্ণ local useState ছিল,
 * কোনো Firestore persistence ছাড়াই — panel বন্ধ করলেই হারিয়ে যেত।
 * reportContext.ts (Documentation Engine) এই ইনপুট থেকেই
 * assembleGeneralNotes() চালিয়ে General Notes sheet (S-01) ও Design
 * Report Section D/J বানায় — তাই persist করা আবশ্যক।
 *
 * AssembleGeneralNotesInput (generalNotes.ts) সরাসরি reuse করা হয়েছে
 * — নতুন duplicate টাইপ বানানো হয়নি, কারণ এটা ইতিমধ্যেই সম্পূর্ণ
 * plain/serializable shape।
 */

"use client";

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import type { AssembleGeneralNotesInput } from "@/lib/design/generalNotes";

export type GeneralNotesInput = AssembleGeneralNotesInput;

export async function saveGeneralNotesInput(
  projectId: string,
  input: GeneralNotesInput
): Promise<void> {
  const ref = doc(db(), firestorePaths.generalNotes(projectId));
  await setDoc(ref, { ...input, updatedAt: serverTimestamp() });
}

/** কখনো "Generate" চাপা না হলে null (assembleGeneralNotes() null ইনপুট দিয়ে fake default রিপোর্ট বানানো উচিত না)। */
export async function fetchGeneralNotesInput(
  projectId: string
): Promise<GeneralNotesInput | null> {
  const ref = doc(db(), firestorePaths.generalNotes(projectId));
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  const { updatedAt: _updatedAt, ...input } = snapshot.data();
  return input as GeneralNotesInput;
}
