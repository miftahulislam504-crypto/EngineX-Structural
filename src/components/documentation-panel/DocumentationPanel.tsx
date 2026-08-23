"use client";

import { useCallback, useState } from "react";
import { DOCUMENT_KEYS, DOCUMENT_REGISTRY, type DocumentKey } from "@/lib/documentation/documentRegistry";
import { fetchAllElements } from "@/lib/elements/firestore";
import { fetchLatestSuccessfulAnalysisRun } from "@/lib/analysis/firestore";
import type { StructuralElement } from "@/lib/types/element";
import type { AnalysisNode } from "@/lib/analysis/runAnalysis";
import { DeformedShapeSnapshotCanvas } from "@/components/viewport/DeformedShapeSnapshotCanvas";
import type { NodeTranslation } from "@/lib/viewport/nodeDisplacementLookup";

/**
 * DocumentationPanel — Phase 11i
 *
 * GeneralNotesPanel.tsx এর প্যাটার্ন অনুসরণ করে (একই ফাইল-নেমিং, একই
 * styling convention — rounded-md bg-surface-card বাটন, text-xs/text-[10px]
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
 * wiring — এই panel component টা self-contained, page.tsx এর
 * activeTab === "documentation" && activeDocumentationSubTab ===
 * "reports-export" ব্লকে <DocumentationPanel projectId={projectId} />
 * হিসেবে wired (দেখুন app/model/[projectId]/documentation/page.tsx,
 * Phase 4 এর Panel Migration এ যেখানে সরানো হয়েছে) — উপরের অনুচ্ছেদ
 * আগে বলত এই wiring বাকি আছে (তখন page.tsx/stageTabs.ts আংশিক দেখা
 * যাচ্ছিল বলে blind edit এড়ানো হয়েছিল), কিন্তু সেই wiring ইতিমধ্যে
 * সম্পন্ন হয়ে গেছে — এই paragraph টা এখন শুধু সেই ইতিহাস হিসেবে
 * রাখা হলো, বর্তমান আচরণ বোঝাতে না (নিচের route.tsx এর সাথে
 * DOCUMENT_REGISTRY শেয়ার করাটাই এখন single source of truth, আলাদা
 * README আর নেই)।
 *
 * Design Report + Deformed Shape snapshot (Report-Audit Phase A4,
 * 2026-08-20) — বাকি ৫টা document GET দিয়েই ডাউনলোড হয় (useDownload,
 * অপরিবর্তিত), কিন্তু "design-report" এখন DesignReportDownloadButton
 * (নিচে) দিয়ে ডাউনলোড হয়, যেটা ক্লিকের পর প্রথমে Firestore থেকে latest
 * analysis run + elements টেনে (server-এর buildReportContext() একই
 * ডেটা সোর্স ব্যবহার করে বলে consistency থাকে), একটা offscreen
 * DeformedShapeSnapshotCanvas mount করে snapshot নেয়, POST body তে
 * base64 PNG পাঠায়। কোনো ধাপ ব্যর্থ হলে (analysis নেই, RSA magnitude-
 * only, elements ফাঁকা, canvas capture ব্যর্থ) snapshot ছাড়াই (null)
 * POST হয় — PDF তখনও generate হয়, শুধু Section F এ honest "not
 * available" নোট দেখাবে (ব্লক করা হয় না, দেখুন SectionF এর কমেন্ট)।
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

function triggerBlobDownload(blob: Blob, disposition: string, fallbackFilename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackFilename;

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

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
      triggerBlobDownload(blob, res.headers.get("Content-Disposition") ?? "", `${entry.label}.pdf`);
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
        className="w-full rounded-md bg-surface-hover hover:bg-surface-border disabled:opacity-60 text-text-primary text-xs font-medium py-1.5 transition-colors"
      >
        {status === "loading" ? "Generating…" : "Download PDF"}
      </button>
      {status === "error" && errorMessage && (
        <p className="text-[10px] text-red-600 mt-1.5">{errorMessage}</p>
      )}
    </>
  );
}

/** পূর্ণ card (label + description + DownloadAction) — বেশিরভাগ document এর জন্য যথেষ্ট, কোনো extra filter UI দরকার হয় না। */
function DownloadButton({ documentKey, projectId }: { documentKey: DocumentKey; projectId: string }) {
  const entry = DOCUMENT_REGISTRY[documentKey];
  return (
    <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
      <p className="text-sm font-medium text-text-primary">{entry.label}</p>
      <p className="text-xs text-text-muted mt-0.5 mb-2">{entry.description}</p>
      <DownloadAction documentKey={documentKey} projectId={projectId} />
    </div>
  );
}

