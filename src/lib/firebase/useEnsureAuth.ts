"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * Real sign-in bridge (Phase 0.2 থেকে)।
 *
 * আগে (Phase 1) এখানে anonymous auth ব্যবহার হতো, কারণ তখনো কোনো
 * sign-in UI ছিল না — সেই সাময়িক bridge এখন সরানো হয়েছে, কারণ
 * lib/auth/useAuthStore.ts + app/login/page.tsx দিয়ে real email/
 * password sign-in এসে গেছে (Hub এর সাথে একই Firebase project শেয়ার
 * করে, কিন্তু session আলাদা — প্রতিটা App এ আলাদা করে সাইন-ইন লাগে)।
 *
 * এখন isReady শুধু তখনই true হয় যখন প্রকৃত (non-null) signed-in user
 * পাওয়া যায়, অথবা onAuthStateChanged প্রথমবার fire করে জানিয়ে দেয় যে
 * কেউ signed-in নেই (currentUser === null)। কেউ signed-in না থাকলে
 * এই hook নিজে redirect করে না — সেই দায়িত্ব যে component এটা call
 * করে তার (এই App এ: app/model/[projectId]/page.tsx, যেটা user===null
 * ও isReady===true দেখলে /login এ পাঠিয়ে দেয়)। এভাবে এই hook টা শুধু
 * "auth অবস্থা কী" জানায়, "না থাকলে কী করব" এর সিদ্ধান্ত component এর
 * উপর ছেড়ে দেয় — future এ ভিন্ন route ভিন্নভাবে react করতে চাইলে
 * (যেমন read-only public preview) সহজ হবে।
 *
 * Geometry/Elements/Library/Loads — এই ৪টা hook এই ফাইলের বাইরের
 * signature (`{ user, isReady, error }`) এর উপর নির্ভর করে, তাই এই
 * পরিবর্তনে তাদের কোনো কোড বদলাতে হয়নি — শুধু ভেতরের logic বদলেছে।
 */
export function useEnsureAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth(),
      (currentUser) => {
        setUser(currentUser);
        setIsReady(true);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Auth ব্যর্থ হয়েছে");
        setIsReady(true);
      }
    );

    return () => unsubscribe();
  }, []);

  return { user, isReady, error };
}
