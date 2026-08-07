import { create } from "zustand";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, name: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  clearError: () => void;
  initialize: () => () => void;
}

const errorMessage = (code: string): string => {
  const map: Record<string, string> = {
    "auth/user-not-found": "এই ইমেইলে কোনো একাউন্ট নেই।",
    "auth/wrong-password": "পাসওয়ার্ড সঠিক নয়।",
    "auth/invalid-email": "ইমেইল ঠিকানা সঠিক নয়।",
    "auth/email-already-in-use": "এই ইমেইলে ইতিমধ্যে একাউন্ট আছে।",
    "auth/weak-password": "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।",
    "auth/too-many-requests": "অনেক বার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    "auth/invalid-credential": "ইমেইল বা পাসওয়ার্ড ভুল।",
  };
  return map[code] ?? "সমস্যা হয়েছে। আবার চেষ্টা করুন।";
};

/**
 * Structural App-এর নিজস্ব sign-in session (Hub_com/store/useAuthStore.ts
 * এর সাথে pattern-এ identical, কিন্তু এই App-এর lazy-getter auth()/db()
 * ফাংশন ব্যবহার করে — Hub-এর মতো module-level `auth`/`db` constant নয়,
 * কারণ src/lib/firebase/client.ts ইচ্ছাকৃতভাবে lazy init করে যাতে build
 * এর সময় "auth/invalid-api-key" এরর না আসে)।
 *
 * এই App একই Firebase project ব্যবহার করে Hub-এর সাথে (env vars শেয়ার
 * করা), তাই Hub-এ যে একাউন্ট আছে সেই email/password দিয়েই এখানে
 * সাইন-ইন করা যাবে — কিন্তু session আলাদা (Hub-এ লগইন করলে এখানে
 * automatically লগইন হয়ে যাবে না, প্রতিটা App-এ আলাদা করে সাইন-ইন
 * করতে হবে, যেমনটা সিদ্ধান্ত হয়েছে)।
 *
 * signUp এ ইচ্ছাকৃতভাবে কোনো `role` লেখা হচ্ছে না (Hub-এর
 * useAuthStore.ts এর বিপরীতে, যেখানে role: 'engineer' লেখা হয়) —
 * কারণ src/lib/hub/permissions.ts অনুযায়ী এই App নিজে কোনো
 * permission তৈরি/এডিট করে না, Hub-ই একমাত্র source of truth
 * (project-level permissions অ্যারে থেকে role আসে)। এখানে শুধু
 * users/{uid} এ display name/email রাখা হচ্ছে যাতে ভবিষ্যতে (Project
 * List পেজে "কে বানিয়েছে" এই ধরনের তথ্য দেখাতে) কাজে লাগে।
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  initialized: false,

  initialize: () => {
    const unsub = onAuthStateChanged(auth(), (user) => {
      set({ user, initialized: true });
    });
    return unsub;
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      await signInWithEmailAndPassword(auth(), email.trim(), password);
      set({ loading: false });
      return true;
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      set({ loading: false, error: errorMessage(code) });
      return false;
    }
  },

  signUp: async (email, password, name) => {
    set({ loading: true, error: null });
    try {
      const cred = await createUserWithEmailAndPassword(auth(), email.trim(), password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db(), "users", cred.user.uid), {
        uid: cred.user.uid,
        email: email.trim(),
        displayName: name,
        createdAt: serverTimestamp(),
      });
      set({ loading: false });
      return true;
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      set({ loading: false, error: errorMessage(code) });
      return false;
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth());
    set({ user: null });
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      await sendPasswordResetEmail(auth(), email.trim());
      set({ loading: false });
      return true;
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      set({ loading: false, error: errorMessage(code) });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
