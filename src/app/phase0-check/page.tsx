"use client";

import { useState } from "react";
import { checkComputeHealth } from "@/lib/compute/client";
import { auth } from "@/lib/firebase/client";

type CheckStatus = "idle" | "running" | "success" | "error";

interface CheckResult {
  status: CheckStatus;
  message: string;
}

/**
 * Phase 0 Diagnostic Page
 *
 * Deploy করার পরপরই এই পেজে গিয়ে দুটো জিনিস যাচাই করা যায়:
 *  1. Firebase config ঠিকভাবে লোড হচ্ছে কিনা (env vars সঠিক আছে কিনা)
 *  2. Cloud Run compute service-এর সাথে যোগাযোগ হচ্ছে কিনা
 *
 * এই পেজটা স্থায়ী প্রোডাক্ট ফিচার না — এটা শুধু Phase 0 এর
 * ইনফ্রাস্ট্রাকচার sanity check। পরে সরিয়ে ফেলা যাবে বা
 * /admin/diagnostics এর মতো জায়গায় সরানো যাবে।
 */
export default function Phase0CheckPage() {
  const [firebaseCheck, setFirebaseCheck] = useState<CheckResult>({
    status: "idle",
    message: "চাপুন যাচাই করতে",
  });
  const [computeCheck, setComputeCheck] = useState<CheckResult>({
    status: "idle",
    message: "চাপুন যাচাই করতে",
  });

  async function checkFirebase() {
    setFirebaseCheck({ status: "running", message: "যাচাই হচ্ছে..." });
    try {
      // Firebase app initialize হয়েছে কিনা এবং config-এ projectId আছে
      // কিনা চেক করাই যথেষ্ট — এই মুহূর্তে কোনো actual sign-in ছাড়াই
      // বোঝা যায় config সঠিক কিনা।
      const app = auth().app;
      const projectId = app.options.projectId;

      if (!projectId) {
        throw new Error(
          "projectId খালি — NEXT_PUBLIC_FIREBASE_PROJECT_ID env var সেট করা হয়নি।"
        );
      }

      setFirebaseCheck({
        status: "success",
        message: `Firebase App সঠিকভাবে initialize হয়েছে। Project ID: ${projectId}`,
      });
    } catch (err) {
      setFirebaseCheck({
        status: "error",
        message: err instanceof Error ? err.message : "অজানা এরর",
      });
    }
  }

  async function checkCompute() {
    setComputeCheck({ status: "running", message: "Cloud Run-এ স্বাস্থ্য পরীক্ষা পাঠানো হচ্ছে..." });
    try {
      const result = await checkComputeHealth();
      setComputeCheck({
        status: "success",
        message: `Cloud Run থেকে সাড়া পাওয়া গেছে। status: ${result.status}, service: ${result.service}`,
      });
    } catch (err) {
      setComputeCheck({
        status: "error",
        message: err instanceof Error ? err.message : "অজানা এরর",
      });
    }
  }

  return (
    <main className="min-h-screen bg-surface text-text-primary p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Phase 0 — Infrastructure Check</h1>
          <p className="text-text-secondary mt-1">
            Hub integration foundation যাচাই: Firebase config ও Cloud Run
            যোগাযোগ ঠিক আছে কিনা।
          </p>
        </div>

        <CheckCard
          title="Firebase Connection"
          result={firebaseCheck}
          onCheck={checkFirebase}
        />

        <CheckCard
          title="Cloud Run Compute Service"
          result={computeCheck}
          onCheck={checkCompute}
        />
      </div>
    </main>
  );
}

function CheckCard({
  title,
  result,
  onCheck,
}: {
  title: string;
  result: CheckResult;
  onCheck: () => void;
}) {
  const statusColor: Record<CheckStatus, string> = {
    idle: "bg-surface-hover text-text-secondary",
    running: "bg-status-holdBg text-status-holdText",
    success: "bg-status-activeBg text-status-activeText",
    error: "bg-red-50 text-red-600",
  };

  return (
    <div className="rounded-lg border border-surface-border p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        <button
          onClick={onCheck}
          disabled={result.status === "running"}
          className="text-sm px-3 py-1.5 rounded-md bg-surface-hover hover:bg-surface-border disabled:opacity-50 transition-colors"
        >
          যাচাই করুন
        </button>
      </div>
      <div className={`text-sm rounded-md px-3 py-2 ${statusColor[result.status]}`}>
        {result.message}
      </div>
    </div>
  );
}
