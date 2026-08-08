/**
 * ReportSheetPage — Phase 11b
 *
 * ReportPage (body-section wrapper, Design Report এর জন্য) আর
 * Titleblock (এই ফোল্ডারেই) — এই দুটো একসাথে জুড়ে Drawing Sheet
 * এর (S-00 থেকে S-11, Phase 11h) জন্য প্রস্তুত composed wrapper।
 * প্রতিটা sheet component (BeamLayoutSheet, ColumnScheduleSheet
 * ইত্যাদি, Phase 11h) সরাসরি এটাই ব্যবহার করবে — নিজে Titleblock
 * বসানো লাগবে না, ভুলে বাদ পড়ারও সুযোগ থাকবে না।
 *
 * ডিফল্ট landscape A3 রাখা হয়েছে (মূল প্লানের নোট: "প্রতিটা sheet
 * standard size যেমন A1/A3-এ scale-accurate") — কিন্তু S-06/S-07 এর
 * মতো কিছু detailing sheet এ বড় বিল্ডিং হলে portrait ভালো ফিট করতে
 * পারে, তাই orientation override করার সুযোগ রাখা হলো।
 */

import { View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { ReportPage, type ReportPageOrientation } from "@/lib/documentation/pdf/components/ReportPage";
import { Titleblock, type TitleblockProps } from "@/lib/documentation/pdf/components/Titleblock";

export interface ReportSheetPageProps extends TitleblockProps {
  orientation?: ReportPageOrientation;
  /** sheet এর মূল ড্রয়িং area — titleblock এর উপরে বসবে, ফাঁকা জায়গা flex দিয়ে drawing content নেবে। */
  children: ReactNode;
}

export function ReportSheetPage({
  orientation = "landscape",
  children,
  ...titleblockProps
}: ReportSheetPageProps) {
  return (
    <ReportPage
      size="A3"
      orientation={orientation}
      footerLabel={`${titleblockProps.sheetNumber} — ${titleblockProps.sheetTitle}`}
    >
      <View style={{ flex: 1 }}>{children}</View>
      <Titleblock {...titleblockProps} />
    </ReportPage>
  );
}
