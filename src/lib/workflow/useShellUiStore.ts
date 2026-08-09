import { create } from "zustand";

interface ShellUiState {
  /**
   * মোবাইলে বাম-পাশের main navigation drawer (Sidebar.tsx) খোলা আছে
   * কিনা। top bar এর ☰ বাটনে খোলে, ভেতরের ✕ বাটন বা backdrop ক্লিকে
   * বন্ধ হয়।
   */
  mobileSidebarOpen: boolean;
  /**
   * মোবাইলে ডান-পাশের panel content sheet (viewport controls, form,
   * ইত্যাদি — যেটা desktop এ permanent aside হিসেবে থাকে) খোলা আছে
   * কিনা। ⚙ ফ্লোটিং বাটনে, Sidebar এ tab select করলে, বা Workflow
   * stage select করলে auto-open হয়।
   */
  mobilePanelOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  setMobilePanelOpen: (open: boolean) => void;
}

/**
 * Phase 4 (Panel Migration) — এই store নতুন।
 *
 * আগে mobilePanelOpen/mobileSidebarOpen page.tsx এর ভেতরে local
 * useState ছিল, কারণ Sidebar/WorkflowSidebar ও panel content — দুটোই
 * একই component এর ভেতরে ছিল, prop pass করার দরকার হতো না।
 *
 * Phase 4-এ Sidebar/WorkflowSidebar layout.tsx-এ সরে যাচ্ছে (persistent
 * shell, route change এ remount হবে না), কিন্তু এই দুই বুলিয়ান
 * open/close হয় দুই জায়গা থেকেই — layout-level ট্রিগার (Sidebar এ tab
 * ক্লিক, WorkflowSidebar এ stage সিলেক্ট) আর page-level ট্রিগার (প্রতিটা
 * route page এর নিজস্ব ⚙ ফ্লোটিং বাটন, sheet এর ভেতরের ✕)। তাই এটা আর
 * কোনো একটা single component এর local state হতে পারে না — ঠিক
 * useWorkflowUiStore.workflowPanelOpen যে একই সমস্যার সমাধান করেছিল,
 * সেই একই প্যাটার্নে এই ছোট sibling store।
 *
 * useWorkflowUiStore এ যোগ না করে আলাদা ফাইলে রাখা হলো কারণ ওটা
 * নির্দিষ্টভাবে workflow-wizard state (activeStage, workflowPanelOpen)
 * ধরে রাখে — এই দুটো সাধারণ shell-chrome state (কোনো workflow-নির্দিষ্ট
 * অর্থ নেই), আলাদা concern।
 */
export const useShellUiStore = create<ShellUiState>((set) => ({
  mobileSidebarOpen: false,
  mobilePanelOpen: false,
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
  setMobilePanelOpen: (mobilePanelOpen) => set({ mobilePanelOpen }),
}));
