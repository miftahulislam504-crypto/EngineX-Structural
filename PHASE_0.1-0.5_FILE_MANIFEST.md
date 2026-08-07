# Phase 0.1 – 0.5 আপডেট ফাইল ম্যানিফেস্ট

এই zip-এ **শুধু** Phase 0.1 থেকে 0.5 পর্যন্ত তৈরি/পরিবর্তিত ফাইল আছে —
পুরো প্রজেক্ট না। আপনার existing EngineX-Structural কোডবেসে এই ফাইলগুলো
একই path-এ বসিয়ে দিলেই (existing ফাইল হলে overwrite করে) আপডেট সম্পন্ন
হবে।

## ⚠️ প্রথমে মুছে ফেলুন (Phase 0.5-এ এই ৩টা ফাইল বাতিল হয়ে গেছে)

নতুন `Sidebar.tsx` + `SubTabBar.tsx` এই ফাইলগুলোর কাজ প্রতিস্থাপন
করেছে। zip বসানোর **আগে** আপনার কোডবেস থেকে এই ৩টা ফাইল মুছে দিন,
নাহলে পুরনো কোড থেকে যাবে এবং import error আসতে পারে:

- `src/components/workflow/TabNavBar.tsx`
- `src/components/workflow/WorkflowModeToggle.tsx`
- `src/components/workflow/ActiveStageBanner.tsx`

## নতুন ফাইল (আগে ছিল না)

**Auth (Phase 0.2):**
- `src/lib/auth/useAuthStore.ts`
- `src/lib/auth/AuthProvider.tsx`

**Projects/Login (Phase 0.2, 0.3):**
- `src/app/login/page.tsx`
- `src/lib/types/project.ts`
- `src/lib/projects/firestore.ts`
- `src/lib/utils.ts`

**Canvas/2D (Phase 0.4):**
- `src/components/viewport/PlanView2D.tsx`

**Sidebar (Phase 0.5):**
- `src/components/workflow/Sidebar.tsx`
- `src/components/workflow/SubTabBar.tsx`
- `src/lib/workflow/subTabLabels.ts`

**Brand assets (Phase 0.1):**
- `public/logo.png`
- `public/favicon.ico`

**Documentation:**
- `COLOR_MIGRATION_TRACKING.md`
- `HUB_MODULE_SYNC_NOTE.md`

## পরিবর্তিত ফাইল (আগে থেকেই ছিল, এখন আপডেট)

**রং/থিম (Phase 0.1, পরে 0.3-এ grayscale সংশোধন):**
- `src/app/globals.css`

**Auth integration (Phase 0.2):**
- `src/app/layout.tsx` (AuthProvider দিয়ে wrap)
- `src/lib/firebase/useEnsureAuth.ts` (anonymous auth থেকে real auth-এ)

**Project List (Phase 0.3):**
- `src/app/page.tsx` (সম্পূর্ণ rebuild — আগে demo redirect ছিল)

**Canvas রং (Phase 0.1, 0.3 সংশোধনসহ):**
- `src/components/viewport/StructuralViewport.tsx`
- `src/components/viewport/VisualizationViewport.tsx`
- `src/components/viewport/VisualizationControlsPanel.tsx`
- `src/components/viewport/DrawModeToolbar.tsx`

**Sidebar/Layout restructure (Phase 0.5, সবচেয়ে বড় পরিবর্তন):**
- `src/app/model/[projectId]/page.tsx` (সম্পূর্ণ পুনর্লিখিত)
- `src/components/workflow/WorkflowSidebar.tsx` (on-demand drawer আচরণ)
- `src/lib/workflow/stageTabs.ts` (SidebarTab/DesignSubTab টাইপ পুনর্গঠন)
- `src/lib/workflow/types.ts` (StageId-এ "detailing" যোগ)
- `src/lib/workflow/useWorkflowProgress.ts` (progress.detailing যোগ)
- `src/lib/workflow/useWorkflowUiStore.ts` (wizardMode → workflowPanelOpen)

**Dependencies:**
- `package.json`, `package-lock.json` (নতুন: `lucide-react`, `clsx`, `tailwind-merge`)

## বসানোর পর করণীয়

```bash
npm install
npm run build
```

`.env.local` নিজের Firebase credential দিয়ে বানিয়ে নিন
(`.env.local.example` টেমপ্লেট হিসেবে ব্যবহার করুন) — এই zip-এ
`.env.local` নেই (secret, কখনো commit/শেয়ার করা হয় না)।
