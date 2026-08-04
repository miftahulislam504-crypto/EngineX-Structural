/**
 * General Notes Data
 * Phase 10g — Detailing ইঞ্জিনের সপ্তম ধাপ।
 *
 * এই ফাইলে নতুন কোনো ইঞ্জিনিয়ারিং ফর্মুলা নেই — এটা শুধু প্রজেক্ট-লেভেল
 * design criteria/material/cover data আর Phase 10c-এর আগে থেকেই verified
 * ফাংশনগুলো (standard bar diameter রেঞ্জ জুড়ে) একটা সংগঠিত "General Notes"
 * ডেটা অবজেক্টে একত্র করে — ঠিক MICON রেফারেন্স PDF-এর General Notes
 * পাতার মতো (design criteria, material table, cover table, lap/development
 * length table, hook geometry table)। PDF/document output নিজে Hub-এর
 * কাজ (আগের সিদ্ধান্ত অনুযায়ী) — এই ফাইল শুধু ডেটা।
 */

import { REBAR_SIZES } from "@/lib/design/rebarSizes";
import {
  computeTensionDevelopmentLength,
  computeCompressionDevelopmentLength,
  computeTensionLapSpliceLength,
  computeCompressionLapSpliceLength,
  computeStandardHookDevelopmentLength,
  getStandardHookGeometry,
  type HookBendAngleDeg,
} from "@/lib/design/developmentLength";

export interface DesignCriteria {
  codeBasis: string[]; // যেমন ["BNBC 2020", "ACI 318-19"]
  windSpeedKmh?: number;
  seismicZone?: string;
  allowableSoilBearingCapacityKPa?: number;
}

export interface MaterialSpec {
  elementCategory: string; // "Column, Grade Beam" ইত্যাদি — MICON-এর মতো category-ভিত্তিক গ্রুপিং
  concreteFcMPa: number;
  reinforcementFyMPa: number;
}

export interface CoverRequirement {
  condition: string; // "Earth", "Earth & Water", "Exposed (Top/Side)" ইত্যাদি
  coverMm: number;
}

export interface ConcreteRequirement {
  maxSlumpMm: number;
  curingMethod: string;
  minCuringDays: number;
}

export interface DevelopmentLengthTableRow {
  barDiameterMm: number;
  tensionDevelopmentLengthMm: number;
  compressionDevelopmentLengthMm: number;
  tensionLapClassAMm: number;
  tensionLapClassBMm: number;
  compressionLapMm: number;
  hookDevelopmentLengthMm: number;
}

export interface HookGeometryTableRow {
  barDiameterMm: number;
  bendAngleDeg: HookBendAngleDeg;
  isStirrupOrTie: boolean;
  bendDiameterMm: number;
  extensionMm: number;
}

export interface GeneralNotesData {
  projectLabel: string;
  designCriteria: DesignCriteria;
  materials: MaterialSpec[];
  coverRequirements: CoverRequirement[];
  concreteRequirement: ConcreteRequirement;
  developmentLengthTable: DevelopmentLengthTableRow[];
  hookGeometryTable: HookGeometryTableRow[];
}

/**
 * Standard bar diameter রেঞ্জ জুড়ে development/lap/hook length টেবিল বানায়
 * — Phase 10c-এর ফাংশন reuse করে, কোনো নতুন হিসাব না। MICON-এর General
 * Notes পাতার lap-length টেবিলের কাঠামোর সাথে সামঞ্জস্যপূর্ণ।
 */
export function generateDevelopmentLengthTable(
  barDiametersMm: number[],
  fyMPa: number,
  fcMPa: number,
  clearCoverOrHalfSpacingMm: number,
): DevelopmentLengthTableRow[] {
  return barDiametersMm.map((barDiameterMm) => {
    const tension = computeTensionDevelopmentLength({ barDiameterMm, fyMPa, fcMPa, clearCoverOrHalfSpacingMm });
    const compressionDevelopmentLengthMm = computeCompressionDevelopmentLength({ barDiameterMm, fyMPa, fcMPa });
    const tensionLapClassAMm = computeTensionLapSpliceLength(tension.developmentLengthMm, "A");
    const tensionLapClassBMm = computeTensionLapSpliceLength(tension.developmentLengthMm, "B");
    const compressionLapMm = computeCompressionLapSpliceLength({ barDiameterMm, fyMPa, fcMPa }).spliceLengthMm;
    const hookDevelopmentLengthMm = computeStandardHookDevelopmentLength({ barDiameterMm, fyMPa, fcMPa });

    return {
      barDiameterMm,
      tensionDevelopmentLengthMm: tension.developmentLengthMm,
      compressionDevelopmentLengthMm,
      tensionLapClassAMm,
      tensionLapClassBMm,
      compressionLapMm,
      hookDevelopmentLengthMm,
    };
  });
}

/** Standard bar diameter × bend angle রেঞ্জ জুড়ে hook geometry টেবিল — Phase 10c-এর getStandardHookGeometry() reuse করে। */
export function generateHookGeometryTable(
  barDiametersMm: number[],
  bendAnglesDeg: HookBendAngleDeg[],
  isStirrupOrTie: boolean,
): HookGeometryTableRow[] {
  const rows: HookGeometryTableRow[] = [];
  for (const barDiameterMm of barDiametersMm) {
    for (const bendAngleDeg of bendAnglesDeg) {
      const geometry = getStandardHookGeometry({ barDiameterMm, bendAngleDeg, isStirrupOrTie });
      rows.push({ barDiameterMm, bendAngleDeg, isStirrupOrTie, bendDiameterMm: geometry.bendDiameterMm, extensionMm: geometry.extensionMm });
    }
  }
  return rows;
}

export interface AssembleGeneralNotesInput {
  projectLabel: string;
  designCriteria: DesignCriteria;
  materials: MaterialSpec[];
  coverRequirements: CoverRequirement[];
  concreteRequirement: ConcreteRequirement;
  fyMPa: number; // development/lap/hook টেবিল বানানোর জন্য প্রধান reinforcement grade
  fcMPa: number; // প্রধান structural concrete grade (একাধিক গ্রেড থাকলে সবচেয়ে বেশি ব্যবহৃতটা)
  clearCoverOrHalfSpacingMm: number; // ld টেবিলের জন্য typical cb ধরে নেওয়া হয়
  barDiametersMm?: number[]; // না দিলে REBAR_SIZES-এর পুরো ক্যাটালগ
}

/** সব কিছু একসাথে একটা GeneralNotesData অবজেক্টে সংগঠিত করে — pure aggregation, নতুন হিসাব নেই। */
export function assembleGeneralNotes(input: AssembleGeneralNotesInput): GeneralNotesData {
  const barDiametersMm = input.barDiametersMm ?? REBAR_SIZES.map((r) => r.diameterMm);

  return {
    projectLabel: input.projectLabel,
    designCriteria: input.designCriteria,
    materials: input.materials,
    coverRequirements: input.coverRequirements,
    concreteRequirement: input.concreteRequirement,
    developmentLengthTable: generateDevelopmentLengthTable(
      barDiametersMm,
      input.fyMPa,
      input.fcMPa,
      input.clearCoverOrHalfSpacingMm,
    ),
    hookGeometryTable: [
      ...generateHookGeometryTable(barDiametersMm, [90, 135, 180], false),
      ...generateHookGeometryTable(barDiametersMm, [90, 135], true),
    ],
  };
}
