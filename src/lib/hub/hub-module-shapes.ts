/**
 * Hub Module Data — Field Shapes (এই App-এর দিক থেকে)
 * ------------------------------------------------------------------
 * CPMS-এর src/lib/hub/module-data-shapes.ts এর same pattern অনুসরণ করে:
 * এই ফাইল Hub-এর ecosystem-এ producer app গুলোর real shape এই App-এর
 * consumer-দিক থেকে narrow করে।
 *
 * siteInfo/bnbcSettings/buildingInfo — এই তিনটার shape Hub-এর আসল কোড
 * (site-info.types.ts, bnbc.types.ts, building.types.ts) থেকে হুবহু
 * verified, CPMS-এর ফাইলের সাথেও character-for-character মেলানো (একই
 * Hub, একই schema — দুই app আলাদা shape দেখলে সেটা silent bug হবে)।
 *
 * ⚠️ Architectural section — সংশোধনী ইতিহাস: এই ফাইলের প্রথম সংস্করণে
 * (Phase 1) architectural module কে `moduleData/architectural`
 * structured-sync mechanism (module-data-sync.firestore.ts) থেকে আসবে
 * ধরে নেওয়া হয়েছিল, CPMS/Estimate-এর প্যাটার্ন অনুসরণ করে। দ্বিতীয়
 * সংস্করণে (তখনকার EngineXDraw hub-write.ts যাচাই করে) দেখা গিয়েছিল
 * Draw আসলে পুরনো `uploadModuleData()` (module-data.firestore.ts,
 * Storage-file + Firestore metadata pointer) ব্যবহার করছে।
 *
 * তৃতীয়, বর্তমান সংশোধনী (Hub-Structural integration bugfix, Phase 7-এর
 * আগে): Firebase free plan-এ Storage bucket তৈরি করা যায় না বলে সেই
 * Storage-based mechanism বাস্তবে কখনো কাজ করতো না (দুই দিকেই — Draw-এর
 * আপলোড আর এই App-এর ডাউনলোড)। Draw-এর হালনাগাদ hub-write.ts
 * (publishArchitecturalToHub()) এখন schedule ও পূর্ণ geometry দুটোই
 * একসাথে pure-Firestore `moduleData/architectural` document-এ লেখে —
 * অর্থাৎ প্রথম সংস্করণের অনুমান (moduleData mechanism) সঠিক দিক ছিল,
 * শুধু document-এর `data` object-এর ভেতরের key গুলো এখন schedule
 * (floorAreas/roomSchedule/...) ও geometry (levels/grids/elements/...)
 * দুটোই একসাথে ধারণ করে (একই document, দুই ভিন্ন consumer)। নিচের
 * architectural shape এখনো Draw-এর প্রকৃত `ArchitecturalExport` shape
 * থেকে হুবহু verified (apps/web/src/lib/hub/hub-write.ts) — শুধু এখন
 * সেই shape Storage JSON file-এর content না, বরং moduleData/architectural
 * document-এর `data` object-এর geometry-সংশ্লিষ্ট key গুলো (schedule key
 * গুলো এই App প্রয়োজন হয় না, ignore করে)।
 */

// ═══════════════════════════════════════════════════════════════════════
// Architectural (EngineXDraw → moduleData/architectural document-এর
// data object-এর geometry key গুলো — levels/grids/elements/shafts/
// siteBoundary/sheets/materials, schedule key গুলোর পাশাপাশি একই
// document-এ)
// ═══════════════════════════════════════════════════════════════════════
// contract.types.ts এর ProjectLevel/ProjectGrid/BuildingElementRef এর
// ওপর ভিত্তি করে — Draw-এর হুবহু ArchitecturalExport shape
// (apps/web/src/lib/hub/hub-write.ts এ verified)। ProjectLevel ও
// ProjectGrid ইতিমধ্যে contract.types.ts এ সংজ্ঞায়িত, তাই এখানে
// পুনরায় সংজ্ঞায়িত না করে re-export করা হচ্ছে।

export type { ProjectLevel, ProjectGrid, BuildingElementRef } from "./contract.types";
import type { ProjectLevel, ProjectGrid, BuildingElementRef } from "./contract.types";

/** Draw-এর object-model প্যাকেজের Point2D — সব plan geometry (start/end/center/boundary) এই shape ব্যবহার করে, মিটার এককে, floor-local XY প্লেনে (Structural-এর নিজস্ব XZ-plan/Y-elevation কনভেনশন থেকে ভিন্ন — দেখুন hub-geometry-parser.ts এর axis-mapping নোট)। */
export interface DrawPoint2D {
  x: number;
  y: number;
}

