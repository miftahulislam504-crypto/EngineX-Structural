import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Hub_com/lib/utils.ts এর getStatusLabel/getStatusColor এর সাথে
 * হুবহু (একই বাংলা লেবেল, একই status ভ্যালু) — যাতে Hub-এ যে status
 * "চলমান" দেখায় সেটা এখানেও "চলমান"-ই দেখায়, ভিন্ন শব্দে না।
 *
 * generateProjectCode() ইচ্ছাকৃতভাবে পোর্ট করা হয়নি — এই App কখনো
 * প্রজেক্ট তৈরি করে না (শুধু পড়ে), তাই কোড জেনারেট করার দরকার নেই।
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "চলমান";
    case "on_hold":
      return "বিরতি";
    case "completed":
      return "সম্পন্ন";
    default:
      return status;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700 border-green-200";
    case "on_hold":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "completed":
      return "bg-blue-100 text-blue-700 border-blue-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}
