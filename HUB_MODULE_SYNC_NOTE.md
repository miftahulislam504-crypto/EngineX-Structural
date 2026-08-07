# Hub Module Data Sync — future integration note

এই নোট ভবিষ্যতের কাজের জন্য (Part 3 — Architectural Sync, Part 8 —
Documentation/BOQ export)। Phase 0.4-এর সাথে সরাসরি সম্পর্কিত না, কিন্তু
Hub-এর নতুন zip (Hub_com__1_.zip) দেখার সময় একটা গুরুত্বপূর্ণ পরিবর্তন
ধরা পড়েছে যা এখনই লিখে রাখা দরকার, নাহলে ভবিষ্যতে পুরনো/ভুল পথ অনুসরণ
করা হতে পারে।

## যা বদলেছে

Hub-এ একটা নতুন, **কার্যকর** real-time data-sync mechanism এসেছে:

```
hub.saveModuleData(projectId, 'structural', 'structural', data)
  → { newVersion: number }

hub.getModuleData(projectId, 'structural')
  → ModuleDataRecord | null

hub.subscribeToModuleData(projectId, 'structural', callback)
  → unsubscribe function
```

Firestore path: `projects/{projectId}/moduleData/structural` — একটা
document, ভেতরে `data` object-এ সব field একসাথে (module-level blob,
field-per-document না)।

## কেন এটা আগের ধারণা থেকে ভালো

আগে (Phase 0.3-এর অনুসন্ধানে) আমরা দেখেছিলাম Structural-এর নিজস্ব
`src/lib/firebase/schema.ts`-এ `hubSync/incoming` নামে একটা path আছে
(`firestorePaths.hubSyncIncoming`), কিন্তু Hub-এর দিকে এটা লেখার কোনো
কোড ছিল না — এটা ছিল একটা "aspirational contract", বাস্তবে কাজ করত না।

নতুন `moduleData/{moduleId}` mechanism **আলাদা এবং বাস্তবে কাজ করে**:
- Hub-এর দিকে write/read/subscribe সব wired, version bump ও
  approval-cascade (Phase 2/3 dependency system) automatic ভাবে যুক্ত
- Security rule আগে থেকেই cover করে (`projects/{projectId}/{document=**}`
  wildcard, Structural-এর `firestore.rules`-এও একই ধরনের wildcard আছে)
- শুধু producing/consuming app-এর কোডে SDK কল বসানো বাকি

## Structural-এর জন্য কী পাঠানো/পড়া দরকার হবে

`StructuralModuleData` ইন্টারফেস (Hub-এর `lib/types/module-data.types.ts`)
এ যা যা field আছে (এই মুহূর্তে সব `unknown` টাইপ, Structural-এর প্রকৃত
shape এখনো Hub-এ জানানো হয়নি):

- `concreteQuantities`, `reinforcementQuantities`, `formworkQuantities`,
  `excavationQuantities`, `backfillQuantities`, `foundationQuantities`,
  `beamColumnSlabQuantities`, `structuralSteelQuantities`,
  `shopDrawingRevision`, `wasteFactors`
- `bbs` (Bar Bending Schedule), `materialSummary`, `structuralActivities`,
  `castingSequence`, `structuralMilestones`, `shopDrawingStatus`,
  `inspectionStages`, `materialDemand`, `foundationSequence`,
  `inspectionStatus`, `designRevision`

এইগুলো মূলত **Part 8 (Documentation)**-এর আউটপুট — Quantity Extraction,
BBS, Cost/Material data। যখন Part 8-এর কাজ শুরু হবে, raw calculation
এর পাশাপাশি `hub.saveModuleData()` কল করে এই field গুলো Hub-এ পাঠানো
উচিত, যাতে Estimating App সেগুলো real-time subscribe করে BOQ বানাতে
পারে (Hub-এর নোটে উল্লেখিত exact ব্যবহার-কেস)।

## Part 3 (Architectural Sync)-এর জন্য প্রাসঙ্গিকতা

`ArchitecturalModuleData` (EngineXDraw থেকে আসা) তে `grid`, `levels`,
`columnLocations`, `wallLocations`, `slabBoundaries`, `openings`,
`stairGeometry`, `roofGeometry` — এই field গুলো ঠিক Part 3-এর জন্য দরকার।
তাই Part 3 শুরু হলে Structural-এর sync logic
(`src/lib/hub/sync.ts`, `firestorePaths.hubSyncIncoming`) **replace**
করা উচিত `hub.subscribeToModuleData(projectId, 'architectural', ...)`
দিয়ে — পুরনো `hubSync/incoming` পথ অনুসরণ না করে।

## এখন করণীয় না, তবে মনে রাখতে হবে

- Structural-এর কোডবেসে এই SDK এখনো কপি করা হয়নি (এটা Hub-এর
  `lib/hub-sdk.ts`, `lib/firestore/module-data-sync.firestore.ts`,
  `lib/types/module-data.types.ts` — তিনটা ফাইল Hub-এর repo-তে আছে,
  Structural-এর repo-তে না)।
- Part 3 বা Part 8 কাজ শুরু হলে প্রথমে Hub-এর সাম্প্রতিক zip থেকে এই
  তিনটা ফাইলের প্যাটার্ন Structural-এর `src/lib/hub/` এ পোর্ট করা উচিত
  (ঠিক যেভাবে Phase 0.3-এ EngineXDraw-এর `subscribeToMyProjects`
  পোর্ট করা হয়েছিল)।
- `StructuralModuleData`-এর `unknown` field গুলো তখন Structural-এর
  প্রকৃত calculation output টাইপ (যেমন `RcBeamDesignResult`,
  `ConcreteQuantitySummary`) দিয়ে replace করে Hub-এও জানিয়ে দেওয়া
  ভালো অভ্যাস হবে, যদিও Hub নিজে সেই টাইপ ছাড়াই কাজ করতে পারবে
  (`unknown` থাকলেও runtime এ কোনো সমস্যা হয় না, শুধু type-safety কম)।
