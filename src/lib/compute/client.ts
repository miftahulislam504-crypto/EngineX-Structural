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
  | "modal"
  | "buckling"
  | "pdelta"
  | "response-spectrum"
  | "nonlinear-static"
  | "pushover";
// নোট: "time-history" ইচ্ছাকৃতভাবে এই union থেকে বাদ দেওয়া হলো —
// backend (app/main.py) এই মুহূর্তে এই টাইপ সমর্থন করে না (501 Not
// Implemented দেবে), যোগ হলে এখানে ফিরিয়ে আনা হবে। "p-delta" এর বদলে
// "pdelta" (হাইফেনবিহীন) — backend এর analysis_type স্ট্রিং এর সাথে
// ঠিক মিলিয়ে (আগে এখানে "p-delta" লেখা ছিল যা backend কখনো accept
// করত না — 501 দিত, কিন্তু frontend UI এই analysis type চালানোর কোনো
// উপায়ই ছিল না বলে এই mismatch ধরা পড়েনি)।

export interface AnalysisJobRequest {
  projectId: string;
  analysisType: AnalysisType;
  modelPayload: Record<string, unknown>;
  /** analysisType="modal"/"buckling"/"response-spectrum" এর জন্য — কতগুলো mode চাই। */
  numModes?: number;
  /** analysisType="response-spectrum" এর জন্য আবশ্যক — BNBC 2020 সিসমিক জোন ('1'-'4')। */
  seismicZone?: string;
  /** analysisType="response-spectrum" এর জন্য আবশ্যক — BNBC 2020 site class ('SA'-'SE')। */
  siteClass?: string;
  /** analysisType="response-spectrum" এর জন্য — ground motion direction (0=X, 1=Y, 2=Z), ডিফল্ট 0। */
  directionDof?: number;
  /** analysisType="response-spectrum" এর জন্য — modal damping ratio, ডিফল্ট 0.05। */
  dampingRatio?: number;
  /** analysisType="nonlinear-static" এর জন্য — সম্পূর্ণ load কে কতগুলো increment এ ভাগ করা হবে, ডিফল্ট 10। */
  numLoadSteps?: number;
  /** analysisType="nonlinear-static"/"pushover" এর জন্য — প্রতিটা load/push step এ সর্বোচ্চ Newton-Raphson iteration, ডিফল্ট 30। */
  maxIterationsPerStep?: number;
  /** analysisType="nonlinear-static"/"pushover" এর জন্য — convergence tolerance, ডিফল্ট 1e-4। */
  convergenceTolerance?: number;
  /** analysisType="pushover" এর জন্য আবশ্যক — control point এর x/y/z coordinate (মিটার), capacity curve এর displacement অক্ষ যেখান থেকে পড়া হবে। */
  controlPointX?: number;
  controlPointY?: number;
  controlPointZ?: number;
  /** analysisType="pushover" এর জন্য — push direction এর translational DOF (0=X, 1=Y, 2=Z), ডিফল্ট 2। */
  controlDof?: number;
  /** analysisType="pushover" এর জন্য আবশ্যক — control point এর target displacement (মিটার, magnitude)। */
  targetControlDisplacementM?: number;
  /** analysisType="pushover" এর জন্য — প্রতিটা push step এ load pattern কতটুকু বাড়বে (0-1 fraction), ডিফল্ট 0.02। */
  loadStepIncrement?: number;
  /** analysisType="pushover" এর জন্য — সর্বোচ্চ push step সংখ্যা, ডিফল্ট 200। */
  maxPushSteps?: number;
  /**
   * Phase 5 — hardcoded "base = fixed" (Y≈0) heuristic override করার
   * ঐচ্ছিক input। না দিলে backend এর পুরনো heuristic অপরিবর্তিতভাবে
   * চলবে (backward compatible)। coordinate-ভিত্তিক ম্যাচিং —
   * (x,y,z) কোনো element endpoint এর সাথে না মিললে সেই entry backend
   * এ warning দিয়ে বাদ যায়, silent ignore হয় না।
   */
  supportOverrides?: SupportOverride[];
}

export type SupportType = "fixed" | "pinned" | "free" | "custom";

export interface SupportOverride {
  x: number;
  y: number;
  z: number;
  supportType: SupportType;
  /** শুধু supportType="custom" হলে পড়া হয় — নাহলে ignore, fixed/pinned/free এর DOF মান backend নিজেই নির্ধারণ করে। */
  restrainX?: boolean;
  restrainY?: boolean;
  restrainZ?: boolean;
  restrainRx?: boolean;
  restrainRy?: boolean;
  restrainRz?: boolean;
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
      ...(request.numModes !== undefined && { num_modes: request.numModes }),
      ...(request.seismicZone !== undefined && { seismic_zone: request.seismicZone }),
      ...(request.siteClass !== undefined && { site_class: request.siteClass }),
      ...(request.directionDof !== undefined && { direction_dof: request.directionDof }),
      ...(request.dampingRatio !== undefined && { damping_ratio: request.dampingRatio }),
      ...(request.numLoadSteps !== undefined && { num_load_steps: request.numLoadSteps }),
      ...(request.maxIterationsPerStep !== undefined && { max_iterations_per_step: request.maxIterationsPerStep }),
      ...(request.convergenceTolerance !== undefined && { convergence_tolerance: request.convergenceTolerance }),
      ...(request.controlPointX !== undefined && { control_point_x: request.controlPointX }),
      ...(request.controlPointY !== undefined && { control_point_y: request.controlPointY }),
      ...(request.controlPointZ !== undefined && { control_point_z: request.controlPointZ }),
      ...(request.controlDof !== undefined && { control_dof: request.controlDof }),
      ...(request.targetControlDisplacementM !== undefined && {
        target_control_displacement_m: request.targetControlDisplacementM,
      }),
      ...(request.loadStepIncrement !== undefined && { load_step_increment: request.loadStepIncrement }),
      ...(request.maxPushSteps !== undefined && { max_push_steps: request.maxPushSteps }),
      ...(request.supportOverrides !== undefined && { support_overrides: request.supportOverrides }),
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
