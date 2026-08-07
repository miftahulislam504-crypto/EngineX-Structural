"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderOpen, ChevronRight, LogOut } from "lucide-react";
import Image from "next/image";
import { useAuthStore } from "@/lib/auth/useAuthStore";
import { subscribeToMyProjects } from "@/lib/projects/firestore";
import type { Project, ProjectStatus } from "@/lib/types/project";
import { formatDate, getStatusLabel } from "@/lib/utils";

const STATUS_FILTERS: { value: ProjectStatus | ""; label: string }[] = [
  { value: "", label: "সব" },
  { value: "active", label: "চলমান" },
  { value: "on_hold", label: "বিরতি" },
  { value: "completed", label: "সম্পন্ন" },
];

function StatusBadge({ status }: { status: ProjectStatus | string }) {
  if (status === "active") return <span className="badge-active">{getStatusLabel(status)}</span>;
  if (status === "on_hold") return <span className="badge-hold">{getStatusLabel(status)}</span>;
  if (status === "completed") return <span className="badge-done">{getStatusLabel(status)}</span>;
  return <span className="badge-hold">{status}</span>;
}

/**
 * Project List পেজ (Phase 0.3) — এই App-এর এন্ট্রি পয়েন্ট, root ("/")।
 *
 * Hub_com/app/dashboard/projects/page.tsx এর visual pattern (search +
 * status filter + table-style list) অনুসরণ করা হয়েছে, কিন্তু
 * ইচ্ছাকৃতভাবে **read-only**: কোনো "নতুন প্রজেক্ট", ডিলিট, বা status
 * পরিবর্তনের অপশন নেই। কারণ lib/hub/permissions.ts এর নীতি অনুযায়ী
 * এই App প্রজেক্ট তৈরি/এডিট করে না — Hub-ই একমাত্র owner, এই App শুধু
 * প্রজেক্ট খুলে তার Structural মডেল নিয়ে কাজ করে।
 *
 * ডেটা lib/projects/firestore.ts থেকে আসে, যেটা EngineXDraw এর
 * lib/projects.ts এর subscribeToMyProjects এর পোর্ট (দেখুন সেই ফাইলের
 * টীকা — এটা সরাসরি Hub এর `projects` collection পড়ে, hubSync/incoming
 * এর মতো কোনো future contract এর অপেক্ষা করে না)।
 */
export default function ProjectListPage() {
  const router = useRouter();
  const { user, initialized, signOut } = useAuthStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProjectStatus | "">("");

  useEffect(() => {
    if (initialized && !user) {
      router.replace("/login");
    }
  }, [initialized, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = subscribeToMyProjects(
      user.uid,
      (data) => {
        setProjects(data);
        setLoading(false);
      },
      (message) => setLoadError(message)
    );
    return unsubscribe;
  }, [user]);

  const filtered = projects.filter((p) => {
    const matchFilter = !filter || p.status === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.projectName.toLowerCase().includes(q) ||
      (p.clientName ?? "").toLowerCase().includes(q) ||
      (p.location ?? "").toLowerCase().includes(q) ||
      (p.projectCode ?? "").toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  if (!initialized || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="spinner" aria-label="লোড হচ্ছে" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Top bar */}
      <header className="bg-surface-card border-b border-surface-border">
        <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-white rounded-lg w-8 h-8 flex items-center justify-center border border-surface-border p-1">
              <Image src="/logo.png" alt="CivilOS" width={24} height={24} className="object-contain" />
            </div>
            <span className="font-bold text-text-primary">CivilOS Structural</span>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <LogOut size={15} />
            সাইন-আউট
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-text-primary">প্রজেক্টসমূহ</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {loading ? "লোড হচ্ছে..." : `মোট ${projects.length}টি — Hub-এ তৈরি করা প্রজেক্ট এখানে দেখা যাবে`}
          </p>
        </div>

        {/* Search + filter bar */}
        <div className="card p-4 mb-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="নাম, ক্লায়েন্ট, বা কোড দিয়ে খুঁজুন..."
                className="input-field pl-9"
              />
            </div>
            <div className="flex gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    filter === f.value
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-text-secondary border-surface-border hover:border-brand-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">
            প্রজেক্ট লোড করতে সমস্যা হয়েছে: {loadError}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="spinner w-8 h-8" aria-label="লোড হচ্ছে" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card py-16 text-center">
            <FolderOpen size={40} className="text-text-muted mx-auto mb-3 opacity-30" />
            <p className="text-text-secondary font-medium text-sm">
              {projects.length === 0 ? "কোনো প্রজেক্ট নেই" : "কিছু পাওয়া যায়নি"}
            </p>
            {projects.length === 0 && (
              <p className="text-text-muted text-xs mt-2">
                নতুন প্রজেক্ট Hub থেকে তৈরি করুন — এখানে স্বয়ংক্রিয়ভাবে দেখা যাবে।
              </p>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_140px_100px_24px] gap-4 px-5 py-2.5 bg-surface border-b border-surface-border">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                প্রজেক্ট
              </span>
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                ক্লায়েন্ট
              </span>
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                অবস্থা
              </span>
              <span />
            </div>

            <div>
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/model/${p.id}`)}
                  className="table-row group w-full text-left"
                >
                  {/* Color bar */}
                  <div
                    className={`w-0.5 h-10 rounded-full flex-shrink-0 ${
                      p.status === "active"
                        ? "bg-green-500"
                        : p.status === "completed"
                          ? "bg-brand-500"
                          : "bg-yellow-400"
                    }`}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary text-sm truncate">
                        {p.projectName}
                      </span>
                      {p.projectCode && (
                        <span className="text-xs font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded-md hidden sm:inline">
                          {p.projectCode}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted truncate mt-0.5">
                      {[p.location, formatDate(p.createdAt)].filter(Boolean).join(" · ")}
                    </div>
                  </div>

                  {/* Client */}
                  <div className="hidden sm:block text-sm text-text-secondary truncate w-[140px]">
                    {p.clientName ?? "—"}
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0">
                    <StatusBadge status={p.status} />
                  </div>

                  {/* Chevron */}
                  <ChevronRight
                    size={15}
                    className="text-text-muted group-hover:text-text-primary transition-all flex-shrink-0"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
