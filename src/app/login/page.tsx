"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Boxes, Calculator, FileCheck2, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/lib/auth/useAuthStore";

type Mode = "login" | "register" | "reset";

const FEATURES: [typeof Boxes, string][] = [
  [Boxes, "Architectural মডেল থেকে Structural Member স্বয়ংক্রিয়ভাবে তৈরি"],
  [Calculator, "BNBC 2020 অনুযায়ী Load, Combination ও Design স্বয়ংক্রিয়ভাবে নির্ণয়"],
  [FileCheck2, "Analysis থেকে Design পর্যন্ত সম্পূর্ণ স্বয়ংক্রিয় পাইপলাইন"],
  [ShieldCheck, "Hub-এর সাথে সরাসরি সংযুক্ত প্রজেক্ট ডেটা"],
];

/**
 * Structural App-এর নিজস্ব Login পেজ (Phase 0.2)।
 *
 * Hub_com/app/login/page.tsx এর visual pattern অনুসরণ করা হয়েছে (বাম
 * পাশে ব্র্যান্ড প্যানেল ডেস্কটপে, ডান পাশে ফর্ম, মোবাইলে শুধু ফর্ম) —
 * কিন্তু bilingual toggle (useLang/t()) বাদ দেওয়া হয়েছে, কারণ এই App-এ
 * এখনো কোনো i18n system নেই (শুধু hardcoded বাংলা টেক্সট, Hub-এর মতো
 * পুরো translation framework আনা এই Phase-এর scope না)।
 *
 * এই App Hub-এর সাথে একই Firebase project শেয়ার করে (env vars একই),
 * তাই Hub-এ যে একাউন্ট আছে সেই email/password এখানেও কাজ করবে —
 * কিন্তু session আলাদা, তাই এখানে আলাদা করে সাইন-ইন করতে হবে।
 */
export default function LoginPage() {
  const router = useRouter();
  const { user, initialized, loading, error, signIn, signUp, resetPassword, clearError } =
    useAuthStore();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    // ইতিমধ্যে সাইন-ইন করা থাকলে Login পেজে থাকার দরকার নেই — সরাসরি
    // Project List (root "/", app/page.tsx দেখুন, Phase 0.3) এ পাঠানো
    // হচ্ছে।
    if (initialized && user) {
      router.replace("/");
    }
  }, [user, initialized, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (mode === "reset") {
      const ok = await resetPassword(email);
      if (ok) setResetSent(true);
      return;
    }

    const ok =
      mode === "login" ? await signIn(email, password) : await signUp(email, password, name);
    if (ok) router.replace("/");
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    clearError();
    setResetSent(false);
  };

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="spinner" aria-label="লোড হচ্ছে" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex">
      {/* বাম ব্র্যান্ড প্যানেল (শুধু ডেস্কটপে) */}
      <div className="hidden lg:flex flex-col items-center justify-center w-1/2 bg-brand-900 text-white px-12 relative">
        <div className="bg-white rounded-2xl w-24 h-24 flex items-center justify-center mb-6 p-2 shadow-xl">
          <Image
            src="/logo.png"
            alt="CivilOS"
            width={80}
            height={80}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="text-4xl font-bold mb-2">CivilOS Structural</h1>
        <p className="text-brand-200 text-center mb-10">
          Zero Manual Define — Structural Analysis &amp; Design
        </p>

        <div className="space-y-4 w-full max-w-sm">
          {FEATURES.map(([Icon, label]) => (
            <div key={label} className="flex items-center gap-3 text-brand-100">
              <Icon size={18} className="flex-shrink-0 text-white/70" />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ডান ফর্ম প্যানেল */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* মোবাইল হেডার */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="bg-white rounded-xl w-12 h-12 flex items-center justify-center shadow-md p-1.5 border border-surface-border">
              <Image src="/logo.png" alt="CivilOS" width={36} height={36} className="object-contain" />
            </div>
            <div>
              <div className="font-bold text-xl text-text-primary">CivilOS Structural</div>
              <div className="text-xs text-text-muted">Zero Manual Define Platform</div>
            </div>
          </div>

          <div className="card p-8">
            <h2 className="text-2xl font-bold text-text-primary mb-1">
              {mode === "login"
                ? "স্বাগতম"
                : mode === "register"
                  ? "নতুন একাউন্ট"
                  : "পাসওয়ার্ড রিসেট"}
            </h2>
            <p className="text-text-muted text-sm mb-6">
              {mode === "login"
                ? "আপনার প্রজেক্টে ফিরে যেতে সাইন-ইন করুন"
                : mode === "register"
                  ? "নতুন একাউন্ট তৈরি করুন"
                  : "ইমেইলে রিসেট লিংক পাঠানো হবে"}
            </p>

            {resetSent && (
              <div className="bg-status-activeBg border border-status-activeBorder text-status-activeText rounded-xl p-3 mb-4 text-sm">
                রিসেট লিংক পাঠানো হয়েছে, ইমেইল চেক করুন।
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    পূর্ণ নাম
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="আপনার নাম"
                    required
                    className="input-field"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  ইমেইল
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input-field"
                />
              </div>

              {mode !== "reset" && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    পাসওয়ার্ড
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="input-field pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                      aria-label={showPass ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === "login" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => switchMode("reset")}
                    className="text-sm text-brand-700 hover:underline"
                  >
                    পাসওয়ার্ড ভুলে গেছেন?
                  </button>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading && <Loader2 className="animate-spin" size={18} />}
                {mode === "login" ? "সাইন-ইন" : mode === "register" ? "একাউন্ট তৈরি করুন" : "রিসেট লিংক পাঠান"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-text-muted">
              {mode !== "login" ? (
                <>
                  একাউন্ট আছে?{" "}
                  <button
                    onClick={() => switchMode("login")}
                    className="text-brand-700 font-semibold hover:underline"
                  >
                    সাইন-ইন করুন
                  </button>
                </>
              ) : (
                <>
                  একাউন্ট নেই?{" "}
                  <button
                    onClick={() => switchMode("register")}
                    className="text-brand-700 font-semibold hover:underline"
                  >
                    একাউন্ট তৈরি করুন
                  </button>
                </>
              )}
            </div>

            {mode === "reset" && (
              <div className="mt-3 text-center">
                <button
                  onClick={() => switchMode("login")}
                  className="text-sm text-brand-700 hover:underline"
                >
                  সাইন-ইনে ফিরে যান
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
