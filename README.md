# CivilOS — Structural Analysis & Design App

Hub-integrated স্ট্রাকচারাল অ্যানালাইসিস অ্যাপ। Next.js + Firebase
(Firestore/Auth/Storage), ভারী ক্যালকুলেশনের জন্য আলাদা compute
microservice (দেখুন `civilos-structural-solver` repo — মূল প্ল্যানে
Cloud Run ধরা ছিল, বর্তমানে Railway-তে হোস্ট করা হচ্ছে GCP-এর কার্ড
requirement এড়াতে; কোড/Dockerfile অপরিবর্তিত, শুধু deploy টার্গেট আলাদা)।

**এই App কখনো Project Create/Edit করে না** — সব প্রজেক্ট ডেটা Hub থেকে
আসে (`src/lib/hub/`, `src/lib/types/hub.ts`)।

---

## এখন পর্যন্ত কী বসানো হয়েছে (Phase 0 - Phase 4a)

### Phase 0 — Hub Integration Foundation
- Next.js 16 + TypeScript + Tailwind (App Router, `src/` layout)
- Firebase client SDK — lazy-initialized, Firestore schema helper, Hub data contract, Hub sync functions, permission helper
- Compute service client — job submit/poll
- `/phase0-check` — deploy-পরবর্তী sanity check পেজ

### Phase 1 — Geometry Core
- Grid System, Story System — টাইপ, Firestore persistence, 3D viewport, ফর্ম প্যানেল

### Phase 2a — Elements + Materials + Sections (priority items)
- Concrete/Steel material, Rectangular/Circular/W-shape/HSS section
- Beam, Column, Slab, Wall, Footing element — ফর্ম UI + viewport rendering
- কেন্দ্রীয় Selection Store

### Phase 2b — Slab/Wall Click-to-Draw
- Draw Mode state machine, grid snapping, viewport raycasting, দুই-ধাপ material/thickness ফর্ম workflow
- একটা গুরুত্বপূর্ণ raycasting bug (StoryPlanes draw-click ব্লক করছিল) ও একটা storyId ডেটা-মডেলিং gap ধরা পড়েছিল ও ঠিক করা হয়েছিল কোড-রিভিউয়ের সময়

### Phase 2c — Exotic Materials, Elements, Sections
- **Material:** + Timber, Aluminium, FRP, Glass, Composite (৭ ধরন মোট)
- **Section:** + Built-up I-section (পূর্ণাঙ্গ calculation)। Composite/Prestressed/Cold-Formed টাইপ আছে কিন্তু **ইচ্ছাকৃতভাবে UI নেই** — এদের geometric property pure geometry থেকে নির্ভরযোগ্যভাবে বের করা যায় না (transformed-section/tendon-losses/load-dependent-effective-width লাগে), তাই `computeSectionProperties` এদের জন্য explicit error দেয়, ভুল সংখ্যা না।
- **Element:** + Brace, Pile, Shear Wall, Core Wall। LineElement-এ নতুন `connectionType` ("moment"/"pin") ফিল্ড — Truss-কে আলাদা category না বানিয়ে এই ফিল্ড দিয়ে ধরা হয়েছে (Truss জ্যামিতিকভাবে Beam/Brace-এর মতোই, পার্থক্য শুধু pin-connection behavior-এ)
- Flat Slab/Drop Panel, Raft/Pile Cap, Shell/Plate/Membrane/Solid, Cable/Tendon, Spring/Damper/Link/Base Isolation — এখনো নেই (কারণ বিস্তারিত `element.ts` হেডার মন্তব্যে: এগুলোর বেশিরভাগ FE-mesh বা সম্পূর্ণ ভিন্ন geometry/DOF মডেল দাবি করে)