/**
 * BuildingElementRef.type === 'wall' | 'shear-wall' এর geometry payload —
 * Draw-এর Wall টাইপ থেকে হুবহু verified। দুইটা type-ই একই shape পাঠায়
 * (hub-write.ts) — Draw-এ Wall.isShearWall true হলে 'shear-wall', নাহলে
 * 'wall' হিসেবে export হয় (Miftahul, 2026-08-25)। এই App-এ mapWall()
 * সেই অনুযায়ী category বসায় (mapWall() এর নিজস্ব file comment দ্রষ্টব্য) —
 * আর কোনো thickness-ভিত্তিক অনুমান বা review-time checkbox override নেই,
 * classification সম্পূর্ণভাবে Draw-এর ইঞ্জিনিয়ারের এক্সপ্লিসিট flag থেকে আসে।
 */
export interface DrawWallGeometry {
  start: DrawPoint2D;
  end: DrawPoint2D;
  thickness: number; // মিটার
  height: number; // মিটার
  wallType: "EXTERIOR" | "INTERIOR" | "PARTITION";
  materialLabel?: string;
  libraryItemId?: string;
  fireRatingMinutes?: number;
}

/**
 * BuildingElementRef.type === 'parapet' এর geometry payload — Draw-এর
 * Parapet টাইপ থেকে হুবহু verified (hub-write.ts: `geometry: { start,
 * end, elevation, height, thickness, materialLabel, libraryItemId }`)।
 * Wall-এর মতোই একটা linear run, কিন্তু elevation ফিল্ড আছে (Wall-এ
 * নেই) কারণ parapet-এর base floor level-এ না, ছাদের কিনারায় বসে —
 * DrawStairGeometry-র মতো Wall-ভিত্তিক না হয়ে independent elevation
 * দরকার হয়।
 */
export interface DrawParapetGeometry {
  start: DrawPoint2D;
  end: DrawPoint2D;
  elevation: number; // মিটার — floor level থেকে parapet-এর নিজস্ব base
  height: number; // মিটার
  thickness: number; // মিটার
  materialLabel?: string;
  libraryItemId?: string;
}

/** BuildingElementRef.type === 'slab' এর geometry payload — Draw-এর Slab টাইপ থেকে হুবহু verified। */
export interface DrawSlabGeometry {
  boundary: DrawPoint2D[]; // polygon vertices, ক্রমানুসারে, auto-closed না
  thickness: number; // মিটার
  elevation: number; // মিটার — floor level থেকে বটম ফেসের উচ্চতা
  materialLabel?: string;
  libraryItemId?: string;
}

/** BuildingElementRef.type === 'column' এর geometry payload — Draw-এর Column টাইপ থেকে হুবহু verified। */
export interface DrawColumnGeometry {
  center: DrawPoint2D;
  shape: "RECTANGULAR" | "CIRCULAR";
  width: number; // মিটার — বৃত্তাকার হলে diameter
  depth: number; // মিটার — বৃত্তাকার হলে অপ্রাসঙ্গিক
  height: number; // মিটার
}

/** BuildingElementRef.type === 'beam' এর geometry payload — Draw-এর Beam টাইপ থেকে হুবহু verified। */
export interface DrawBeamGeometry {
  start: DrawPoint2D;
  end: DrawPoint2D;
  width: number; // মিটার
  depth: number; // মিটার, vertical dimension
  elevation: number; // মিটার — floor level থেকে সোফিট (নিচের তল) পর্যন্ত
}

/**
 * BuildingElementRef.type === 'footing' এর geometry payload — Draw-এর
 * Footing টাইপ (object-model/geometry.ts) থেকে হুবহু verified
 * (hub-write.ts: `geometry: { center, width, depth, thickness,
 * elevation }`)। Column-এর মতোই point element — center + plan
 * dimension দিয়ে সংজ্ঞায়িত, boundary polygon না।
 *
 * এটা আগে (Phase 2 আর্কিটেকচারাল ইম্পোর্টে) ইচ্ছাকৃতভাবে বাদ ছিল, কারণ
 * এই App-এর নিজস্ব FootingElement sizing calculation-এর আউটপুট
 * (footingSizing.ts) — Draw-এর architectural sketch থেকে সরাসরি
 * width/depth বসিয়ে দিলে ভুলবশত engineered dimension মনে হতে পারত।
 * এখন mapFooting() (hub-geometry-parser.ts) এটাকে "reference"
 * হিসেবে import করে — width/depth/thickness ঠিক Draw যা পাঠিয়েছে তাই
 * বসে (sizing override হয় না), কিন্তু importFootingReviewItem-এ সবসময়
 * "review-recommended" issue যোগ হয় যাতে ইঞ্জিনিয়ার এই dimension
 * bearing-capacity/BNBC check দিয়ে যাচাই না করে যেন সরাসরি design-এ
 * ব্যবহার না করেন (footingDesign.ts এর সাইজিং ওয়ার্কফ্লো আলাদা এবং
 * এখনো bearing capacity/soil data লাগে যা Draw পাঠায় না)।
 */
