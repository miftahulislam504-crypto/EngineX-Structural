"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

/**
 * SubTabHub — Redesign (২০২৬-০৮)।
 *
 * Design/Optimization/Documentation ট্যাবের জন্য দুই-ধাপ নেভিগেশন
 * প্যাটার্নের প্রথম ধাপ: একটা option-card গ্রিড (এই কম্পোনেন্ট),
 * যেখানে ক্লিক করলে caller (design/page.tsx ইত্যাদি) নিজস্ব নেস্টেড
 * route এ push করে (দ্বিতীয় ধাপ — /design/beam, /design/column,
 * ইত্যাদি, প্রতিটার নিজের URL)।
 *
 * ব্যবহারকারীর স্পষ্ট নির্দেশ অনুযায়ী: "design, optimization,
 * documentation full width থাকবে তবে এটা ক্লিক করলে এর অপশন গুলো
 * আসবে তারপর ক্লিক করলে আলাদা পেজে" — SubTabBar (pill bar, একই পেজে
 * content সুইচ করে) থেকে এই কম্পোনেন্ট সম্পূর্ণ আলাদা: এখানে কোনো
 * content সুইচ হয় না, শুধু route পাল্টায়।
 *
 * groups (ঐচ্ছিক) বড় সেট (Design এর ১৭টা) এর জন্য — SubTabBar এর
 * groups prop এর মতোই group label সহ সেকশনে ভাগ করে দেখায়। ছোট সেট
 * (Optimization এর ৫টা, Documentation এর ৯টা) group ছাড়াই flat গ্রিডে।
 */

export interface HubItem<T extends string> {
  id: T;
  label: string;
  description?: string;
  icon: LucideIcon;
}

export interface HubGroup<T extends string> {
  groupLabel: string;
  items: HubItem<T>[];
}

interface SubTabHubProps<T extends string> {
  onSelect: (id: T) => void;
  items?: HubItem<T>[];
  groups?: HubGroup<T>[];
}

export function SubTabHub<T extends string>({ onSelect, items, groups }: SubTabHubProps<T>) {
  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-8">
      {items && <HubGrid items={items} onSelect={onSelect} />}

      {groups &&
        groups.map((group) => (
          <div key={group.groupLabel}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">
              {group.groupLabel}
            </h2>
            <HubGrid items={group.items} onSelect={onSelect} />
          </div>
        ))}
    </div>
  );
}

function HubGrid<T extends string>({
  items,
  onSelect,
}: {
  items: HubItem<T>[];
  onSelect: (id: T) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className="group flex items-start gap-3 rounded-xl border border-surface-border bg-surface-card p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">
              <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-text-primary">{item.label}</span>
              {item.description && (
                <span className="block text-xs text-text-muted mt-0.5 line-clamp-2">
                  {item.description}
                </span>
              )}
            </span>
            <ChevronRight
              size={16}
              className="mt-1 flex-shrink-0 text-text-muted transition-colors group-hover:text-brand-600"
            />
          </button>
        );
      })}
    </div>
  );
}
