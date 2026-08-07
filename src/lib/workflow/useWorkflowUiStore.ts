import { create } from "zustand";
import type { StageId } from "@/lib/workflow/types";

interface WorkflowUiState {
  /** true হলে WorkflowSidebar (guided stage panel) খোলা থাকে — Phase 0.5 থেকে on-demand (নতুন Sidebar.tsx এর "Workflow" আইটেমে ক্লিক করলে খোলে, ❌ বাটনে বন্ধ হয়), আগের মতো সবসময়-visible permanent wizard mode না। */
  workflowPanelOpen: boolean;
  activeStage: StageId;
  setWorkflowPanelOpen: (open: boolean) => void;
  setActiveStage: (stage: StageId) => void;
}

/**
 * এই store শুধু UI state (কোনো Firestore persistence না) — session
 * শেষ হলে রিসেট হয়ে যাওয়াই ঠিক আছে।
 *
 * Phase 0.5 এ wizardMode (boolean, ডিফল্ট true, permanent-visible
 * sidebar) থেকে workflowPanelOpen (ডিফল্ট false, on-demand panel) এ
 * পরিবর্তিত হয়েছে — নতুন vertical Sidebar এ এখন "Workflow" একটা
 * সাধারণ item, ক্লিক করলে এই panel খোলে, ❌ তে বন্ধ হয়। আগের
 * Expert/Wizard mode dichotomy আর দরকার নেই কারণ main navigation এখন
 * সবসময় flat sidebar (আগে wizardMode=false অবস্থাতেই যা দেখাত)।
 */
export const useWorkflowUiStore = create<WorkflowUiState>((set) => ({
  workflowPanelOpen: false,
  activeStage: "preliminary",
  setWorkflowPanelOpen: (workflowPanelOpen) => set({ workflowPanelOpen }),
  setActiveStage: (activeStage) => set({ activeStage }),
}));
