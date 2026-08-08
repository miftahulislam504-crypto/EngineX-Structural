/**
 * Design Result Persistence — Documentation Engine dependency (Phase
 * 11 merge)।
 *
 * এতদিন প্রতিটা design panel (RcBeamDesignPanel ইত্যাদি) এর `report`
 * state শুধু local useState ছিল — schema.ts এর designResults/{designId}
 * collection এ কেউ write করত না। এই ফাইল সেই gap বন্ধ করে, যাতে
 * Documentation Engine (Calc Sheets, Design Report Section G/I, QC
 * Report) actual design output পড়তে পারে।
 *
 * detail শেপ — ইচ্ছাকৃতভাবে Record<string, unknown> (element category
 * ভেদে RcBeamDesignReport/RcColumnDesignReport/... আলাদা shape, একটা
 * কমন টাইপ সম্ভব না)। কিন্তু কনভেনশন সবসময় { input, report } জোড়া —
 * calc sheet এর "A. Input Data" সেকশনের জন্য raw input (span/Mu/Vu/fc/fy)
 * দরকার, যা elementId থেকে reconstruct করা যায় না (নির্দিষ্ট load
 * combination এর বিপরীতে চালানো check এর ইনপুট) — দেখুন
 * documentation/pdf/calc-sheets/detailTypes.ts এর docblock।
 *
 * একটা elementId তে একবারই design result থাকে (নতুন run হলে
 * overwrite, history রাখা হয় না) — designId হিসেবে elementId নিজেই
 * ব্যবহার করা হচ্ছে, যাতে "upsert" স্বাভাবিকভাবেই হয় (আলাদা "does this
 * element already have a result" চেক লাগে না)।
 */

"use client";

import { doc, getDocs, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import type { StructuralElement } from "@/lib/types/element";

export type DesignCheckStatus = "ok" | "warning" | "fail" | "not-checked";

/**
 * সাধারণত StructuralElement["category"] (element-bound design)।
 * "retaining-wall" ব্যতিক্রম — RetainingWallDesignPanel কোনো model
 * element এর সাথে bound না (standalone calculator, দেখুন সেই
 * প্যানেলের docblock), তাই এই ইউনিয়ন সেই কেসটাও গ্রহণ করে।
 *
 * standalone named export (শুধু DesignResult এর ভেতরে inline না) —
 * Documentation Engine (CalcSheetsDocument.tsx, SectionG_DesignSummary.tsx)
 * category-ভিত্তিক ফিল্টারিং/গ্রুপিং করার জন্য এই টাইপ সরাসরি import করে।
 */
export type DesignElementCategory = StructuralElement["category"] | "retaining-wall";

export interface DesignResult {
  elementId: string;
  elementLabel: string;
  elementCategory: DesignElementCategory;
  status: DesignCheckStatus;
  /** সবসময় { input: <RcXDesignInput>, report: <RcXDesignReport> } শেপ — দেখুন ফাইলের docblock। */
  detail: Record<string, unknown>;
  updatedAt: string; // ISO timestamp
}

/**
 * একটা element এর design result persist করে (upsert — আগের result
 * থাকলে replace)। design panel এর handleRunDesign() সফল হলেই কল করা
 * উচিত।
 */
export async function persistDesignResult(
  projectId: string,
  result: Omit<DesignResult, "updatedAt">
): Promise<void> {
  const ref = doc(db(), firestorePaths.designResults(projectId), result.elementId);
  await setDoc(ref, { ...result, updatedAt: new Date().toISOString() });
}

/** প্রজেক্টের সব persisted design result ফেরত দেয় (কোনো ক্রম নিশ্চিত না — caller প্রয়োজনে sort করবে)। */
export async function fetchDesignResults(projectId: string): Promise<DesignResult[]> {
  const ref = collection(db(), firestorePaths.designResults(projectId));
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((d) => d.data() as DesignResult);
}
