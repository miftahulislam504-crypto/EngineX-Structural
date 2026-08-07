/**
 * Project List Types (Phase 0.3)
 *
 * এটা Hub_com/lib/types.ts এর `Project` ইন্টারফেসের সাথে মেলানো —
 * Hub-ই এই collection-এর মালিক (projects/{id} ডকুমেন্ট Hub লেখে,
 * এই App শুধু পড়ে)। EngineXDraw একই pattern অনুসরণ করে
 * (packages/object-model/src/index.ts এর Project দেখুন), তাই এই টাইপ
 * তিন App জুড়ে সামঞ্জস্যপূর্ণ।
 *
 * ⚠️ এটা src/lib/types/hub.ts এর `HubProjectInfo` থেকে ইচ্ছাকৃতভাবে
 * আলাদা। `HubProjectInfo` একটা future/aspirational contract (Section 20
 * — permissions array, designCode object, structured location সহ) যেটা
 * এখনো Hub এর দিক থেকে বাস্তবায়িত হয়নি (Hub এই মুহূর্তে hubSync/incoming
 * এ কিছু লেখে না)। এই ফাইলের `Project` টাইপ বরং Hub এর *বর্তমান বাস্তব*
 * projects/{id} ডকুমেন্টের সাথে মেলে — যেটা এখনই কাজ করে, কোনো future
 * sync pipeline এর অপেক্ষা ছাড়াই।
 *
 * এই দুই টাইপ ভবিষ্যতে মিলে যেতে পারে (Hub যদি কখনো hubSync/incoming
 * পাইপলাইন বাস্তবায়ন করে) — কিন্তু ততক্ষণ পর্যন্ত Project List পেজের
 * জন্য এই সরল টাইপই ব্যবহার করা উচিত, HubProjectInfo না।
 */

export type ProjectStatus = "active" | "on_hold" | "completed";

export interface Project {
  id: string;
  projectCode?: string;
  projectName: string;
  clientName?: string;
  location?: string;
  status: ProjectStatus;
  description?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}