export interface DrawFootingGeometry {
  center: DrawPoint2D;
  width: number; // মিটার — plan dimension X-দিকে
  depth: number; // মিটার — plan dimension Z-দিকে (element.ts এ "length")
  thickness: number; // মিটার
  elevation: number; // মিটার — floor level থেকে, সাধারণত ঋণাত্মক (মাটির নিচে)
}

/**
 * Draw-এর একটা StairFlight — bottom→top একটা সরল ধাপ-সারি। Draw-এর
 * object-model প্যাকেজ (geometry.ts, Stair.flights) থেকে হুবহু
 * verified — riserHeight মিটার/ধাপ, treadDepth/waist-thickness Draw
 * পাঠায় না (architectural drawing-এ দরকার হয় না, শুধু structural
 * design-এর জন্য দরকার — parser এটা নিজে ধরে নেয়, mapStair() দেখুন)।
 */
export interface DrawStairFlight {
  start: DrawPoint2D;
  end: DrawPoint2D;
  numberOfSteps: number;
  riserHeight: number; // মিটার প্রতি ধাপ
}

/**
 * BuildingElementRef.type === 'stair' এর geometry payload — Draw-এর
 * Stair টাইপ থেকে হুবহু verified (hub-write.ts: `geometry: { width:
 * s.width, flights: s.flights }`)। flights bottom-to-top ক্রমে, একটা
 * এন্ট্রি মানে সোজা এক-flight সিঁড়ি, ২+ মানে L/U-shaped (turn সহ)।
 * elevation নেই (wall-এর মতোই levelId থেকে base elevation resolve
 * হয়)।
 */
export interface DrawStairGeometry {
  width: number; // মিটার — পুরো stair-এর জন্য একটাই, সব flight/landing-এ সমান
  flights: DrawStairFlight[];
}

/**
 * BuildingElementRef.type === 'stair-landing' এর geometry payload —
 * Stair implementation gap-closing pass (২০২৬-০৮)। আগে landing geometry
 * এখানে raw আসত না (এই কমেন্টেই আগে সেটা documented ছিল) — Draw-এর
 * core-engine এ deriveStairLandings() ইতিমধ্যে ছিল (2D plan + 3D
 * rendering-এর জন্য), কিন্তু hub-write.ts এটা কখনো কল করত না। এখন
 * করে, শুধু 'turn' kind landing-এর জন্য (দুই flight-এর মাঝের mid-run
 * প্ল্যাটফর্ম) — 'bottom'/'top' landing ইচ্ছাকৃতভাবে বাদ, কারণ সেগুলো
 * স্টোরির নিজস্ব floor level-এ বসে (elevation 0 বা stairTotalRise,
 * অর্থাৎ নিচের/উপরের তলার floor slab-এর সমান) এবং সেই floor-এর নিজস্ব
 * Slab element দিয়ে ইতিমধ্যে কাঠামোগতভাবে কভার্ড — আবার নতুন element
 * হিসেবে পাঠালে ডুপ্লিকেট self-weight/design হয়ে যেত (hub-write.ts এর
 * নিজস্ব কমেন্টে এই যুক্তি বিস্তারিত)। boundary CCW/CW ordering
 * deriveStairLandings()-এর buildTurnLandingBoundary() থেকে যেমন আসে
 * তেমনই — parser (mapStairLanding(), hub-geometry-parser.ts) নিজে
 * ordering ঠিক করে না, ধরে নেয় Draw সঠিক দেয়।
 */
export interface DrawStairLandingGeometry {
  boundary: DrawPoint2D[];
  elevation: number; // মিটার — stair-এর নিজস্ব floor level থেকে, StairFlight-এর মতোই
}

