"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderOpen, ChevronRight, LogOut, MapPin, User, Calendar } from "lucide-react";
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
 * status filter + card-grid list) অনুসরণ করা হয়েছে — project-card/
 * project-card-accent ক্লাস দুটোও Hub এর globals.css থেকে token-for-
 * token পোর্ট করা, যাতে দুই App-এর card visual language মেলে। তবে
 * এই App ইচ্ছাকৃতভাবে **read-only**: কোনো "নতুন প্রজেক্ট", ডিলিট, বা
 * status পরিবর্তনের অপশন নেই (Hub এর কার্ডে যেমন footer-এ status
 * dropdown + delete বাটন থাকে, এখানে শুধু "মডেল খুলুন" লিংক)। কারণ
 * lib/hub/permissions.ts এর নীতি অনুযায়ী এই App প্রজেক্ট তৈরি/এডিট
 * করে না — Hub-ই একমাত্র owner, এই App শুধু প্রজেক্ট খুলে তার
 * Structural মডেল নিয়ে কাজ করে।
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((p) => {
              const accent =
                p.status === "active"
                  ? "bg-green-500"
                  : p.status === "completed"
                    ? "bg-brand-500"
                    : "bg-yellow-400";

              return (
                <button
                  key={p.id}
                  onClick={() => router.push(`/model/${p.id}`)}
                  className="project-card group text-left w-full"
                >
                  <div className={`project-card-accent ${accent}`} />

                  <div className="p-5 pl-6">
                    {/* Top row: code + status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {p.projectCode ? (
                        <span className="text-xs font-mono font-semibold text-text-muted bg-surface px-2 py-1 rounded-md">
                          {p.projectCode}
                        </span>
                      ) : (
                        <span />
                      )}
                      <StatusBadge status={p.status} />
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-text-primary text-base leading-snug mb-3 line-clamp-2">
                      {p.projectName}
                    </h3>

                    {/* Meta */}
                    <div className="space-y-1.5">
                      {p.clientName && (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                          <User size={13} className="text-text-muted flex-shrink-0" />
                          <span className="truncate">{p.clientName}</span>
                        </div>
                      )}
                      {p.location && (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                          <MapPin size={13} className="text-text-muted flex-shrink-0" />
                          <span className="truncate">{p.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Calendar size={13} className="flex-shrink-0" />
                        <span>{formatDate(p.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer bar: open action */}
                  <div className="flex items-center justify-end gap-1.5 px-5 pl-6 py-3 border-t border-surface-border bg-surface/50 text-xs font-medium text-text-muted group-hover:text-text-primary">
                    মডেল খুলুন
                    <ChevronRight
                      size={15}
                      className="text-text-muted group-hover:text-text-primary transition-all flex-shrink-0"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
