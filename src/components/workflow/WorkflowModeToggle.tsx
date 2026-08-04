"use client";

interface WorkflowModeToggleProps {
  wizardMode: boolean;
  onChange: (wizardMode: boolean) => void;
}

/**
 * Wizard Mode ↔ Expert Mode সুইচ। top-left status bar এ বসে
 * (Project id badge এর পাশে) — ছোট, viewport এর উপরে overlay, তাই
 * কোনো নতুন layout space নেয় না।
 */
export function WorkflowModeToggle({ wizardMode, onChange }: WorkflowModeToggleProps) {
  return (
    <div className="flex items-center bg-slate-900/80 backdrop-blur rounded-md p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-2.5 py-1 rounded transition-colors ${
          wizardMode ? "bg-sky-700 text-white" : "text-slate-500 hover:text-slate-300"
        }`}
      >
        Wizard
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-2.5 py-1 rounded transition-colors ${
          !wizardMode ? "bg-sky-700 text-white" : "text-slate-500 hover:text-slate-300"
        }`}
      >
        Expert
      </button>
    </div>
  );
}