### Phase 3 — Loads and Load Combinations
- **Load types:** Dead, Live, Wind, Earthquake, Snow, Rain, Temperature, Settlement, Hydrostatic, Soil Pressure, Impact, Dynamic, Construction, Equipment, Custom — সব ফাংশনাল, Point/Uniform-Line/Uniform-Area/Temperature-Change হিসেবে element-এ প্রয়োগযোগ্য
- **BNBC 2020 Wind Load calculator** (`src/lib/loads/windLoad.ts`) — Equivalent Static Wind Force পদ্ধতি, velocity pressure থেকে design pressure পর্যন্ত
- **BNBC 2020 Seismic Load calculator** (`src/lib/loads/seismicLoad.ts`) — ELF পদ্ধতি, base shear + story-wise vertical distribution
- **Load Combination Generator** (`src/lib/loads/loadCombinations.ts`) — ACI 318-19 Section 5.3.1 এর ৭টা ডিফল্ট LRFD combination + custom combination তৈরির সুযোগ
- **Bridge Load, Vehicle/Moving Load, Blast Load — ইচ্ছাকৃতভাবে UI নেই** (শুধু placeholder টাইপ)। কারণ: এগুলোর প্রতিটাই নিজস্ব বড় calculation domain দাবি করে (bridge influence-line analysis, blast pressure-time history) — এখনই সংখ্যা বসানোর সুযোগ দিলে ভুল/অসম্পূর্ণ ফলাফল আসার ঝুঁকি থাকতো
- Loads ট্যাবে ৫টা sub-tab: Patterns, Wind, EQ, Apply (element-এ load বসানো), Combos

**Phase 3-এ যাচাইকৃত সূত্র (এই sandbox-এ সংখ্যা দিয়ে টেস্ট করে):**
- BNBC 2020 Wind pressure: V=50m/s, Exposure B, h=20m কেসে design pressure 0.783 kN/m² — mid-rise building-এর জন্য প্রত্যাশিত রেঞ্জের (0.8-1.5) সীমান্তে, order-of-magnitude সঠিক
- BNBC 2020 Seismic base shear: ১০-তলা RC moment frame, Zone 3 কেসে base shear = seismic weight-এর 4.20% — প্রত্যাশিত 3-15% রেঞ্জে
- **সবচেয়ে গুরুত্বপূর্ণ যাচাই:** Seismic vertical distribution-এর সব story force-এর যোগফল ঠিক base shear-এর সমান (পার্থক্য 0.0000) — এই mathematical invariant fail করলে বুঝা যেত distribution logic-এ মৌলিক ভুল আছে

**সততার সাথে সীমাবদ্ধতা:** Wind/Seismic calculator দুটোই BNBC 2020-এর **সরলীকৃত প্রাথমিক পদ্ধতি** — rigid structure, নিয়মিত আকৃতি, ৪০-৬০ মিটারের নিচের ভবন ধরে নিয়ে। Flexible structure, উঁচু ভবন, বা irregular geometry-তে পূর্ণাঙ্গ BNBC 2020 Dynamic Analysis প্রয়োজন যা এই ক্যালকুলেটর করে না — উভয় প্যানেলেই সেই ক্ষেত্রে on-screen warning দেখায়।

---

### Phase 4a — FE Solver Integration (Linear Static Analysis)

- **নতুন "Analysis" ট্যাব** — `src/components/analysis-panel/AnalysisPanel.tsx`
- **Analysis orchestration** (`src/lib/analysis/runAnalysis.ts`) — Firestore থেকে পড়া elements/materials/sections/loadCases একত্র করে backend এর প্রত্যাশিত payload বানায় (section properties precompute করে), backend এর `/jobs/analysis` কল করে, ফলাফল টাইপ-নিরাপদ shape এ পার্স করে
- Backend-এ (`civilos-structural-solver` repo) C++ FE solver ইন্টিগ্রেট করা হয়েছে — বিস্তারিত সেই repo এর README এ, সংক্ষেপে: Direct Stiffness Method, 3D frame element, sparse Cholesky solver, pybind11 দিয়ে Python bridge
- **সব ইঞ্জিনিয়ারিং গণনা backend (C++) এ, frontend শুধু orchestration করে** — Master Plan এর মূল আর্কিটেকচারাল নিয়ম ("Solver কখনো JavaScript/TypeScript এ লিখবেন না") এখানে মানা হয়েছে

