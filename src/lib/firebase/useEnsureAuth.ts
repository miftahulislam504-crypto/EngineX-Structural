"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * অস্থায়ী auth bridge (Phase 1)।
 *
 * প্রেক্ষাপট: firestore.rules এ `request.auth != null` চেক আছে, কিন্তু
 * এই App-এ এখনো কোনো real sign-in UI নেই — Hub থেকে ইউজার সেশন
 * শেয়ার করার প্রকৃত ব্যবস্থা (Firebase Auth custom token বা
 * SSO handoff) একটা পরের Phase-এর কাজ, কারণ এটা Hub App-এর
 * auth architecture এর উপর নির্ভরশীল যা এখনো এই App থেকে দেখা যায়নি।
 *
 * এই মুহূর্তে "কোনো sign-in নেই" এবং "firestore.rules সব বন্ধ" এই
 * দুইয়ের মাঝে একটা gap আছে যেটা এখনই ব্লক করে দিত — তাই সাময়িকভাবে
 * anonymous auth ব্যবহার করা হচ্ছে যাতে অন্তত rules কাজ করে এবং
 * Phase 1 এর Grid/Story ফিচার টেস্ট করা যায়।
 *
 * ⚠️ এটা প্রকৃত multi-user permission enforcement না — anonymous
 * user রা একে অপরের থেকে আলাদা করা যায় না এই সেটআপে। Hub-এর সাথে
 * প্রকৃত auth integration হওয়ার আগে এটাকে security boundary হিসেবে
 * ধরা যাবে না।
 */
export function useEnsureAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth(), (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsReady(true);
        return;
      }

      // কোনো ইউজার সাইন-ইন করা নেই — anonymous auth দিয়ে একটা সেশন
      // তৈরি করার চেষ্টা করা হচ্ছে।
      signInAnonymously(auth()).catch((err) => {
        setError(err instanceof Error ? err.message : "Auth ব্যর্থ হয়েছে");
        setIsReady(true);
      });
    });

    return () => unsubscribe();
  }, []);

  return { user, isReady, error };
}
