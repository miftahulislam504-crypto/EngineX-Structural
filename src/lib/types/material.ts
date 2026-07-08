/**
 * Material System Types
 * Phase 2a: Concrete + Steel (Section 3 এর প্রধান দুইটা)
 * Phase 2c: + Timber, Aluminium, FRP, Glass, Composite (বাকিগুলো)
 *
 * এই ফাইলের কাঠামো discriminated union ভিত্তিক, যাতে নতুন material
 * type যোগ করা existing অংশ না ভেঙে সম্ভব হয় — নতুন সদস্য যোগ করলে
 * TypeScript নিজেই বলে দেবে কোথায় switch/exhaustiveness check বাকি আছে।
 */

export type MaterialType = "concrete" | "steel" | "timber" | "aluminium" | "frp" | "glass" | "composite";

interface BaseMaterial {
  materialId: string;
  name: string; // ইউজার-দেওয়া নাম, যেমন "fc'=28 MPa Concrete", "Grade 60 Steel"
  type: MaterialType;
  source: "user-defined" | "hub-shared"; // hub-shared হলে HubMaterialLibraryEntry থেকে সিঙ্ক করা
  hubMaterialId?: string; // source === "hub-shared" হলে Hub-এর materialId রেফারেন্স
  createdAt: string;
  updatedAt: string;
}

/**
 * Concrete Material — ACI 318-19 কনভেনশন অনুসরণ করে।
 * fc' (compressive strength) থেকে Ec (elastic modulus) সাধারণত
 * ACI 318-19 Eq. 19.2.2.1.b দিয়ে হিসাব করা হয়: Ec = 4700√fc' (MPa এককে)।
 * এখানে Ec কে override করার সুযোগ রাখা হয়েছে (ইউজার চাইলে টেস্ট ডেটা
 * থেকে সরাসরি বসাতে পারবেন), কিন্তু না দিলে সূত্র থেকে হিসাব হবে।
 */
export interface ConcreteMaterial extends BaseMaterial {
  type: "concrete";
  fc: number; // f'c, compressive strength, MPa
  ec?: number; // elastic modulus override, MPa (না দিলে ACI সূত্র থেকে হিসাব)
  unitWeight: number; // kN/m³ (normal weight concrete: 24, lightweight: 15-20)
  poissonsRatio: number; // সাধারণত 0.2
  thermalExpansionCoefficient: number; // per °C, সাধারণত 10e-6
  shearModulus?: number; // G, MPa — override না দিলে G = Ec / (2(1+ν)) থেকে হিসাব
}

/**
 * Steel Material — AISC 360-16 কনভেনশন।
 */
export interface SteelMaterial extends BaseMaterial {
  type: "steel";
  fy: number; // yield strength, MPa
  fu: number; // ultimate tensile strength, MPa
  es: number; // elastic modulus, MPa (সাধারণত 200000 MPa, প্রায় সব স্টিলের জন্য ধ্রুবক)
  unitWeight: number; // kN/m³ (সাধারণত 78.5)
  poissonsRatio: number; // সাধারণত 0.3
  thermalExpansionCoefficient: number; // per °C, সাধারণত 12e-6
  grade?: string; // যেমন "ASTM A36", "ASTM A992", "Grade 60" — শুধু রেফারেন্সের জন্য, ক্যালকুলেশনে ব্যবহার হয় না
  shearModulus?: number; // G, MPa — override না দিলে G = Es / (2(1+ν)) থেকে হিসাব
}

/**
 * Timber Material — কাঠের গ্রেড অনুযায়ী মৌলিক properties। কাঠ
 * anisotropic (দিক অনুযায়ী ভিন্ন strength), কিন্তু এই স্কিমা
 * simplified — শুধু প্রধান (grain-parallel) দিকের মান রাখা হয়েছে,
 * যা preliminary design-এর জন্য যথেষ্ট। NDS (National Design
 * Specification for Wood Construction) সাধারণত রেফারেন্স কোড।
 */
export interface TimberMaterial extends BaseMaterial {
  type: "timber";
  bendingStrength: number; // Fb, MPa — allowable bending stress, grain-parallel
  elasticModulus: number; // E, MPa (সাধারণত 8000-13000 MPa কাঠের species/grade অনুযায়ী)
  unitWeight: number; // kN/m³ (সাধারণত 5-8 কাঠের ঘনত্ব অনুযায়ী)
  species?: string; // যেমন "Southern Pine", "Douglas Fir" — রেফারেন্সের জন্য
  grade?: string; // যেমন "No. 1", "Select Structural"
}

