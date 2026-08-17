"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * ViewportTopBar — Redesign (২০২৬-০৮; বাগফিক্স ২০২৬-০৮ পরবর্তী)।
 *
 * Analysis/Visualization/Detailing ট্যাবের জন্য ব্যবহারকারীর স্পষ্ট
 * নির্দেশ: viewport-এর উপরে ভাসমান overlay card বাদ দিয়ে, viewport-এর
 * উপরে একটা horizontal option bar বসবে, তার ঠিক নিচে ফুল-উইথ 2D/3D
 * viewport (কোনো floating card না)। এই ৩টা tab-এ অপশন সংখ্যা কম বলে
 * (Elements-এর ৭+ element-form-এর তুলনায়) পুরো bar-টাই সবসময় দৃশ্যমান
 * থাকে, কোনো ⚙ বাটনে লুকানো sheet লাগে না।
 *
 * প্রতিটা section একটা বাটন — ক্লিক করলে popup dropdown খোলে।
 *
 * বাগফিক্স — popup আগে বাটনের `position: relative` parent-এর ভেতরে
 * `position: absolute` দিয়ে বসানো ছিল, কিন্তু সেই parent bar
 * `overflow-x-auto` (horizontal scroll করার জন্য) — CSS spec অনুযায়ী
 * একটা axis-এ explicit overflow (auto/scroll/hidden) সেট করলে অন্য
 * axis টাও implicitly clip হয়ে যায় (browser টা কে effectively
 * `overflow-y: hidden` ধরে নেয়)। ফলে popup bar-এর bounding box এর
 * বাইরে বেরোতে পারত না — dropdown viewport-এর ভেতরে "ঢুকে"/কাটা
 * অবস্থায় আটকে থাকত (ব্যবহারকারীর রিপোর্ট করা bug)।
 *
 * সমাধান — popup কে আর bar-এর ভেতরে না রেখে `position: fixed` দিয়ে
 * document-level এ বসানো হয়েছে (bar এর overflow container সম্পূর্ণ
 * এড়িয়ে) — বাটনের `getBoundingClientRect()` থেকে স্ক্রিন-কোঅর্ডিনেট
 * হিসাব করে popup কে ঠিক বাটনের নিচে বসানো হয়, viewport height/width
 * অনুযায়ী flip/clamp করে যাতে ছোট স্ক্রিনেও popup কাটা না যায়। এটা
 * কার্যত একটা lightweight portal-এর কাজ করছে, কোনো React Portal API
 * ছাড়াই — `fixed` positioning viewport-relative, তাই কোনো ancestor-এর
 * `overflow`/`transform` একে clip করতে পারে না (যদি না কোনো ancestor-
 * এর নিজের `transform` থাকে, যা এখানে নেই)।
 *
 * scroll/resize হলে popup বন্ধ হয়ে যায় (position পুনর্গণনা না করে
 * সহজ রাখা — bar horizontally scroll করলেও বাটনের সাথে popup মিসঅ্যালাইন
 * হবে না)।
 *
 * একবারে একটাই dropdown খোলা থাকে (activeId state) — দুটো popup
 * একসাথে খোলা থাকলে ছোট স্ক্রিনে একটা আরেকটাকে ঢেকে ফেলত।
 *
 * বাইরে ক্লিক করলে বন্ধ হয় (mousedown listener, document-level) —
 * প্রতিটা ব্যবহারকারীর পরিচিত dropdown আচরণ। এখন popup document-level
 * এ বসে বলে click-outside চেক এ popup element ও আলাদাভাবে বিবেচনা
 * করা হয় (আগে containerRef এর ভেতরেই থাকত বলে এমনিই কভার হতো)।
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
  const [popupPos, setPopupPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeItem = items.find((i) => i.id === activeId) ?? null;

  // বাটনের অবস্থান থেকে popup এর fixed left/top হিসাব — খোলার সময় ও
  // window resize হলে পুনর্গণনা করে, যাতে popup সবসময় ঠিক বাটনের নিচে
  // এবং viewport এর ভেতরে (ডান দিকে ওভারফ্লো হলে বাম দিকে ক্ল্যাম্প)
  // থাকে।
  useLayoutEffect(() => {
    if (!activeId) {
      setPopupPos(null);
      return;
    }
    const btn = buttonRefs.current[activeId];
    if (!btn) return;

    function computePosition() {
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const popupWidth = activeItem?.wide ? 384 : 320; // w-96 / w-80
      const margin = 8;
      let left = rect.left;
      if (left + popupWidth + margin > window.innerWidth) {
        left = Math.max(margin, window.innerWidth - popupWidth - margin);
      }
      const top = rect.bottom + 6;
      setPopupPos({ left, top, width: popupWidth });
    }

    computePosition();
    window.addEventListener("resize", computePosition);
    return () => window.removeEventListener("resize", computePosition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideBar = containerRef.current?.contains(target);
      const insidePopup = popupRef.current?.contains(target);
      if (!insideBar && !insidePopup) {
        setActiveId(null);
      }
    }
    function handleScrollOrResize() {
      // popup document-level এ fixed বলে scroll হলে বাটনের সাথে
      // মিসঅ্যালাইন হয়ে যাবে — সহজ সমাধান: বন্ধ করে দেওয়া।
      setActiveId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="relative z-20 flex items-center gap-1.5 border-b border-surface-border bg-surface-card px-3 py-2 overflow-x-auto flex-shrink-0"
      >
        {items.map((item) => {
          const isOpen = activeId === item.id;
          return (
            <div key={item.id} className="flex-shrink-0">
              <button
                ref={(el) => {
                  buttonRefs.current[item.id] = el;
                }}
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
            </div>
          );
        })}

        {trailing && <div className="ml-auto flex-shrink-0 flex items-center gap-1.5">{trailing}</div>}
      </div>

      {/* popup — bar এর overflow-x-auto container এর সম্পূর্ণ বাইরে,
          document-level fixed positioning এ (bar এর ভেতরে absolute
          দিয়ে রাখলে clip হয়ে যেত, উপরের কমেন্ট দেখুন)। */}
      {activeItem && popupPos && (
        <div
          ref={popupRef}
          style={{ position: "fixed", left: popupPos.left, top: popupPos.top, width: popupPos.width, zIndex: 50 }}
          className="max-h-[70vh] overflow-y-auto rounded-xl border border-surface-border bg-surface-card shadow-card p-4"
        >
          {activeItem.content}
        </div>
      )}
    </>
  );
}
