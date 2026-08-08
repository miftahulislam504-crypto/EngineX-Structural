"use client";

import { useState } from "react";
import { DOCUMENT_KEYS, DOCUMENT_REGISTRY, type DocumentKey } from "@/lib/documentation/documentRegistry";

/**
 * DocumentationPanel — Phase 11i
 *
 * GeneralNotesPanel.tsx এর প্যাটার্ন অনুসরণ করে (একই ফাইল-নেমিং, একই
 * styling convention — rounded-md bg-slate-900 বাটন, text-xs/text-[10px]
 * লেবেল)। প্রতিটা document এর জন্য একটা ডাউনলোড বাটন, DOCUMENT_REGISTRY
 * (route.tsx এ, single source of truth — label/description দুই জায়গায়
 * ডুপ্লিকেট না করতে) থেকে বানানো।
 *
 * ডাউনলোড mechanism — client-side fetch() → blob → temporary <a> click,
 * সরাসরি <a href="/api/..."> না কেন: (ক) loading/error state দেখাতে
 * (PDF জেনারেশন বড় প্রজেক্টে কয়েক সেকেন্ড লাগতে পারে — GeneralNotesPanel.tsx
 * এর isSaving spinner প্যাটার্নের সাথে সামঞ্জস্যপূর্ণ রাখতে), (খ) route এর
 * error JSON response (400/500) ধরে দেখানোর জন্য (plain <a> href এ error
 * response browser এ raw JSON/broken-PDF হিসেবে খুলে যেত, silent failure)।
 *
 * calc-sheets category filter — CalcSheetsDocument.tsx এর নিজস্ব comment
 * এই ঠিক ফিচারটা forward-reference করেছিল ("Phase 11i এর 'Beam only'
 * জাতীয় ফিল্টার UI") — checkbox গুলো দিয়ে বাস্তবায়ন করা হলো, কোনোটা
 * check না থাকলে সব category (route এর filterCategories=undefined
 * behavior এর সাথে মিলিয়ে)।
 *
 * wiring — এই panel component টা self-contained এবং standalone
 * ব্যবহারযোগ্য, কিন্তু page.tsx (App shell) এ এখনো যুক্ত করা হয়নি —
 * page.tsx/stageTabs.ts/workflow/types.ts এই আপলোডে সম্পূর্ণ নেই বলে
 * (শুধু আংশিক দেখা গেছে) নিরাপদে blind edit করা ঠিক হবে না। ঠিক কী
 * কী edit লাগবে তার বিস্তারিত এই ফোল্ডারের README.md এ লেখা আছে —
 * একজন পূর্ণ repo access থাকা developer/সেশন সেই instructions অনুসরণ
 * করে দুই মিনিটে wire করতে পারবেন।
 */

const CALC_SHEET_CATEGORIES: { value: string; label: string }[] = [
  { value: "beam", label: "RC Beam" },
  { value: "column", label: "RC Column" },
  { value: "steel-beam", label: "Steel Beam" },
  { value: "steel-column", label: "Steel Column" },
  { value: "slab", label: "RC Slab" },
  { value: "wall", label: "RC Wall" },
  { value: "footing", label: "Footing" },
  { value: "combined-footing", label: "Combined Footing" },
  { value: "strip-footing", label: "Strip Footing" },
  { value: "mat-foundation", label: "Mat Foundation" },
  { value: "pile-cap", label: "Pile Cap" },
];

function useDownload(documentKey: DocumentKey, projectId: string, extraQuery?: string) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const entry = DOCUMENT_REGISTRY[documentKey];

  async function handleDownload() {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const url = `/api/documentation/${projectId}/${documentKey}${extraQuery ? `?${extraQuery}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `${entry.label}.pdf`;

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Download failed");
      setStatus("error");
    }
  }

  return { status, errorMessage, handleDownload };
}

/** শুধু বাটন + error text — card chrome ছাড়া, calc-sheets এর মতো custom-card ক্ষেত্রে ব্যবহারের জন্য। */
function DownloadAction({ documentKey, projectId, extraQuery }: { documentKey: DocumentKey; projectId: string; extraQuery?: string }) {
  const { status, errorMessage, handleDownload } = useDownload(documentKey, projectId, extraQuery);
  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={status === "loading"}
        className="w-full rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 text-xs font-medium py-1.5 transition-colors"
      >
        {status === "loading" ? "Generating…" : "Download PDF"}
      </button>
      {status === "error" && errorMessage && (
        <p className="text-[10px] text-red-400 mt-1.5">{errorMessage}</p>
      )}
    </>
  );
}

/** পূর্ণ card (label + description + DownloadAction) — বেশিরভাগ document এর জন্য যথেষ্ট, কোনো extra filter UI দরকার হয় না। */
function DownloadButton({ documentKey, projectId }: { documentKey: DocumentKey; projectId: string }) {
  const entry = DOCUMENT_REGISTRY[documentKey];
  return (
    <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
      <p className="text-sm font-medium text-slate-200">{entry.label}</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-2">{entry.description}</p>
      <DownloadAction documentKey={documentKey} projectId={projectId} />
    </div>
  );
}

export function DocumentationPanel({ projectId }: { projectId: string }) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  function toggleCategory(value: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const calcSheetsQuery =
    selectedCategories.size > 0 ? `categories=${Array.from(selectedCategories).join(",")}` : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Documentation</h3>
        <p className="text-xs text-slate-500 mb-3">
          প্রতিটা document server-side জেনারেট হয় (project&apos;s current geometry/design/detailing/validation
          data থেকে) — জেনারেট করার সময় model-এ যা আছে তার একটা স্ন্যাপশট, তাই model বদলালে আবার ডাউনলোড
          করতে হবে সর্বশেষ ভার্সন পেতে।
        </p>
      </div>

      {DOCUMENT_KEYS.filter((k) => k !== "calc-sheets").map((key) => (
        <DownloadButton key={key} documentKey={key} projectId={projectId} />
      ))}

      <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
        <p className="text-sm font-medium text-slate-200">{DOCUMENT_REGISTRY["calc-sheets"].label}</p>
        <p className="text-xs text-slate-500 mt-0.5 mb-2">{DOCUMENT_REGISTRY["calc-sheets"].description}</p>

        <p className="text-[10px] text-slate-500 mb-1">Filter by category (none selected = all):</p>
        <div className="grid grid-cols-2 gap-1 mb-2">
          {CALC_SHEET_CATEGORIES.map((cat) => (
            <label key={cat.value} className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <input
                type="checkbox"
                checked={selectedCategories.has(cat.value)}
                onChange={() => toggleCategory(cat.value)}
                className="accent-sky-500"
              />
              {cat.label}
            </label>
          ))}
        </div>

        <DownloadAction documentKey="calc-sheets" projectId={projectId} extraQuery={calcSheetsQuery} />
      </div>
    </div>
  );
}
