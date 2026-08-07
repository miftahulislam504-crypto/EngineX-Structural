"use client";

/**
 * Generic Horizontal Sub-Tab Bar (Phase 0.5)।
 *
 * Loads, Design, Optimization, Documentation — এই ৪টা main tab এর
 * প্রতিটার নিজস্ব sub-tab আছে। আগে (TabNavBar.tsx) এগুলো একটা popover
 * dropdown এ লুকানো থাকত (ক্লিক করে খুলতে হতো)। ব্যবহারকারীর নির্দেশ
 * অনুযায়ী এখন content area এর ঠিক উপরে সবসময়-দৃশ্যমান একটা horizontal
 * bar — কোনো dropdown/popover নেই।
 *
 * গ্রুপ (`groups` prop) ঐচ্ছিক — ছোট sub-tab সেট (যেমন Loads এর ৫টা)
 * গ্রুপ ছাড়াই একসাথে দেখানো যায়, বড় সেট (Design এর ১৭টা) group label
 * সহ দেখানো ভালো, যাতে scanning সহজ হয়।
 */

export interface SubTabItem<T extends string> {
  id: T;
  label: string;
}

export interface SubTabGroup<T extends string> {
  groupLabel: string;
  tabs: SubTabItem<T>[];
}

interface SubTabBarProps<T extends string> {
  active: T;
  onChange: (id: T) => void;
  /** ছোট, group ছাড়া সেটের জন্য (যেমন Loads এর ৫টা)। */
  tabs?: SubTabItem<T>[];
  /** বড়, group করা সেটের জন্য (যেমন Design এর ১৭টা)। tabs এর বদলে এটা দিন। */
  groups?: SubTabGroup<T>[];
}

export function SubTabBar<T extends string>({ active, onChange, tabs, groups }: SubTabBarProps<T>) {
  return (
    <div className="border-b border-surface-border bg-surface-card px-3 py-2 overflow-x-auto">
      {tabs && (
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <SubTabButton key={tab.id} tab={tab} isActive={active === tab.id} onClick={() => onChange(tab.id)} />
          ))}
        </div>
      )}

      {groups && (
        <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
          {groups.map((group) => (
            <div key={group.groupLabel} className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-text-muted mr-0.5 whitespace-nowrap">
                {group.groupLabel}
              </span>
              {group.tabs.map((tab) => (
                <SubTabButton
                  key={tab.id}
                  tab={tab}
                  isActive={active === tab.id}
                  onClick={() => onChange(tab.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubTabButton<T extends string>({
  tab,
  isActive,
  onClick,
}: {
  tab: SubTabItem<T>;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        isActive
          ? "bg-brand-600 text-white"
          : "bg-surface text-text-secondary border border-surface-border hover:text-text-primary hover:border-brand-300"
      }`}
    >
      {tab.label}
    </button>
  );
}