/** Aluminium Material — Aluminum Design Manual (ADM) কনভেনশন। */
export interface AluminiumMaterial extends BaseMaterial {
  type: "aluminium";
  fty: number; // yield strength (tension), MPa
  ftu: number; // ultimate strength (tension), MPa
  elasticModulus: number; // E, MPa (সাধারণত ~69000 MPa, স্টিলের প্রায় ১/৩)
  unitWeight: number; // kN/m³ (সাধারণত 27, স্টিলের প্রায় ১/৩)
  poissonsRatio: number; // সাধারণত 0.33
  alloy?: string; // যেমন "6061-T6" — রেফারেন্সের জন্য
}

/**
 * FRP (Fiber Reinforced Polymer) Material — মূলত strengthening/repair
 * এ ব্যবহৃত (যেমন CFRP wrap দিয়ে কলাম retrofit)। ACI 440 রেফারেন্স কোড।
 * FRP-এর গুরুত্বপূর্ণ boundary condition: এটা brittle (কোনো yield
 * পয়েন্ট নেই, সরাসরি ultimate পর্যন্ত linear elastic), তাই ductility
 * নেই — এটা design-এর সময় বিশেষ বিবেচনার বিষয়, যদিও এই টাইপ শুধু
 * material property ধরে, সেই design logic আলাদা (Phase 6 এ আসবে)।
 */
export interface FrpMaterial extends BaseMaterial {
  type: "frp";
  tensileStrength: number; // MPa — ultimate tensile strength (কোনো yield নেই)
  elasticModulus: number; // E, MPa (fiber type অনুযায়ী ভিন্ন: carbon ~230000, glass ~70000, aramid ~120000)
  unitWeight: number; // kN/m³
  fiberType?: "carbon" | "glass" | "aramid";
}

/** Glass Material — কাঠামোগত গ্লাস (structural glazing) এর জন্য। */
export interface GlassMaterial extends BaseMaterial {
  type: "glass";
  bendingStrength: number; // MPa — allowable/design bending stress (glass এর ক্ষেত্রে এটা annealed/tempered/laminated অনুযায়ী অনেক ভিন্ন হয়)
  elasticModulus: number; // E, MPa (সাধারণত ~70000 MPa, প্রায় সব ধরনের glass এর জন্য কাছাকাছি)
  unitWeight: number; // kN/m³ (সাধারণত 25)
  poissonsRatio: number; // সাধারণত 0.22
  glassType?: "annealed" | "tempered" | "laminated";
}

/**
 * Composite Material — সরলীকৃত মডেল। প্রকৃত composite action (যেমন
 * concrete-filled steel tube, বা steel-concrete composite beam) এর
 * সঠিক গণনা transformed-section পদ্ধতি দাবি করে, যেখানে দুইটা ভিন্ন
 * material-এর geometry ও property একসাথে বিবেচনা করতে হয় — সেটা
 * এখানকার single-material discriminated union এ ফিট করে না।
 *
 * তাই এই টাইপ একটা effective/equivalent property ধরে রাখে (ইউজার
 * নিজে হিসাব করে দেবেন, অথবা ভবিষ্যতে Phase 6 এর Composite Design
 * module এ transformed-section calculator যোগ হলে সেটা এই effective
 * property auto-generate করবে)। এটা v1-এর জন্য একটা সচেতন সরলীকরণ।
 */
export interface CompositeMaterial extends BaseMaterial {
  type: "composite";
  effectiveElasticModulus: number; // MPa — transformed/equivalent E
  effectiveUnitWeight: number; // kN/m³ — weighted average
  description?: string; // যেমন "Steel-Concrete Composite Beam", "CFST Column" — কী উপাদানের সমন্বয় তা বোঝাতে
}

export type StructuralMaterial =
  | ConcreteMaterial
  | SteelMaterial
  | TimberMaterial
  | AluminiumMaterial
  | FrpMaterial
  | GlassMaterial
  | CompositeMaterial;

/**
 * ACI 318-19 অনুযায়ী Ec হিসাব করে, যদি ইউজার নিজে override না দিয়ে থাকেন।
 */
export function computeConcreteEc(material: ConcreteMaterial): number {
  if (material.ec !== undefined) {
    return material.ec;
  }
  return 4700 * Math.sqrt(material.fc);
}

/**
 * Shear modulus G = E / (2(1+ν)) — আইসোট্রপিক ম্যাটেরিয়ালের জন্য
 * প্রযোজ্য (concrete ও steel দুটোই এই ধারণা মেনে চলে)।
 */
export function computeShearModulus(elasticModulus: number, poissonsRatio: number): number {
  return elasticModulus / (2 * (1 + poissonsRatio));
}

export function computeSteelShearModulus(material: SteelMaterial): number {
  if (material.shearModulus !== undefined) {
    return material.shearModulus;
  }
  return computeShearModulus(material.es, material.poissonsRatio);
}

