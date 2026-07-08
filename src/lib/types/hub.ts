/**
 * Hub Integration Types
 *
 * এই ফাইলে Hub → Structural App ডেটা কনট্রাক্ট ডিফাইন করা আছে (Section 20)।
 * এই App কখনো Project Create/Edit করবে না — সব ডেটা Hub থেকে আসে।
 */

export type UserRole = "owner" | "editor" | "viewer";

export interface HubUserPermission {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface HubProjectInfo {
  projectId: string;
  projectName: string;
  clientName?: string;
  location?: {
    address: string;
    latitude?: number;
    longitude?: number;
  };
  createdAt: string; // ISO timestamp
  updatedAt: string;
  ownerUserId: string;
  permissions: HubUserPermission[];
  designCode: {
    concrete: "ACI-318-19" | "BNBC-2020" | "Eurocode-2" | "IS-456";
    steel: "AISC-360-16" | "Eurocode-3" | "IS-800";
    seismic: "BNBC-2020" | "ASCE-7-22" | "Eurocode-8";
    wind: "BNBC-2020" | "ASCE-7-22" | "Eurocode-1";
  };
}

export interface HubLevel {
  levelId: string;
  name: string;
  elevation: number; // meters, from base
  height: number; // storey height, meters
}

export interface HubGrid {
  gridId: string;
  label: string; // e.g. "A", "1"
  direction: "X" | "Y";
  coordinate: number; // meters from origin
}

export interface HubArchitecturalModel {
  modelId: string;
  version: number;
  levels: HubLevel[];
  grids: HubGrid[];
  // Reference geometry only — walls/slabs as drawn by the Architectural App,
  // NOT structural elements. Structural App interprets these as guides.
  referenceGeometryUrl: string; // Firebase Storage path to exported geometry (e.g. IFC/JSON)
  lastSyncedAt: string;
}

export interface HubMaterialLibraryEntry {
  materialId: string;
  name: string;
  type: "concrete" | "steel" | "timber" | "composite" | "masonry" | "other";
  properties: Record<string, number>; // e.g. { fc: 28, Ec: 25000, unitWeight: 24 }
  source: "hub-shared" | "user-defined";
}

export interface HubSiteInformation {
  soilType?: string;
  seismicZone?: string;
  windSpeed?: number; // basic wind speed, m/s
  exposureCategory?: string;
}

export interface HubGeotechnicalData {
  boreholeCount?: number;
  bearingCapacity?: number; // kPa
  waterTableDepth?: number; // meters
  reportUrl?: string; // Firebase Storage path to full geotech report
}

/**
 * পূর্ণাঙ্গ প্যাকেজ যা Hub এই App-কে দেয়, যখন একটা প্রজেক্ট খোলা হয়।
 */
export interface HubIncomingPackage {
  projectInfo: HubProjectInfo;
  architecturalModel: HubArchitecturalModel | null;
  materialLibrary: HubMaterialLibraryEntry[];
  siteInformation: HubSiteInformation | null;
  geotechnicalData: HubGeotechnicalData | null;
  sharedDocumentUrls: string[];
}