/**
 * activeAnalysisType অনুযায়ী nodalDisplacements বের করা —
 * VisualizationViewport.tsx এর activeNodalDisplacements logic এর সাথে
 * consistent (একই honest সীমাবদ্ধতা): RSA displacementIsMagnitudeOnly
 * হলে deform করা হয় না (CQC combination sign হারায়, deform করলে ভুল
 * দিকে সরে যাবে)। Modal/Buckling/Pushover বাদ — ওদের displacement মূল
 * static equilibrium displacement না (mode shape/hinge state, ভিন্ন
 * অর্থ), এই snapshot এর "deformed shape under load" ধারণার সাথে খাপ
 * খায় না।
 */
function extractNodalDisplacements(
  run: Awaited<ReturnType<typeof fetchLatestSuccessfulAnalysisRun>>
): NodeTranslation[] | null {
  if (!run) return null;
  const entry = run.results.find((r) => r.runType === run.run.runType);
  if (!entry) return null;

  switch (entry.runType) {
    case "linear-static":
    case "pdelta":
    case "nonlinear-static":
      return entry.nodalDisplacements ?? null;
    case "response-spectrum":
      return entry.displacementIsMagnitudeOnly ? null : entry.nodalDisplacements ?? null;
    default:
      return null; // modal/buckling/pushover — deform এর জন্য প্রযোজ্য না
  }
}

function extractNodes(
  run: Awaited<ReturnType<typeof fetchLatestSuccessfulAnalysisRun>>
): AnalysisNode[] | null {
  if (!run) return null;
  const entry = run.results.find((r) => r.runType === run.run.runType);
  return entry && "nodes" in entry ? entry.nodes ?? null : null;
}

