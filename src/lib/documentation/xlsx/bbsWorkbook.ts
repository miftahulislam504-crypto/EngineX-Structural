/**
 * BBS XLSX Export — Phase 11d
 *
 * প্লানের চাহিদা: "XLSX — একই ডেটা raw টেবিল আকারে (fabricator/সাইট
 * ব্যবহারের জন্য), sketch ছাড়া শুধু numeric কলাম"।
 *
 * PDF sheet এর (BbsSheetDocument.tsx) একই buildProjectBbs() আউটপুট
 * থেকে ডেটা নেয় — দুই ফরম্যাটেই একই সোর্স, শুধু presentation ভিন্ন।
 * একটা workbook এ প্রতিটা element category এর জন্য আলাদা worksheet
 * (Beam, Column, Slab, ইত্যাদি) + একটা "Summary" worksheet (dia-wise
 * grand total) — fabricator রা সাধারণত category-wise আলাদা শীট
 * পছন্দ করেন (শুধু "Beam" শীট প্রিন্ট করে সাইটে নিয়ে যাওয়া যায়),
 * একটা মনোলিথিক শীটে সব category মিশিয়ে না রেখে।
 *
 * @react-pdf/renderer থেকে আলাদা library (exceljs) — এই মডিউল PDF
 * কম্পোনেন্ট থেকে সম্পূর্ণ স্বতন্ত্র, Documentation stage UI (Phase
 * 11i) থেকে আলাদাভাবে ডাউনলোড অপশন হিসেবে কল হবে।
 *
 * লাইব্রেরি সিদ্ধান্ত (Phase 11d): exceljs বেছে নেওয়া হয়েছে SheetJS
 * (npm প্যাকেজ নাম "xlsx") এর বদলে — SheetJS এর npm-published সর্বশেষ
 * ভার্সন (0.18.5) এ unpatched high-severity vulnerability আছে (কোনো
 * নতুন প্যাচড ভার্সন npm registry তে নেই)। exceljs ও npm এ ৩ বছর ধরে
 * নতুন রিলিজ পায়নি (4.4.0 তে স্থবির), কিন্তু এর একমাত্র flagged
 * ট্রানজিটিভ vulnerability (uuid প্যাকেজে, GHSA-w5hq-g745-h8pq) শুধু
 * uuid এর v3()/v5()/v6() ফাংশনে প্রযোজ্য যেগুলো caller-provided buffer
 * নেয় — node_modules/exceljs সোর্স চেক করে নিশ্চিত করা হয়েছে exceljs
 * শুধু v4() ব্যবহার করে (cf-rule-ext-xform.js), যা এই vulnerability
 * থেকে সম্পূর্ণ মুক্ত। তাই exceljs ব্যবহার করা হলো, কিন্তু এই সিদ্ধান্ত
 * ভবিষ্যতে পুনর্মূল্যায়ন প্রয়োজন হতে পারে যদি কোনো actively-maintained
 * বিকল্প আসে (office-kit/xlsx এর মতো নতুন প্রজেক্ট আছে কিন্তু এখনো
 * প্রি-১.০, প্রোডাকশন-রেডি বলে যথেষ্ট প্রমাণিত না)।
 */

import ExcelJS from "exceljs";
import type { ReportContext } from "@/lib/documentation/reportContext";
import { buildProjectBbs, CATEGORY_LABEL } from "@/lib/documentation/compute/projectBbs";

const ENTRY_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "Bar Mark", key: "barMark", width: 14 },
  { header: "Element", key: "elementLabel", width: 14 },
  { header: "Shape", key: "shapeLabel", width: 12 },
  { header: "Dia (mm)", key: "barDiameterMm", width: 10 },
  { header: "Cut Length (mm)", key: "cutLengthMm", width: 16 },
  { header: "Count", key: "count", width: 8 },
  { header: "Total Length (m)", key: "totalLengthM", width: 16 },
  { header: "Unit Wt (kg/m)", key: "unitWeightKgPerM", width: 14 },
  { header: "Total Wt (kg)", key: "totalWeightKg", width: 14 },
];

const SHAPE_LABEL: Record<string, string> = {
  straight: "Straight",
  "stirrup-tie": "Stirrup/Tie",
  "l-bend": "L-Bend",
  "u-bend": "U-Bend",
};

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
}

/**
 * ProjectBbs থেকে একটা multi-sheet workbook বানায় — প্রতিটা element
 * category এর জন্য আলাদা worksheet, শেষে একটা dia-wise Summary
 * worksheet। buffer রিটার্ন করে (caller ফাইল হিসেবে সেভ করে বা
 * response এ পাঠায়)।
 */
export async function buildBbsWorkbook(context: ReportContext): Promise<ExcelJS.Buffer> {
  const bbs = buildProjectBbs(context);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CivilOS Structural — Documentation Engine";
  workbook.created = new Date(context.generatedAt);

  for (const group of bbs.groups) {
    const sheet = workbook.addWorksheet(CATEGORY_LABEL[group.category]);
    sheet.columns = ENTRY_COLUMNS;
    for (const entry of group.entries) {
      sheet.addRow({
        barMark: entry.barMark,
        elementLabel: entry.elementLabel,
        shapeLabel: SHAPE_LABEL[entry.visualShape],
        barDiameterMm: entry.barDiameterMm,
        cutLengthMm: Math.round(entry.cutLengthMm),
        count: entry.count,
        totalLengthM: Number(entry.totalLengthM.toFixed(2)),
        unitWeightKgPerM: Number(entry.unitWeightKgPerM.toFixed(3)),
        totalWeightKg: Number(entry.totalWeightKg.toFixed(2)),
      });
    }
    const subtotalRow = sheet.addRow({
      elementLabel: "Subtotal",
      totalWeightKg: Number(group.subtotalWeightKg.toFixed(2)),
    });
    subtotalRow.font = { bold: true };
    styleHeaderRow(sheet);
  }

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Diameter (mm)", key: "barDiameterMm", width: 14 },
    { header: "Total Count", key: "totalCount", width: 14 },
    { header: "Total Length (m)", key: "totalLengthM", width: 16 },
    { header: "Total Weight (kg)", key: "totalWeightKg", width: 16 },
  ];
  for (const row of bbs.diameterSummary) {
    summarySheet.addRow({
      barDiameterMm: row.barDiameterMm,
      totalCount: row.totalCount,
      totalLengthM: Number(row.totalLengthM.toFixed(1)),
      totalWeightKg: Number(row.totalWeightKg.toFixed(1)),
    });
  }
  const grandTotalRow = summarySheet.addRow({
    barDiameterMm: "Grand Total",
    totalWeightKg: Number(bbs.grandTotalWeightKg.toFixed(1)),
  });
  grandTotalRow.font = { bold: true };
  styleHeaderRow(summarySheet);

  return workbook.xlsx.writeBuffer();
}
