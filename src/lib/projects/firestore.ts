"use client";

import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Project } from "@/lib/types/project";

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return new Date();
}

function docToProject(id: string, d: Record<string, unknown>): Project {
  return {
    id,
    projectCode: d.projectCode ? String(d.projectCode) : undefined,
    projectName: String(d.projectName ?? ""),
    clientName: d.clientName ? String(d.clientName) : undefined,
    location: d.location ? String(d.location) : undefined,
    status: (d.status as Project["status"]) ?? "active",
    description: d.description ? String(d.description) : undefined,
    createdBy: String(d.createdBy ?? ""),
    createdAt: toDate(d.createdAt),
    updatedAt: d.updatedAt ? toDate(d.updatedAt) : undefined,
  };
}

/**
 * বর্তমান সাইন-ইন করা user যে প্রজেক্টগুলো তৈরি করেছে সেগুলো real-time
 * subscribe করে (Firestore-এর `projects` collection — Hub এই collection
 * এর মালিক, এই App শুধু পড়ে, কখনো লেখে না)।
 *
 * EngineXDraw এর lib/projects.ts এর subscribeToMyProjects এর সরাসরি
 * পোর্ট — একই query shape (createdBy == uid, orderBy createdAt desc)
 * ব্যবহার করা হয়েছে যাতে এটা Hub এর ইতিমধ্যে-বিদ্যমান composite index
 * (createdBy ASC, createdAt DESC) পুনর্ব্যবহার করে, নতুন index তৈরির
 * দরকার না পড়ে।
 *
 * সীমাবদ্ধতা (ইচ্ছাকৃতভাবে এই Phase-এ সমাধান করা হয়নি): এটা শুধু
 * `createdBy == uid` মেলা প্রজেক্ট দেখায় — যেসব প্রজেক্টে এই user
 * editor/viewer হিসেবে যুক্ত কিন্তু নিজে তৈরি করেনি (permissions-based
 * shared access) সেগুলো এখানে দেখা যাবে না। Hub নিজেও এই মুহূর্তে
 * শুধু createdBy দিয়েই ফিল্টার করে (permissions array এখনো Hub-এর
 * প্রকৃত schema-তে নেই — দেখুন lib/types/project.ts এর টীকা), তাই এটা
 * platform জুড়ে একটা পরিচিত/সামঞ্জস্যপূর্ণ সীমাবদ্ধতা, এই App-এর একার
 * ঘাটতি না।
 */
export function subscribeToMyProjects(
  userId: string,
  onChange: (projects: Project[]) => void,
  onError?: (message: string) => void
) {
  const projectsQuery = query(
    collection(db(), "projects"),
    where("createdBy", "==", userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    projectsQuery,
    (snap) => {
      const projects = snap.docs.map((d) => docToProject(d.id, d.data()));
      onChange(projects);
    },
    (err) => {
      console.error("subscribeToMyProjects: query failed", err);
      onChange([]);
      onError?.(err.message);
    }
  );
}