**⚠️ গুরুত্বপূর্ণ ফোল্ডার নাম পরিবর্তন:** `src/components/element-panel/` (singular)
থেকে **`src/components/elements-panel/`** (plural) এ rename করা হয়েছে
এই Phase এ — এটা Miftahul এর deploy environment এ Vercel এর
case-sensitive Linux build এর কারণে আগেই ঘটেছিল এবং কনফার্ম করা হয়েছে
এটাই এখন সঠিক অবস্থা। যদি আপনার লোকাল/GitHub এ এখনো `element-panel`
(singular) থাকে, এই zip সেটা প্রতিস্থাপন করবে `elements-panel`
(plural) দিয়ে — কোনো ম্যানুয়াল rename দরকার নেই, পুরো ফোল্ডারই zip এ
সঠিক নামে আছে।

**Phase 4a-তে যাচাইকৃত (backend README এ বিস্তারিত, সারাংশ):**
- Cantilever ও simply-supported beam — classical textbook সূত্রের সাথে exact numerical মিল
- Full HTTP pipeline (mm/MPa raw input থেকে C++ solver পর্যন্ত) — portal frame দিয়ে টেস্ট করা, base moment = force × arm length ভেরিফাই করা হয়েছে

**সততার সাথে সীমাবদ্ধতা (frontend এ প্রাসঙ্গিক অংশ, backend README এ পূর্ণাঙ্গ তালিকা):**
- শুধু Beam/Column/Brace/Pile সলভ হয় — Slab/Wall skip হয় (warning সহ)
- Brace এর pin-connection এখনো প্রয়োগ করা হয়নি (rigid হিসেবে সলভ হয়, warning সহ)
- Mid-span Point Load সঠিকভাবে হ্যান্ডল হয় না — nearest endpoint এ snap হয় (🔴 warning সহ, element নাম উল্লেখ করে)
- Support condition auto-detected (Y≈0 heuristic), manual support-definition UI এখনো নেই
- শুধু "linear-static" — বাকি ১৮টা analysis type 501 দেয়

`AnalysisPanel` এই সব warning সবসময় prominently দেখায়, success হলেও —
কারণ একটা "সফল" analysis-ও এমন approximation নিয়ে চলতে পারে যা
ইঞ্জিনিয়ারের জানা দরকার ফলাফল বিশ্বাস করার আগে।

---

## GitHub-এ পুশ করা

```bash
cd civilos-structural
git add -A
git commit -m "Phase 3: Loads, BNBC 2020 Wind/Seismic, Load Combinations"
git push
```

প্রথমবার হলে:
```bash
git init
git add -A
git commit -m "Phase 0-3: Complete structural modeling foundation through Loads"
git branch -M main
git remote add origin https://github.com/<আপনার-ইউজারনেম>/civilos-structural.git
git push -u origin main
```

---

## Vercel-এ Deploy করা

Vercel-এ ইতিমধ্যে কানেক্ট থাকলে `git push` করলেই deploy হবে, নতুন env
var লাগবে না। প্রথমবার হলে `.env.local.example` অনুযায়ী env vars বসান।

---

## Firebase Anonymous Auth ও Firestore Rules

Phase 1 থেকে যা সেটআপ করেছেন তাই যথেষ্ট। Phase 3-এর নতুন
`loadPatterns`/`loadCombinations`/`loadCases` collection গুলো
`projects/{projectId}/{document=**}` রিকার্সিভ wildcard rule-এর
অধীনেই কভার হয় — rules ফাইলে নতুন কিছু বদলাতে হয়নি।

---

## Deploy-পরবর্তী যাচাই (Phase 3)

```
https://<your-app>.vercel.app/model/demo-project
```

1. **Loads** ট্যাব → **Patterns** sub-tab এ গিয়ে একটা Dead Load ও একটা Live Load pattern তৈরি করুন
2. **Wind** sub-tab এ গিয়ে ডিফল্ট মান দিয়ে দেখুন Design Wind Pressure ও Base Shear estimate দেখাচ্ছে কিনা
3. **EQ** sub-tab এ গিয়ে দেখুন Base Shear ও Story Force Distribution টেবিল দেখাচ্ছে কিনা (একাধিক স্টোরি ভ্যালু, উপরে বেশি নিচে কম হওয়া উচিত)
4. **Elements** ট্যাবে একটা Beam তৈরি করুন (আগের Phase-এর মতোই)
5. **Loads → Apply** sub-tab এ গিয়ে সেই Beam সিলেক্ট করুন, Dead Load pattern বেছে "Uniform" টাইপে একটা intensity (যেমন -10 kN/m) বসান
6. **Combos** sub-tab এ গিয়ে দেখুন ৭টা ডিফল্ট ACI combination তালিকাভুক্ত আছে কিনা, একটা চেকবক্স টগল করে on/off করে দেখুন
7. পেজ রিফ্রেশ করে সব ডেটা টিকে আছে কিনা যাচাই করুন

