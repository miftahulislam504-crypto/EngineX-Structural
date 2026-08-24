import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Hub_com/lib/utils.ts এর getStatusLabel/getStatusColor এর সাথে
 * হুবহু (একই বাংলা লেবেল, একই status ভ্যালু) — যাতে Hub-এ যে status
 * "চলমান" দেখায় সেটা এখানেও "চলমান"-ই দেখায়, ভিন্ন শব্দে না।
 *
 * generateProjectCode() ইচ্ছাকৃতভাবে পোর্ট করা হয়নি — এই App কখনো
 * প্রজেক্ট তৈরি করে না (শুধু পড়ে), তাই কোড জেনারেট করার দরকার নেই।
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "চলমান";
    case "on_hold":
      return "বিরতি";
    case "completed":
      return "সম্পন্ন";
    default:
      return status;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700 border-green-200";
    case "on_hold":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "completed":
      return "bg-blue-100 text-blue-700 border-blue-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

/**
 * data (ও তার nested object/array গুলো) থেকে সব `undefined`-valued
 * key/element বাদ দেয়। Firestore Web SDK ডিফল্টভাবে (ignoreUndefinedProperties
 * সেট না থাকলে, এই app-এর firebase/client.ts এ নেই) `setDoc()`/
 * `updateDoc()` এ top-level বা nested যেকোনো `undefined` field পেলে
 * পুরো write ব্যর্থ করে (FirebaseError: invalid-argument)।
 *
 * আগে এই ফাংশন শুধু hub-sdk-client.ts এ local ছিল (Hub module data
 * sync এর জন্য)। elements/firestore.ts এও একই সমস্যা দরকার হলো
 * (SlabElement.liveLoadOverride?: number — clear করতে undefined
 * পাঠানো লাগে, ২০২৬-০৮), তাই এখানে shared utility হিসেবে move করা
 * হলো — hub-sdk-client.ts এখন এখান থেকে re-export/import করে, দুই
 * জায়গায় duplicate logic রাখা হয়নি।
 *
 * null বনাম undefined: `null` ইচ্ছাকৃতভাবে রাখা হয় (Firestore null
 * সমর্থন করে, কিছু ফিল্ড সত্যিই "নেই" বোঝাতে null ব্যবহার করে)। শুধু
 * `undefined` strip হয়, `null` অপরিবর্তিত থাকে।
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map((item) => stripUndefinedDeep(item)) as T;
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val === undefined) continue;
      result[key] = stripUndefinedDeep(val);
    }
    return result as T;
  }
  return value;
}
