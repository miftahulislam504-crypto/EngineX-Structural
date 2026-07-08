/**
 * Cloud Run Compute Microservice Client
 *
 * Next.js থেকে Cloud Run-এ deploy হওয়া সলভার সার্ভিসে জব পাঠায় এবং
 * ফলাফল poll করে। এই ফাইলটা server-side (API route/server action)
 * এবং client-side দুই জায়গা থেকেই কল করা যায়, কিন্তু ভারী payload
 * বা দীর্ঘ polling এর জন্য server-side (API route) ব্যবহার করাই ভালো।
 */

export type AnalysisType =
  | "linear-static"
  | "nonlinear-static"
  | "modal"
  | "response-spectrum"
  | "time-history"
  | "p-delta"
  | "buckling"
  | "pushover";

export interface AnalysisJobRequest {
  projectId: string;
  analysisType: AnalysisType;
  modelPayload: Record<string, unknown>;
}

export interface AnalysisJobResponse {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  submittedAt: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  submittedAt: string;
  completedAt: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
}

function getComputeBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_COMPUTE_SERVICE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_COMPUTE_SERVICE_URL is not set. Vercel env var-এ Cloud Run URL বসান।"
    );
  }
  return url.replace(/\/$/, ""); // trailing slash সরিয়ে দেয়
}

/**
 * একটা analysis job সাবমিট করে। Phase 0-তে সার্ভিস সাথে সাথেই
 * "completed" স্ট্যাটাসসহ একটা placeholder ফলাফল দেয় (Phase 4-এ
 * আসল async solver বসলে queued/running স্টেট বাস্তবিক হয়ে উঠবে)।
 */
export async function submitAnalysisJob(
  request: AnalysisJobRequest
): Promise<AnalysisJobResponse> {
  const baseUrl = getComputeBaseUrl();

  const response = await fetch(`${baseUrl}/jobs/analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: request.projectId,
      analysis_type: request.analysisType,
      model_payload: request.modelPayload,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Job submission failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    jobId: data.job_id,
    status: data.status,
    submittedAt: data.submitted_at,
  };
}

/**
 * একটা জবের বর্তমান স্ট্যাটাস আনে।
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const baseUrl = getComputeBaseUrl();

  const response = await fetch(`${baseUrl}/jobs/${jobId}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch job status (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    jobId: data.job_id,
    status: data.status,
    submittedAt: data.submitted_at,
    completedAt: data.completed_at,
    result: data.result,
    error: data.error,
  };
}

/**
 * job সাবমিট করে এবং completed/failed না হওয়া পর্যন্ত poll করে।
 * Phase 0-তে জব সাথে সাথেই completed হয়ে যায় বলে এটা প্রথম poll-এই
 * রিটার্ন করবে। Phase 4-এ আসল async solver বসলে এই polling loop-টাই
 * প্রকৃত কাজে লাগবে।
 */
export async function submitAndAwaitJob(
  request: AnalysisJobRequest,
  options: { pollIntervalMs?: number; timeoutMs?: number } = {}
): Promise<JobStatusResponse> {
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 60000;

  const submitted = await submitAnalysisJob(request);
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const status = await getJobStatus(submitted.jobId);
    if (status.status === "completed" || status.status === "failed") {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Job ${submitted.jobId} timed out after ${timeoutMs}ms`);
}