**যদি Wind/Seismic ক্যালকুলেটরে কোনো সংখ্যা না দেখায়:** ইনপুট ফিল্ডে
সব মান পূরণ করা আছে কিনা এবং কোনোটা শূন্য/ঋণাত্মক না তা যাচাই করুন —
ফর্ম intentionally invalid input এ কোনো ফলাফল দেখায় না (silent failure
না, শুধু calculation না চালানো)।

---

## Deploy-পরবর্তী যাচাই (Phase 4a — সবচেয়ে গুরুত্বপূর্ণ নতুন অংশ)

এটাই প্রথমবার যেখানে backend-এর C++ solver সরাসরি frontend থেকে কল
হচ্ছে — নিশ্চিত করুন `civilos-structural-solver` আগে deploy হয়েছে
(নতুন Dockerfile সহ, C++ কম্পাইল করে) এবং তার URL ঠিকভাবে
`NEXT_PUBLIC_COMPUTE_SERVICE_URL` এ বসানো আছে।

একটা সহজ, নির্ভরযোগ্য টেস্ট কেস (mid-span load এড়িয়ে, যেটা এখনো
সীমাবদ্ধ):

1. **Materials** ট্যাবে একটা Concrete material যোগ করুন (fc'=28)
2. **Materials → Section** এ একটা Rectangular section যোগ করুন (300x500mm)
3. **Elements** ট্যাবে একটা Column তৈরি করুন: Start (0,0,0) → End (0,3,0)
4. **Loads → Patterns** এ একটা Dead Load pattern তৈরি করুন
5. **Loads → Apply** এ গিয়ে সেই Column সিলেক্ট করুন, "Point" টাইপ বেছে
   Force Y = -20, **Position = 1** (element এর একদম শেষ প্রান্তে, mid-span
   না — এটাই গুরুত্বপূর্ণ যাতে mid-span limitation এড়ানো যায়)
6. **Analysis** ট্যাবে যান, "▶ Run Analysis" চাপুন
7. **প্রত্যাশিত ফলাফল:**
   - "✓ Analysis সম্পন্ন" (সবুজ) দেখা উচিত, 2 node, 1 element
   - সতর্কতা সেকশনে একটা ℹ️ (base-support heuristic) warning থাকা
     উচিত, কিন্তু কোনো 🔴 (mid-span snap) warning **না** থাকা উচিত
     যেহেতু Position=1 ব্যবহার করা হয়েছে
   - Nodal Displacements এ node 1 (top) এ কিছু non-zero ux/uy/uz
     দেখা উচিত

**যদি "Analysis ব্যর্থ হয়েছে" দেখায় ৫০৩ error সহ:** backend এর
`civilos_solver` module ঠিকভাবে কম্পাইল/deploy হয়নি — backend README
এর "যদি build fail করে" সেকশন দেখুন, build log backend থেকে চেক করুন।

**যদি "Run Analysis" বাটন disabled থাকে:** উপরে দেওয়া ধাপগুলো ক্রম
অনুযায়ী সম্পূর্ণ করেছেন কিনা যাচাই করুন — বাটনের ঠিক উপরে কেন disabled
তার কারণ (amber রঙে) দেখানো থাকার কথা।

---

## লোকাল ডেভেলপমেন্ট

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## Build যাচাই

```bash
npm run build
```

---

## Workflow Layer — ৯-Stage Wizard (Phase 10 এর পরে, আলাদা sprint)

Master Plan এর "Workflow Layer" সেকশন অনুযায়ী এটা কোনো নতুন Phase না
— Phase 1-10 এ যা আগে থেকেই বসানো আছে (Geometry/Library/Elements/
Loads/Analysis/Validation/Design/Detailing ট্যাব) তার উপরে একটা UI
orchestration layer। `/model/[projectId]` পেজে এখন দুইটা মোড আছে:

- **Wizard Mode** (ডিফল্ট) — বাম পাশে ৯টা stage-এর progress sidebar
  (`src/components/workflow/WorkflowSidebar.tsx`): Preliminary → Model
  → Loads → Analysis → Design → Optimization → Verification →
  Documentation → Export। প্রতিটা stage ক্লিক করলে সংশ্লিষ্ট existing
  ট্যাবে/sub-ট্যাবে নিয়ে যায় — এটা কোনো নতুন panel বানায়নি, শুধু
  existing panel-গুলোকে গাইডেড ক্রমে সাজিয়ে দেখায়।
- **Expert Mode** — আগের মতোই flat tab sidebar (ডান পাশ), কোনো
  পরিবর্তন হয়নি।

top-left এ একটা Wizard/Expert টগল দিয়ে দুই মোডের মধ্যে যেকোনো সময়
সুইচ করা যায় (`src/components/workflow/WorkflowModeToggle.tsx`)।

**Progress কীভাবে গণনা হয়:** কোনো নতুন Firestore ফিল্ড বা flag তৈরি
করা হয়নি। `src/lib/workflow/useWorkflowProgress.ts` সরাসরি existing
store থেকে completion derive করে —

| Stage | সোর্স |
|---|---|
| Preliminary | Material + Section library (`useLibraryStore`) |
| Model | Grid/Story (`useGeometryStore`) + Elements (`useElementsStore`) |
| Loads | Pattern + প্রয়োগকৃত Load Case + সক্রিয় Combination (`useLoadStore`) |
| Analysis | সর্বশেষ সফল রান (`useAnalysisResultStore.sourceAnalysisType`) |
| Design | DCR record populated কিনা (`useDcrStore`, design panel সফল রান হলে push করে) |
| Optimization | ঐচ্ছিক ধাপ, design শুরু হলেই "available" |
| Verification | `runValidation` এর Health Score + error count |
| Documentation / Export | এখনো "শীঘ্রই আসছে" — Phase 11+ scope, কোনো report/export builder এখনো নেই |

এই approach এর সুবিধা: wizard বসানোর জন্য কোনো migration লাগেনি, এবং
ডেটা ও progress এর মধ্যে ডিসিঙ্ক হওয়ার সুযোগ নেই (progress আসলে
ডেটার-ই একটা derived view)।

**Gating নীতি — soft lock, hard block না:** একটা stage আগের stage
শুরু না হলে UI তে 🔒 দেখায়, কিন্তু ক্লিক করলে ব্লক হয় না — বরং একটা
ছোট কনফার্মেশন ("আগের ধাপ সম্পূর্ণ হয়নি, তবু যেতে চান?") দেখিয়ে
ইঞ্জিনিয়ারকে override করতে দেয়। এটা ইচ্ছাকৃত: বাস্তব স্ট্রাকচারাল
ডিজাইন workflow প্রায়ই non-linear (Analysis চালানোর পর Model এ ফিরে
গিয়ে element পরিবর্তন করা স্বাভাবিক), তাই hard-lock করলে সেই বাস্তব
কাজের ধরনটাই ব্লক করে ফেলত।

**নতুন ফাইল:**
```
src/lib/workflow/types.ts               — StageId/StageStatus/StageDef টাইপ
src/lib/workflow/stageTabs.ts           — ৯টা stage-এর সংজ্ঞা + tab mapping
src/lib/workflow/useWorkflowProgress.ts — existing store থেকে progress derive
src/lib/workflow/useWorkflowUiStore.ts  — wizard/expert টগল + active stage (session-only)
src/components/workflow/WorkflowSidebar.tsx    — বাম sidebar (progress bar + ৯টা stage card)
src/components/workflow/WorkflowModeToggle.tsx — Wizard/Expert সুইচ
src/components/workflow/ActiveStageBanner.tsx  — viewport overlay, বর্তমান stage-এর গাইডেন্স
```

`page.tsx` এ `SidebarTab`/`LoadSubTab`/`DesignSubTab` টাইপ তিনটা আগে
লোকাল ছিল, এখন `src/lib/workflow/stageTabs.ts` থেকে import হয় (single
source of truth, যাতে stage → tab mapping এবং page.tsx এর tab state
কখনো আলাদা হয়ে না যায়)। বাকি সব existing panel/hook/store অপরিবর্তিত।
