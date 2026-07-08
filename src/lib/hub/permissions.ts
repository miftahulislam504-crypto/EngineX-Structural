import type { HubProjectInfo, UserRole } from "@/lib/types/hub";

/**
 * Hub থেকে আসা permissions অনুযায়ী একজন ইউজারের role বের করে।
 * এই App নিজে কোনো permission তৈরি বা এডিট করে না — Hub-ই একমাত্র
 * source of truth (Section 20: Receive User & Team Permissions)।
 */
export function getUserRole(
  projectInfo: HubProjectInfo,
  userId: string
): UserRole | null {
  const entry = projectInfo.permissions.find((p) => p.userId === userId);
  return entry?.role ?? null;
}

export function canEditModel(role: UserRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function canRunAnalysis(role: UserRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function canViewOnly(role: UserRole | null): boolean {
  return role === "viewer";
}

export function hasAnyAccess(role: UserRole | null): boolean {
  return role !== null;
}
