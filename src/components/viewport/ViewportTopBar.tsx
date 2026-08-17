"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * ViewportTopBar — Redesign (২০২৬-০৮)।
 *
 * Analysis/Visualization/Detailing ট্যাবের জন্য ব্যবহারকারীর স্পষ্ট
 * নির্দেশ: viewport-এর উপরে ভাসমান overlay card বাদ দিয়ে, viewport-এর
 * উপরে একটা horizontal option bar বসবে, তার ঠিক নিচে ফুল-উইথ 2D/3D
 * viewport (কোনো floating card না)। এই ৩টা tab-এ অপশন সংখ্যা কম বলে
 * (Elements-এর ৭+ element-form-এর তুলনায়) পুরো bar-টাই সবসময় দৃশ্যমান
 * থাকে, কোনো ⚙ বাটনে লুকানো sheet লাগে না।
 *
 * প্রতিটা section একটা বাটন — ক্লিক করলে bar-এর ঠিক নিচে একটা popup
 * dropdown খোলে (bar নিজে ছোট/পরিষ্কার থাকে, কিন্তু ভেতরের content
 * যত জটিলই হোক — টগল/স্লাইডার/টেবিল — popup-এ পুরোটা ফিট করে, viewport
 * কে ঢেকে রাখে না কারণ popup absolute positioned, viewport এর height
 * কমায় না)।
 *
 * একবারে একটাই dropdown খোলা থাকে (activeId state) — দুটো popup
 * একসাথে খোলা থাকলে ছোট স্ক্রিনে একটা আরেকটাকে ঢেকে ফেলত।
 *
 * বাইরে ক্লিক করলে বন্ধ হয় (mousedown listener, document-level) —
 * প্রতিটা ব্যবহারকারীর পরিচিত dropdown আচরণ।
 */

export interface ViewportTopBarItem {
  id: string;
  label: string;
  /** dropdown-এর ভেতরের content। */
  content: React.ReactNode;
  /** ঐচ্ছিক — বাটনে label-এর পাশে একটা ছোট বাজ/কাউন্ট চিপ (যেমন সক্রিয় hinge সংখ্যা)। */
  badge?: string | number;
  /** true হলে বাটন highlighted দেখায় (যেমন কোনো toggle এই section-এ চালু আছে)। */
  active?: boolean;
  /** true হলে popup dropdown প্রশস্ত হয় (w-80 এর বদলে w-96) — যেসব section এ টেবিল/চার্ট থাকে (যেমন Analysis Results) তাদের জন্য। */
  wide?: boolean;
}

interface ViewportTopBarProps {
  items: ViewportTopBarItem[];
  /** ডান পাশে অতিরিক্ত কিছু (যেমন 2D/3D টগল) — ঐচ্ছিক। */
  trailing?: React.ReactNode;
}

export function ViewportTopBar({ items, trailing }: ViewportTopBarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative z-20 flex items-center gap-1.5 border-b border-surface-border bg-surface-card px-3 py-2 overflow-x-auto flex-shrink-0"
    >
      {items.map((item) => {
        const isOpen = activeId === item.id;
        return (
          <div key={item.id} className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setActiveId(isOpen ? null : item.id)}
              className={`flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isOpen || item.active
                  ? "bg-brand-600 text-white"
                  : "bg-surface text-text-secondary border border-surface-border hover:text-text-primary hover:border-brand-300"
              }`}
            >
              {item.label}
              {item.badge !== undefined && item.badge !== "" && (
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    isOpen || item.active ? "bg-white/20" : "bg-surface-hover"
                  }`}
                >
                  {item.badge}
                </span>
              )}
              <ChevronDown
                size={12}
                className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div
                className={`absolute left-0 top-[calc(100%+6px)] ${
                  item.wide ? "w-96" : "w-80"
                } max-h-[70vh] overflow-y-auto rounded-xl border border-surface-border bg-surface-card shadow-card p-4`}
              >
                {item.content}
              </div>
            )}
          </div>
        );
      })}

      {trailing && <div className="ml-auto flex-shrink-0 flex items-center gap-1.5">{trailing}</div>}
    </div>
  );
}