/**
 * Draw-এর ArchitecturalExport shape (hub-write.ts এর buildArchitecturalExport
 * এর রিটার্ন টাইপ, verified) — এইটাই ContractEnvelope.data হিসেবে
 * Storage JSON ফাইলে থাকে। shafts/siteBoundary/sheets/materials এই
 * App-এর Phase 2 স্কোপের বাইরে (geometry parser শুধু elements নিয়ে কাজ
 * করে) — তবু সম্পূর্ণ shape রাখা হলো যাতে ভবিষ্যতে দরকার হলে সরাসরি
 * ব্যবহার করা যায়, নতুন করে verify করতে না হয়।
 */
export interface DrawArchitecturalExport {
  levels: ProjectLevel[];
  grids: ProjectGrid[];
  elements: BuildingElementRef[];
  shafts: BuildingElementRef[];
  siteBoundary: BuildingElementRef | null;
  sheets: BuildingElementRef[];
  materials: { libraryItemId: string; name: string; unitWeightKnM3?: number; unitWeightKnM2?: number }[];
}

// ═══════════════════════════════════════════════════════════════════════
// Hub নিজস্ব (siteInfo/bnbcSettings/buildingInfo) — moduleData mechanism
// দিয়ে আসে না, Hub-এর মূল projects/{id}/... এর নিচে সরাসরি document।
// ═══════════════════════════════════════════════════════════════════════
// এই তিনটার shape Hub-এর আসল কোড থেকে হুবহু verified (lib/types/
// site-info.types.ts, bnbc.types.ts, building.types.ts) — অনুমান না।
// Path গুলো CPMS-এর module-data-shapes.ts-এ ইতিমধ্যে verified হিসেবে
// লেখা আছে:
//   projects/{id}/site_information/data
//   projects/{id}/bnbc_settings/data
//   projects/{id}/building_information/data

/** projects/{id}/site_information/data — Hub-এর site-info.types.ts এর সাথে হুবহু মেলানো */
export interface HubSiteInfoData {
  address: string;
  district: string;
  upazila: string;
  latitude?: number;
  longitude?: number;
  plotArea?: number;
  plotAreaUnit: "sqm" | "sqft" | "katha" | "bigha";
  roadWidth?: number;
  roadType?: "paved" | "unpaved" | "both";
  /** BNBC soil class, shear-wave-velocity-ভিত্তিক (vs) — Structural-এর SiteClass (SA-SE, BNBC 2020 Table 6.2.13) থেকে ভিন্ন নামকরণ। দেখুন deriveSiteClass.ts। */
  soilType: "S1" | "S2" | "S3" | "S4";
  climateZone?: "coastal" | "plain" | "hilly" | "haor_wetland";
  surveyNotes?: string;
  groundLevel?: number;
  floodLevel?: number;
  groundwaterDepth?: number;
  notes?: string;
}

/** projects/{id}/bnbc_settings/data — Hub-এর bnbc.types.ts এর সাথে হুবহু মেলানো (Design Code এর মূল উৎস) */
export interface HubBnbcSettingsData {
  occupancyType: "A" | "B" | "C" | "D" | "E" | "F";
  riskCategory: "I" | "II" | "III" | "IV";
  seismicZone: "Z1" | "Z2" | "Z3" | "Z4";
  seismicZoneCoeff: number;
  importanceFactor: number;
  windZone: "A" | "B" | "C";
  basicWindSpeed: number; // km/h — Structural-এর WindLoadInput.basicWindSpeed (m/s) থেকে ভিন্ন একক, deriveDefaults এ convert করা লাগবে (Phase 3)
  liveLoadType: string;
  liveLoadValue: number; // kN/m²
  soilType: "S1" | "S2" | "S3" | "S4";
  spectralAcceleration: number;
  responseModFactor: number;
  structuralSystem: string;
}

/** projects/{id}/building_information/data — Hub-এর building.types.ts এর সাথে হুবহু মেলানো (Number of Stories/Story Heights এর মূল উৎস) */
export interface HubBuildingInfoData {
  buildingType: "RCC" | "Steel" | "Masonry" | "Composite";
  usageType: string; // ফ্রি-টেক্সট Bengali label (USAGE_TYPES) — BnbcSettings.occupancyType (A-F) থেকে ভিন্ন, সরাসরি এক না
  structureSystem: string;
  numFloors: number;
  basementCount: number;
  floorHeight: number; // মিটার
  totalHeight: number; // মিটার
  groundFloorHeight: number; // মিটার
  roofType: "Flat" | "Sloped" | "Combined";
  buildingLength?: number;
  buildingWidth?: number;
  totalFloorArea?: number;
  hasLift: boolean;
  hasGenerator: boolean;
  hasWaterTank: boolean;
  hasParkingFloor: boolean;
}
