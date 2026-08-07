# Color Migration Tracking — Light Clean Rollout

এই ফাইলটা Phase 0.1-এর অংশ হিসেবে তৈরি। উদ্দেশ্য: পুরনো dark
(`slate-*`, `sky-*`) থিম থেকে Hub-এর "Light Clean" থিমে migrate করার
সময় **কোনো ফাইল যেন বাদ না পড়ে**।

> **⚠️ সংশোধন নোটিশ (Phase 0.3):** Phase 0.1-এ এই migration-এর জন্য
> ভুলবশত Hub_com-এর *পুরনো, এখন অব্যবহৃত* `tailwind.config.ts` থেকে
> pure নীল ব্র্যান্ড রং (`#2563eb` ইত্যাদি) কপি করা হয়েছিল। প্রকৃতপক্ষে
> Hub_com Tailwind v4-এ migrate হওয়ার সময় সেই config বাতিল হয়ে গেছে —
> Hub-এর সক্রিয় রং এখন `app/globals.css`-এর `@theme` ব্লকে, যেটা নীল
> থেকে **grayscale**-এ পরিবর্তিত হয়েছে (Hub-এর নিজস্ব কমেন্ট: "brand
> color scale changed from blue to grayscale to match the PM app")।
> Phase 0.3-এ এই ভুল ধরা পড়ে এবং `globals.css`, `login/page.tsx`
> সংশোধন করা হয়েছে সঠিক grayscale `oklch()` মান দিয়ে। Canvas/viewport-এর
> ৪টা ফাইল (Phase 0.1) কোনো JSX পরিবর্তন ছাড়াই স্বয়ংক্রিয়ভাবে সঠিক
> হয়ে গেছে, কারণ তারা `bg-brand-600` এর মতো token-নাম ব্যবহার করে,
> hardcoded hex না — token-এর *মান* বদলালেই তারা সঠিক রং পায়। নিচের
> Token Reference টেবিল ও বাকি এই ডকুমেন্টের mapping যুক্তি অপরিবর্তিত
> আছে (শুধু চূড়ান্ত রং grayscale, নীল না)।

## নীতি (কেন এভাবে করা হচ্ছে)

২৫০০+ জায়গায় hardcoded slate কালার ছিল ৬৫টা ফাইলে। একসাথে সব ফাইল
বদলানো ঝুঁকিপূর্ণ (একবারে অনেক ফাইল ছোঁয়া হলে review করা কঠিন) — তাই
সিদ্ধান্ত হয়েছে: **যে ফাইল যে Phase-এ এমনিতেই কাজের জন্য খোলা হবে,
সেই Phase-এই তার রংও বদলে ফেলা হবে।** এই ফাইলটা সেই মিল রাখার জন্য —
প্রতিটা module কোন Phase-এ পড়ে সেটা নিচে লেখা আছে, যাতে সেই Phase-এর
কাজ শুরু হলে রং-পরিবর্তনটাও একসাথে করা যায়, ভুলে না যাওয়া যায়।

**সম্পূর্ণ Phase Plan-এর রেফারেন্স:** এই ফাইলের প্রতিটা group-এর পাশে
লেখা Part নম্বর আগের কথোপকথনে দেওয়া ৯-Part, ৪১-Phase প্ল্যানের সাথে
মিলে।

## Token Reference (globals.css-এ সংজ্ঞায়িত, Phase 0.1-এ সম্পন্ন)

| পুরনো (dark) | নতুন (Light Clean) |
|---|---|
| `bg-slate-950`, `bg-slate-900` | `bg-surface`, `bg-surface-card` |
| `bg-slate-800` | `bg-surface-hover` |
| `border-slate-800`, `border-slate-700` | `border-surface-border` |
| `text-slate-100`, `text-slate-200` | `text-text-primary` |
| `text-slate-300`, `text-slate-600` | `text-text-secondary` |
| `text-slate-400`, `text-slate-500` | `text-text-muted` |
| `sky-600`, `sky-500` (accent/active) | `brand-600` |
| `sky-700` (hover) | `brand-700` |
| `sky-300`, `sky-400` (link/label) | `brand-700` |
| `amber-400`, `amber-600` (warning text) | `status-holdText` |
| `red-950`/`red-900`/`red-300` (danger, dark bg) | `red-50`/`red-100`/`red-700` (light bg) |

**সতর্কতা:** এই mapping যান্ত্রিক guide, প্রতিটা ফাইলে বসানোর সময়
context দেখে যাচাই করা দরকার (যেমন Phase 0.1-এ
`VisualizationControlsPanel.tsx`-এ একটা bulk-replace hover state ভেঙে
দিয়েছিল যা হাতে ঠিক করতে হয়েছিল — `text-brand-700 hover:text-brand-700`
ভুল ছিল, `text-brand-600 hover:text-brand-800` সঠিক)।

---

## ✅ সম্পন্ন

| ফাইল | ছিল | Phase |
|---|---|---|
| `components/viewport/StructuralViewport.tsx` | ২ | 0.1 |
| `components/viewport/VisualizationViewport.tsx` | ২ | 0.1 |
| `components/viewport/VisualizationControlsPanel.tsx` | ৬৫ | 0.1 |
| `components/viewport/DrawModeToolbar.tsx` | ৩ | 0.1 |
| `app/page.tsx` | ৮ | 0.3 (সম্পূর্ণ rebuild, Project List) |
| `app/model/[projectId]/page.tsx` | ১৭ | 0.5 (সম্পূর্ণ rebuild, Sidebar layout) |
| `components/workflow/TabNavBar.tsx` | ২৬ | 0.5 (মুছে ফেলা হয়েছে, Sidebar.tsx+SubTabBar.tsx দিয়ে প্রতিস্থাপিত) |
| `components/workflow/WorkflowModeToggle.tsx` | ৫ | 0.5 (মুছে ফেলা হয়েছে) |
| `components/workflow/ActiveStageBanner.tsx` | ৪ | 0.5 (মুছে ফেলা হয়েছে) |

---

## ⏳ বাকি — মোট ৫৬টা ফাইল, ২৩৬০টা occurrence

### app/ (root shell ও standalone page) — Part 0 (UI Foundation)

| ফাইল | Occurrence | নোট |
|---|---:|---|
| `app/page.tsx` | ~~৮~~ ✅ | Phase 0.3 এ Project List হিসেবে সম্পূর্ণ rebuild, কোনো slate নেই |
| `app/model/[projectId]/page.tsx` | ~~১৭~~ ✅ | Phase 0.5 এ সম্পূর্ণ পুনর্লিখিত (নতুন Sidebar-ভিত্তিক layout), সব রং Light Clean token-এ |
| `app/phase0-check/page.tsx` | ৫ | infra sanity-check page, ব্যবহারকারী-মুখী নয় — সবচেয়ে কম অগ্রাধিকার, শেষে যেকোনো general cleanup phase-এ ধরা যায় (সংখ্যা ৮→৫ সংশোধিত, বর্তমান আসল count) |

**Subtotal: ১ ফাইল, ৫ occurrence**

---

### components/geometry-panel/ — Part 1 (Project Initialization) + Part 3 (Architectural Sync)

| ফাইল | Occurrence |
|---|---:|
| `GridPanel.tsx` | ২০ |
| `StoryPanel.tsx` | ১৯ |

**Subtotal: ২ ফাইল, ৩৯ occurrence** — এই panel Phase 3.3 (Structural Member Generation) আর Phase 3.6 (Manual Add/Edit layer)-এ যখন auto-sync যুক্ত হবে, তখন একসাথে রং বদলানো উচিত।

---

### components/library-panel/ — Part 4 (Automatic Engineering Definition)

| ফাইল | Occurrence |
|---|---:|
| `MaterialPanel.tsx` | ২২ |
| `SectionPanel.tsx` | ৪৭ |

**Subtotal: ২ ফাইল, ৬৯ occurrence** — Phase 4.1 (Material/Section auto-define)-এ এই দুই ফাইলে auto-populate logic বসানোর সময় রং-ও বদলানো উচিত, কারণ ফর্ম UI নিজেই বদলাবে (manual entry field → auto-filled + override display)।

---

### components/elements-panel/ — Part 3 (Structural Generation)

| ফাইল | Occurrence |
|---|---:|
| `ElementPanel.tsx` | ৪৫ |
| `AreaElementPanel.tsx` | ২৭ |
| `FootingPanel.tsx` | ৩৭ |
| `CombinedFootingPanel.tsx` | ৩৯ |
| `StripFootingPanel.tsx` | ৩৯ |
| `PileGroupPanel.tsx` | ৪৯ |
| `PileCapPanel.tsx` | ৪২ |

**Subtotal: ৭ ফাইল, ২৭৮ occurrence** — Phase 3.3–3.5 (Member Generation, Foundation Layout Suggestion)-এ এই panel-গুলো auto-generated element দেখানোর জন্য বদলাবে, তখনই রং-ও करा উচিত।

---

### components/load-panel/ — Part 2 (Decision Engine) + Part 4 (Load Auto-generation)

| ফাইল | Occurrence |
|---|---:|
| `LoadPatternPanel.tsx` | ১৭ |
| `WindLoadPanel.tsx` | ৪২ |
| `SeismicLoadPanel.tsx` | ৪১ |
| `ElementLoadPanel.tsx` | ৩৭ |
| `LoadCombinationPanel.tsx` | ২৭ |

**Subtotal: ৫ ফাইল, ১৬৪ occurrence** — `WindLoadPanel`/`SeismicLoadPanel` Phase 2.2/2.5-এ (auto-derive input বসানো) বদলাবে; `LoadPatternPanel`/`LoadCombinationPanel` Phase 4.3-এ (auto-generate) বদলাবে।

---

### components/analysis-panel/ — Part 5 (Analysis Pipeline)

| ফাইল | Occurrence |
|---|---:|
| `AnalysisPanel.tsx` | ৯৫ |
| `HingeEditor.tsx` | ১৬ |
| `IrregularityCheckPanel.tsx` | ৩১ |
| `PerformanceBasedDesignPanel.tsx` | ২৯ |
| `StoryDriftCheckPanel.tsx` | ২২ |
| `TorsionCheckPanel.tsx` | ২১ |

**Subtotal: ৬ ফাইল, ২১৪ occurrence** — Phase 5.8 (Orchestration)-এ যখন এই panel-গুলো automatic sequence-এর progress দেখানোর জন্য নতুন করে সাজানো হবে, তখন রং বদলানো উচিত। `AnalysisPanel.tsx` সবচেয়ে বড় (৯৫), এটা মূল trigger/orchestration UI হওয়ায় priority বেশি।

---

### components/validation-panel/ — Part 3 (Model Validation gate)

| ফাইল | Occurrence |
|---|---:|
| `ValidationPanel.tsx` | ২১ |

**Subtotal: ১ ফাইল, ২১ occurrence** — Phase 3.2 (Model Validation gate)-এ এটাই মূল UI, তখনই বদলানো উচিত।

---

### components/design-panel/ — Part 6 (Automatic Design) + Part 7 (Optimization) — সবচেয়ে বড় group

| ফাইল | Occurrence |
|---|---:|
| `GeotechnicalToolsPanel.tsx` | ১৪৬ |
| `SteelConnectionDesignPanel.tsx` | ৯৮ |
| `RetainingWallDesignPanel.tsx` | ৯১ |
| `RcColumnDesignPanel.tsx` | ৮২ |
| `CombinedFootingDesignPanel.tsx` | ৭৭ |
| `RcSlabDesignPanel.tsx` | ৭৫ |
| `PileCapDesignPanel.tsx` | ৭০ |
| `RcBeamDesignPanel.tsx` | ৬৪ |
| `MatFoundationDesignPanel.tsx` | ৬৩ |
| `FootingDesignPanel.tsx` | ৬০ |
| `BaseIsolationEnergyDissipationPanel.tsx` | ৫২ |
| `DevelopmentLengthPanel.tsx` | ৫০ |
| `ConstructionAiTopologyOptimizationPanel.tsx` | ৪৮ |
| `StripFootingDesignPanel.tsx` | ৪৩ |
| `SteelColumnDesignPanel.tsx` | ৪৩ |
| `FoundationOptimizationPanel.tsx` | ৪৩ |
| `RcWallDesignPanel.tsx` | ৪২ |
| `RebarLayoutPanel.tsx` | ৪০ |
| `SteelBeamDesignPanel.tsx` | ৩৯ |
| `CostOptimizationPanel.tsx` | ৩৪ |
| `DrawingSyncPanel.tsx` | ৩৪ |
| `PileDesignPanel.tsx` | ৩৩ |
| `SectionOptimizationPanel.tsx` | ৩০ |
| `GeneralNotesPanel.tsx` | ২৮ |
| `BarBendingSchedulePanel.tsx` | ২৫ |
| `StirrupTieZonePanel.tsx` | ২৪ |
| `SectionDetailPanel.tsx` | ২২ |
| `ConnectionDetailPanel.tsx` | ২১ |
| `WeightOptimizationPanel.tsx` | ২১ |
| `CollapsePredictionPanel.tsx` | ১৬ |

**Subtotal: ৩০ ফাইল, ১৫১৪ occurrence** — এই গ্রুপ একাই মোট বাকি রং-কাজের ~৬৩%। ভাঙা প্রয়োজন:
- **Part 6 (Design):** `RcBeamDesignPanel`, `RcColumnDesignPanel`, `RcSlabDesignPanel`, `RcWallDesignPanel`, `SteelBeamDesignPanel`, `SteelColumnDesignPanel`, `SteelConnectionDesignPanel`, `FootingDesignPanel`, `CombinedFootingDesignPanel`, `StripFootingDesignPanel`, `MatFoundationDesignPanel`, `PileCapDesignPanel`, `PileDesignPanel`, `RetainingWallDesignPanel`, `GeotechnicalToolsPanel` — Phase 6.1–6.4
- **Part 7 (Optimization):** `FoundationOptimizationPanel`, `SectionOptimizationPanel`, `WeightOptimizationPanel`, `CostOptimizationPanel`, `ConstructionAiTopologyOptimizationPanel`, `BaseIsolationEnergyDissipationPanel`, `CollapsePredictionPanel` — Phase 7.1–7.3
- **Part 8 (Documentation):** `RebarLayoutPanel`, `StirrupTieZonePanel`, `DevelopmentLengthPanel`, `BarBendingSchedulePanel`, `SectionDetailPanel`, `ConnectionDetailPanel`, `GeneralNotesPanel` — Phase 8.2
- **অন্যান্য:** `DrawingSyncPanel` (Hub sync সম্পর্কিত, Part 3-এর কাছাকাছি)

---

### components/detailing-panel/ — Part 8 (Documentation)

| ফাইল | Occurrence |
|---|---:|
| `DetailingPanel.tsx` | ৩০ |

**Subtotal: ১ ফাইল, ৩০ occurrence** — Phase 8.2-এ `design-panel`-এর detailing ফাইলগুলোর সাথেই এক দফায় বদলানো উচিত।

---

### components/workflow/ — Part 0 (UI Foundation, shell-এর অংশ)

| ফাইল | Occurrence |
|---|---:|
| `WorkflowSidebar.tsx` | ২৬ |

**Subtotal: ১ ফাইল, ২৬ occurrence** — Phase 0.5 এ `TabNavBar.tsx`, `WorkflowModeToggle.tsx`, `ActiveStageBanner.tsx` তিনটাই মুছে ফেলা হয়েছে (নতুন `Sidebar.tsx` + `SubTabBar.tsx` দিয়ে প্রতিস্থাপিত, যেগুলো শুরু থেকেই Light Clean token ব্যবহার করে লেখা, কোনো slate নেই)। শুধু `WorkflowSidebar.tsx` বাকি — এটা এই Phase এ ছোঁয়া হয়নি (on-demand drawer হয়ে গেছে কিন্তু ভেতরের রং অপরিবর্তিত), পরবর্তী কোনো Phase এ এটা ছোঁয়ার সময় রং বদলানো উচিত।

---

## সারসংক্ষেপ টেবিল

| Group | ফাইল বাকি | Occurrence বাকি | মূল Phase Part |
|---|---:|---:|---|
| app/ (shell + standalone) | ১ | ৫ | Part 0 |
| components/workflow/ | ১ | ২৬ | Part 0 |
| components/geometry-panel/ | ২ | ৩৯ | Part 1, 3 |
| components/library-panel/ | ২ | ৬৯ | Part 4 |
| components/elements-panel/ | ৭ | ২৭৮ | Part 3 |
| components/load-panel/ | ৫ | ১৬৪ | Part 2, 4 |
| components/validation-panel/ | ১ | ২১ | Part 3 |
| components/analysis-panel/ | ৬ | ২১৪ | Part 5 |
| components/design-panel/ | ৩০ | ১৫১৪ | Part 6, 7, 8 |
| components/detailing-panel/ | ১ | ৩০ | Part 8 |
| **মোট বাকি** | **৫৬** | **২৩৬০** | — |

**অগ্রগতি:** শুরুতে ৬৫ ফাইল/২৪৮৮ occurrence ছিল (Phase 0.1 এর ৪টা viewport ফাইল সহ)। এখন পর্যন্ত ৯টা ফাইল সম্পূর্ণ (viewport ৪টা + `app/page.tsx` + `app/model/[projectId]/page.tsx` + `TabNavBar.tsx`/`WorkflowModeToggle.tsx`/`ActiveStageBanner.tsx` মুছে ফেলা) সম্পন্ন হয়েছে, বাকি ৫৬ ফাইলে ২৩৬০টা occurrence।

---

## কীভাবে ব্যবহার করবেন

যখনই কোনো Phase-এর কাজ শুরু হবে (উদাহরণ: Phase 6.1 — RC Design
automation), তখন প্রথমে এই ফাইলে সেই Phase-এর সাথে ম্যাপ করা ফাইল
লিস্ট দেখে নেওয়া, আর সেই ফাইল ছোঁয়ার সময় উপরের Token Reference টেবিল
অনুযায়ী রং-ও বদলে ফেলা। কাজ শেষ হলে এই ফাইলের সেই এন্ট্রি "✅ সম্পন্ন"
সেকশনে সরিয়ে নেওয়া, যাতে আগামী দিনে ঠিক কতটুকু বাকি আছে এক নজরে বোঝা
যায়।
