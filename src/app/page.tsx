import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          CivilOS — Structural Analysis &amp; Design
        </h1>
        <p className="text-slate-400">
          Phase 0-4a সম্পূর্ণ: Hub Integration থেকে শুরু করে C++ FE
          Solver (Direct Stiffness Method, Linear Static Analysis)
          পর্যন্ত — একটা কাজ-করা structural analysis pipeline।
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/model/demo-project"
            className="inline-block rounded-md bg-slate-100 text-slate-950 px-5 py-2.5 font-medium hover:bg-white transition-colors"
          >
            Structural Model খুলুন →
          </Link>
          <Link
            href="/phase0-check"
            className="inline-block rounded-md border border-slate-700 text-slate-300 px-5 py-2.5 font-medium hover:bg-slate-900 transition-colors"
          >
            Phase 0 Check
          </Link>
        </div>
      </div>
    </main>
  );
}
