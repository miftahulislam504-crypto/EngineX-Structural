/**
 * Phase 1 (Routing Skeleton) — এই layout.tsx আগে ছিল না; পুরো model
 * workspace একটাই page.tsx ছিল (activeTab state দিয়ে panel সুইচ
 * করত, URL অপরিবর্তিত থাকত)। এখন প্রতিটা SidebarTab-এর জন্য একটা
 * route segment বানানো হয়েছে (geometry/, elements/, loads/, ... —
 * lib/workflow/stageTabs.ts এর SidebarTab union-এর সাথে নাম হুবহু
 * মিলিয়ে, যাতে tab id ↔ route segment এক থাকে, কোনো mapping layer
 * না লাগে)।
 *
 * ⚠️ ইচ্ছাকৃতভাবে pure pass-through — এখনই EngineXDraw এর
 * ProjectShell-এর মতো persistent nav shell বসানো হয়নি। কারণ:
 * existing app/model/[projectId]/page.tsx নিজেই এখনো তার নিজস্ব
 * পূর্ণ shell render করে (`<main className="h-screen w-screen ...">`
 * এর ভেতরে desktop <Sidebar> + mobile drawer <Sidebar>, দেখুন
 * page.tsx লাইন ~476-484)। এই মুহূর্তে এখানে আরেকটা shell বসালে
 * দুটো সমস্যা হতো: (১) Sidebar দুইবার দেখাবে, (২) page.tsx এর
 * h-screen একটা বাইরের container-এর ভেতরে বসবে যেটাও হয়তো নিজস্ব
 * height নেয়, layout ভেঙে যাওয়ার ঝুঁকি।
 *
 * Persistent shell (route-aware Sidebar, active-state highlighting,
 * mobile drawer) Phase 2-এর কাজ — সেই phase-এই page.tsx থেকে পুরনো
 * <Sidebar>/<WorkflowSidebar> render একসাথে সরানো হবে, যাতে কোনো
 * মুহূর্তেই duplicate বা broken অবস্থা না থাকে।
 *
 * এখন এই layout.tsx এর একমাত্র কাজ: route tree-টা বৈধ রাখা (Next.js
 * এ layout.tsx আবশ্যক না, কিন্তু dynamic segment-এর নিচে children
 * route-গুলো (geometry/page.tsx ইত্যাদি) বসানোর আগে এই ফাইলটা রাখা
 * হলো যাতে Phase 2-তে এখানেই shell বসানো যায়, নতুন ফাইল না বানিয়ে)।
 */
export default function ModelLayout({ children }: LayoutProps<"/model/[projectId]">) {
  return children;
}
