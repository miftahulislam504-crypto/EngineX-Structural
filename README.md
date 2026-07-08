# CivilOS — Structural Analysis & Design App

Hub-integrated স্ট্রাকচারাল অ্যানালাইসিস অ্যাপ। Next.js + Firebase
(Firestore/Auth/Storage), ভারী ক্যালকুলেশনের জন্য আলাদা compute
microservice (দেখুন `civilos-structural-solver` repo — মূল প্ল্যানে
Cloud Run ধরা ছিল, বর্তমানে Railway-তে হোস্ট করা হচ্ছে GCP-এর কার্ড
requirement এড়াতে; কোড/Dockerfile অপরিবর্তিত, শুধু deploy টার্গেট আলাদা)।

**এই App কখনো Project Create/Edit করে না** — সব প্রজেক্ট ডেটা Hub থেকে
আসে (`src/lib/hub/`, `src/lib/types/hub.ts`)।

---

## এখন পর্যন্ত কী বসানো হয়েছে (Phase 0 - Phase 3)

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
