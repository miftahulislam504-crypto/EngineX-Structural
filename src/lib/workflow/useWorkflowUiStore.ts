import { create } from "zustand";
import type { StageId } from "@/lib/workflow/types";

interface WorkflowUiState {
  /** true হলে page.tsx বাম পাশে WorkflowSidebar দেখাবে (existing tab sidebar এর বদলে না, তার উপরে/আগে)। */
  wizardMode: boolean;
  activeStage: StageId;
  setWizardMode: (on: boolean) => void;
  setActiveStage: (stage: StageId) => void;
}

/**
 * এই store শুধু UI state (কোনো Firestore persistence না) — session
 * শেষ হলে রিসেট হয়ে যাওয়াই ঠিক আছে, কারণ "wizard মোডে ছিলাম না
 * expert মোডে" এটা persist করার মতো গুরুত্বপূর্ণ কিছু না। ডিফল্ট
 * wizardMode=true যাতে নতুন ইঞ্জিনিয়ার প্রথমবার guided flow দেখেন;
 * অভিজ্ঞ ইউজার এক ক্লিকে Expert Mode এ সুইচ করতে পারবেন (flat tabs,
 * আগের মতোই)।
 */
export const useWorkflowUiStore = create<WorkflowUiState>((set) => ({
  wizardMode: true,
  activeStage: "preliminary",
  setWizardMode: (wizardMode) => set({ wizardMode }),
  setActiveStage: (activeStage) => set({ activeStage }),
}));
