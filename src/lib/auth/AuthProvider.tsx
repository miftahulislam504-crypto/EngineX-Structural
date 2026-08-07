"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth/useAuthStore";

/**
 * Root-এ (app/layout.tsx) একবার mount হয়ে Firebase auth state listener
 * চালু রাখে, যাতে useAuthStore.user সবসময় বর্তমান sign-in অবস্থা
 * প্রতিফলিত করে — পেজ রিফ্রেশ করলেও (Firebase নিজে থেকেই local
 * persistence থেকে সেশন পুনরুদ্ধার করে, initialize() শুধু সেটা শোনে)।
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);

  return <>{children}</>;
}