/** নতুন Concrete Material তৈরির জন্য যুক্তিসঙ্গত ডিফল্ট মান। */
export function createDefaultConcreteMaterial(id: string, name: string): ConcreteMaterial {
  const now = new Date().toISOString();
  return {
    materialId: id,
    name,
    type: "concrete",
    source: "user-defined",
    fc: 28, // সাধারণ বাংলাদেশি প্র্যাকটিসে fc' = 28 MPa (4000 psi) একটা প্রচলিত মান
    unitWeight: 24,
    poissonsRatio: 0.2,
    thermalExpansionCoefficient: 10e-6,
    createdAt: now,
    updatedAt: now,
  };
}

/** নতুন Steel Material তৈরির জন্য যুক্তিসঙ্গত ডিফল্ট মান (ASTM A992, সাধারণত W-shape এর জন্য)। */
export function createDefaultSteelMaterial(id: string, name: string): SteelMaterial {
  const now = new Date().toISOString();
  return {
    materialId: id,
    name,
    type: "steel",
    source: "user-defined",
    fy: 345, // ASTM A992 এর ন্যূনতম yield strength, MPa
    fu: 450,
    es: 200000,
    unitWeight: 78.5,
    poissonsRatio: 0.3,
    thermalExpansionCoefficient: 12e-6,
    grade: "ASTM A992",
    createdAt: now,
    updatedAt: now,
  };
}

/** নতুন Timber Material তৈরির জন্য যুক্তিসঙ্গত ডিফল্ট মান (No. 2 Southern Pine এর কাছাকাছি)। */
export function createDefaultTimberMaterial(id: string, name: string): TimberMaterial {
  const now = new Date().toISOString();
  return {
    materialId: id,
    name,
    type: "timber",
    source: "user-defined",
    bendingStrength: 10, // MPa, No. 2 grade এর কাছাকাছি allowable stress
    elasticModulus: 11000,
    unitWeight: 6,
    species: "Southern Pine",
    grade: "No. 2",
    createdAt: now,
    updatedAt: now,
  };
}

/** নতুন Aluminium Material তৈরির জন্য যুক্তিসঙ্গত ডিফল্ট মান (6061-T6, সবচেয়ে সাধারণ structural alloy)। */
export function createDefaultAluminiumMaterial(id: string, name: string): AluminiumMaterial {
  const now = new Date().toISOString();
  return {
    materialId: id,
    name,
    type: "aluminium",
    source: "user-defined",
    fty: 240,
    ftu: 260,
    elasticModulus: 69000,
    unitWeight: 27,
    poissonsRatio: 0.33,
    alloy: "6061-T6",
    createdAt: now,
    updatedAt: now,
  };
}

/** নতুন FRP Material তৈরির জন্য যুক্তিসঙ্গত ডিফল্ট মান (CFRP, সবচেয়ে প্রচলিত strengthening ফাইবার)। */
export function createDefaultFrpMaterial(id: string, name: string): FrpMaterial {
  const now = new Date().toISOString();
  return {
    materialId: id,
    name,
    type: "frp",
    source: "user-defined",
    tensileStrength: 3800, // MPa, CFRP sheet এর typical মান
    elasticModulus: 230000,
    unitWeight: 18,
    fiberType: "carbon",
    createdAt: now,
    updatedAt: now,
  };
}

/** নতুন Glass Material তৈরির জন্য যুক্তিসঙ্গত ডিফল্ট মান (annealed glass)। */
export function createDefaultGlassMaterial(id: string, name: string): GlassMaterial {
  const now = new Date().toISOString();
  return {
    materialId: id,
    name,
    type: "glass",
    source: "user-defined",
    bendingStrength: 20, // MPa, annealed glass এর allowable design stress এর কাছাকাছি (রক্ষণশীল মান)
    elasticModulus: 70000,
    unitWeight: 25,
    poissonsRatio: 0.22,
    glassType: "annealed",
    createdAt: now,
    updatedAt: now,
  };
}

/** নতুন Composite Material তৈরির জন্য যুক্তিসঙ্গত ডিফল্ট মান (placeholder effective properties)। */
export function createDefaultCompositeMaterial(id: string, name: string): CompositeMaterial {
  const now = new Date().toISOString();
  return {
    materialId: id,
    name,
    type: "composite",
    source: "user-defined",
    effectiveElasticModulus: 150000, // steel ও concrete এর মাঝামাঝি একটা placeholder — ইউজারকে অবশ্যই প্রকৃত transformed-section মান বসাতে হবে
    effectiveUnitWeight: 50,
    description: "Steel-Concrete Composite",
    createdAt: now,
    updatedAt: now,
  };
}
