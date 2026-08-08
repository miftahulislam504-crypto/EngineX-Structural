/**
 * GET /api/documentation/[projectId]/[document] — Phase 11i
 *
 * Documentation Engine এর সব document (11c-11h) এখন পর্যন্ত শুধু library
 * code + smoke test হিসেবে ছিল — কোনো UI entry point ছিল না
 * (page.tsx এর TABS এ "documentation" নামে কোনো tab নেই, এই আপলোডে
 * verify করা হয়েছে)। এই route-ই প্রথম আসল download path।
 *
 * server-side রেন্ডারিং কেন — GeneralNotesPanel.tsx এর নিজস্ব কমেন্ট
 * ("PDF export Hub-এর কাজ, এটা শুধু ডেটা") আর next.config.ts এর
 * serverExternalPackages: ["@react-pdf/renderer"] সেটিং (Phase 11b
 * থেকেই — কমেন্টে স্পষ্ট: "Server Components bundling এর ভেতরে
 * বান্ডেল হলে ভাঙতে পারে") — দুটোই একসাথে নিশ্চিত করে যে renderToBuffer()
 * server-side (API route/Server Component) এ চালানোর কথা, client-side
 * PDFDownloadLink না (theme.ts এর comment এ PDFDownloadLink এর async
 * font-timing সমস্যাও উল্লেখ আছে, যেটা built-in font বেছে নেওয়ার
 * কারণগুলোর একটা)।
 *
 * route param shape — [document] একটা enum: "design-report" |
 * "bbs" | "calc-sheets" | "qc-report" | "general-notes" |
 * "drawing-sheets"। প্রতিটার জন্য আলাদা props shape (DesignReportDocument
 * এ structuralEngineerName ঐচ্ছিক, CalcSheetsDocument এ filterCategories,
 * বাকিদের শুধু context+revisionNumber) — তাই একটা switch দিয়ে সঠিক
 * component/props জোড়া বেছে নেওয়া হয়েছে, generic dispatch করার চেষ্টা
 * করা হয়নি (props shape ভিন্ন হওয়ায় generic করলে either type-unsafe
 * হতো, না হয় অতিরিক্ত জটিল)।
 *
 * revisionNumber ও filterCategories query string থেকে (?rev=A,
 * ?categories=beam,column) — কোনো persistent revision-tracking সিস্টেম
 * এই আপলোডে কোথাও নেই, তাই ডিফল্ট "A" আর undefined (সব category)।
 *
 * honest gap — S-01 (General Notes, Phase 11g) এখনো DrawingSheetsDocument
 * composer-এ bundle করা হয়নি (11h এর নিজস্ব memory নোটে flagged) —
 * তাই "drawing-sheets" ডাউনলোডে S-01 থাকবে না, আলাদা "general-notes"
 * ডাউনলোড করতে হবে। এই route সেই সীমাবদ্ধতা লুকায় না — নিচে
 * DOCUMENT_REGISTRY এর description এ স্পষ্ট লেখা আছে।
 */

import type { ReactElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { buildReportContext } from "@/lib/documentation/reportContext";
import { DesignReportDocument } from "@/lib/documentation/pdf/design-report/DesignReportDocument";
import { CalcSheetsDocument } from "@/lib/documentation/pdf/calc-sheets/CalcSheetsDocument";
import { BbsSheetDocument } from "@/lib/documentation/pdf/bbs/BbsSheetDocument";
import { QcReportDocument } from "@/lib/documentation/pdf/qc-report/QcReportDocument";
import { GeneralNotesSheet } from "@/lib/documentation/pdf/general-notes/GeneralNotesSheet";
import { DrawingSheetsDocument } from "@/lib/documentation/pdf/drawing-sheets/DrawingSheetsDocument";
import type { DesignElementCategory } from "@/lib/design/firestore";
import { DOCUMENT_KEYS, DOCUMENT_REGISTRY, isDocumentKey, type DocumentKey } from "@/lib/documentation/documentRegistry";

export { DOCUMENT_KEYS, DOCUMENT_REGISTRY, type DocumentKey };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; document: string }> }
) {
  const { projectId, document } = await params;

  if (!isDocumentKey(document)) {
    return NextResponse.json(
      { error: `Unknown document "${document}". Valid values: ${DOCUMENT_KEYS.join(", ")}` },
      { status: 400 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const revisionNumber = searchParams.get("rev") ?? "A";
  const categoriesParam = searchParams.get("categories");
  const filterCategories = categoriesParam
    ? (categoriesParam.split(",").filter(Boolean) as DesignElementCategory[])
    : undefined;

  let context;
  try {
    context = await buildReportContext(projectId);
  } catch (err) {
    // buildReportContext() এর ভেতরের error shape এই আপলোডে নিশ্চিত না
    // (reportContext.ts এর ভেতরের try/catch behavior দেখা যায়নি) —
    // তাই generic 500, কিন্তু আসল message client কে জানানো হয় debug
    // এর জন্য।
    const message = err instanceof Error ? err.message : "Failed to build report context";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const projectName = context.hub?.projectInfo?.projectName ?? "Untitled Project";
  const filename = DOCUMENT_REGISTRY[document].filename(projectName);

  let element: ReactElement;
  switch (document) {
    case "design-report":
      element = <DesignReportDocument context={context} revisionNumber={revisionNumber} />;
      break;
    case "bbs":
      element = <BbsSheetDocument context={context} revisionNumber={revisionNumber} />;
      break;
    case "calc-sheets":
      element = <CalcSheetsDocument context={context} filterCategories={filterCategories} />;
      break;
    case "qc-report":
      element = <QcReportDocument context={context} revisionNumber={revisionNumber} />;
      break;
    case "general-notes":
      element = <GeneralNotesSheet context={context} revisionNumber={revisionNumber} />;
      break;
    case "drawing-sheets":
      element = <DrawingSheetsDocument context={context} revisionNumber={revisionNumber} />;
      break;
  }

  // switch-এর প্রতিটা case একটা react-pdf <Document> রুট রিটার্ন করে
  // (DesignReportDocument, BbsSheetDocument ইত্যাদি সবই এই কনভেনশন
  // মেনে চলে), কিন্তু TypeScript variable-টাকে generic ReactElement
  // হিসেবে ইনফার করে (props: unknown) কারণ ছয়টা ভিন্ন কম্পোনেন্টের
  // রিটার্ন টাইপ union করা হয়েছে। renderToBuffer() এর সিগনেচার
  // ReactElement<DocumentProps> চায় — তাই এখানে assert করা হলো,
  // switch-এর প্রতিটা branch সত্যিকারের react-pdf Document element
  // দিচ্ছে তা কোড রিভিউ থেকে নিশ্চিত হয়েই।
  const buffer = await renderToBuffer(element as ReactElement<DocumentProps>);

  // Node Buffer, Uint8Array-এর subclass — Fetch স্ট্যান্ডার্ড অনুযায়ী
  // সরাসরি valid BodyInit, তাই কোনো conversion লাগে না।
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