/** design-report এর জন্য বিশেষ ডাউনলোড বাটন — snapshot capture pipeline সহ (উপরের ফাইল-হেড কমেন্টে rationale)। */
function DesignReportDownloadButton({ projectId }: { projectId: string }) {
  const entry = DOCUMENT_REGISTRY["design-report"];
  const [status, setStatus] = useState<"idle" | "preparing" | "capturing" | "generating" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshotTarget, setSnapshotTarget] = useState<{
    elements: StructuralElement[];
    nodes: AnalysisNode[];
    nodalDisplacements: NodeTranslation[];
  } | null>(null);

  const postWithSnapshot = useCallback(
    async (dataUrl: string | null) => {
      setSnapshotTarget(null); // canvas unmount — capture শেষ, আর দরকার নেই
      setStatus("generating");
      try {
        const res = await fetch(`/api/documentation/${projectId}/design-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deformedShapeSnapshotDataUrl: dataUrl }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        const blob = await res.blob();
        triggerBlobDownload(blob, res.headers.get("Content-Disposition") ?? "", `${entry.label}.pdf`);
        setStatus("idle");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Download failed");
        setStatus("error");
      }
    },
    [projectId, entry.label]
  );

  async function handleDownload() {
    setStatus("preparing");
    setErrorMessage(null);
    try {
      const [elements, run] = await Promise.all([
        fetchAllElements(projectId),
        fetchLatestSuccessfulAnalysisRun(projectId),
      ]);
      const nodalDisplacements = extractNodalDisplacements(run);
      const nodes = extractNodes(run);

      if (elements.length === 0 || !nodes || !nodalDisplacements || nodalDisplacements.length === 0) {
        // Snapshot এর জন্য দরকারি ডেটা নেই (মডেল খালি, analysis চালানো
        // হয়নি, বা RSA magnitude-only) — snapshot বাদ দিয়ে সরাসরি PDF
        // generate করা হচ্ছে, ডাউনলোড ব্লক করা হচ্ছে না।
        await postWithSnapshot(null);
        return;
      }

      setStatus("capturing");
      setSnapshotTarget({ elements, nodes, nodalDisplacements });
      // DeformedShapeSnapshotCanvas mount হয়ে onCaptured() কল করলে
      // postWithSnapshot() চলবে (নিচের JSX দেখুন) — এখানে আর কিছু করার
      // নেই, capture asynchronous (কয়েক rAF frame পরে callback আসবে)।
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Download failed");
      setStatus("error");
    }
  }

  const isBusy = status === "preparing" || status === "capturing" || status === "generating";
  const label =
    status === "preparing"
      ? "Preparing…"
      : status === "capturing"
        ? "Capturing deformed shape…"
        : status === "generating"
          ? "Generating…"
          : "Download PDF";

  return (
    <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
      <p className="text-sm font-medium text-text-primary">{entry.label}</p>
      <p className="text-xs text-text-muted mt-0.5 mb-2">{entry.description}</p>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isBusy}
        className="w-full rounded-md bg-surface-hover hover:bg-surface-border disabled:opacity-60 text-text-primary text-xs font-medium py-1.5 transition-colors"
      >
        {label}
      </button>
      {status === "error" && errorMessage && (
        <p className="text-[10px] text-red-600 mt-1.5">{errorMessage}</p>
      )}
      {snapshotTarget && (
        <DeformedShapeSnapshotCanvas
          elements={snapshotTarget.elements}
          nodes={snapshotTarget.nodes}
          nodalDisplacements={snapshotTarget.nodalDisplacements}
          deformationScale={50} // VisualizationViewport এর ডিফল্ট deformationScale এর সাথে সামঞ্জস্যপূর্ণ (useVisualizationViewStore.ts) — বাস্তব displacement মিলিমিটার-স্কেল, amplify ছাড়া দৃশ্যমান হয় না
          onCaptured={postWithSnapshot}
        />
      )}
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
        <h3 className="text-sm font-medium text-text-primary mb-1">Documentation</h3>
        <p className="text-xs text-text-muted mb-3">
          প্রতিটা document server-side জেনারেট হয় (project&apos;s current geometry/design/detailing/validation
          data থেকে) — জেনারেট করার সময় model-এ যা আছে তার একটা স্ন্যাপশট, তাই model বদলালে আবার ডাউনলোড
          করতে হবে সর্বশেষ ভার্সন পেতে।
        </p>
      </div>

      <DesignReportDownloadButton projectId={projectId} />

      {DOCUMENT_KEYS.filter((k) => k !== "calc-sheets" && k !== "design-report").map((key) => (
        <DownloadButton key={key} documentKey={key} projectId={projectId} />
      ))}

      <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
        <p className="text-sm font-medium text-text-primary">{DOCUMENT_REGISTRY["calc-sheets"].label}</p>
        <p className="text-xs text-text-muted mt-0.5 mb-2">{DOCUMENT_REGISTRY["calc-sheets"].description}</p>

        <p className="text-[10px] text-text-muted mb-1">Filter by category (none selected = all):</p>
        <div className="grid grid-cols-2 gap-1 mb-2">
          {CALC_SHEET_CATEGORIES.map((cat) => (
            <label key={cat.value} className="flex items-center gap-1.5 text-[10px] text-text-secondary">
              <input
                type="checkbox"
                checked={selectedCategories.has(cat.value)}
                onChange={() => toggleCategory(cat.value)}
                className="accent-brand-600"
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
