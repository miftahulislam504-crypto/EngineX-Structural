"use client";

import { use } from "react";
import { AnalysisPanel } from "@/components/analysis-panel/AnalysisPanel";
import { useElementsCore } from "@/lib/elements/useElementsCore";
import { useMaterialSectionLibrary } from "@/lib/library/useMaterialSectionLibrary";
import { useLoadCore } from "@/lib/loads/useLoadCore";
import { DualPanelViewportShell } from "@/components/viewport/DualPanelViewportShell";

/**
 * Analysis route — Phase 4 (Panel Migration)।
 *
 * showDualPanel ক্যাটেগরি (elements এর সাথে shared shell — দেখুন
 * DualPanelViewportShell.tsx)।
 *
 * Redesign (২০২৬-০৮) — DualPanelViewportShell এর `topBar` prop
 * ব্যবহার করা হয়েছে (`panelOverlay` না) — AnalysisPanel এখন viewport-
 * এর উপরে একটা horizontal option bar হিসেবে বসে, কোনো ভাসমান card/
 * sheet নেই (Elements ট্যাব থেকে ভিন্ন, যেটা এখনো panelOverlay/⚙-sheet
 * প্যাটার্ন ব্যবহার করে — কারণ বলা আছে DualPanelViewportShell.tsx-এ)।
 *
 * ⚠️ এই page useElementsCore/useMaterialSectionLibrary/useLoadCore —
 * তিনটাই কল করে, কিন্তু তাদের return করা mutation action (addElement/
 * addMaterial/addLoadCase ইত্যাদি) কোনোটাই ব্যবহার করে না — শুধু hook
 * call করার side-effect (Firestore subscribe করে useElementsStore/
 * useLibraryStore/useLoadStore populate করা) দরকার, কারণ AnalysisPanel
 * এই তিনটা store থেকে সরাসরি read করে (elements/materials/sections —
 * AnalysisPanel.tsx এর নিজের import দেখুন), mutate করে না।
 *
 * কেন এই hook গুলো এখানে আবার কল করতে হচ্ছে (elements/page.tsx এ তো
 * useElementsCore already আছে): প্রতিটা domain hook এখন ঠিক এক
 * জায়গায় owned — কিন্তু Firestore subscription (onSnapshot) নিজেই
 * একাধিক independent listener সমর্থন করে বলে নিশ্চিত হওয়া গেছে
 * (subscribeToGeometryCore এর নিজস্ব comment: "৩D viewport ও ফর্ম UI
 * একসাথে খোলা থাকলে, বা একই ইউজারের দুই ট্যাবেও" — ঠিক এই ব্যবহারের
 * জন্যই ডিজাইন করা)। একই ইউজার elements/page.tsx না ঘুরে সরাসরি
 * /model/[id]/analysis এ deep-link করলে, useElementsStore এর
 * isLoading ডিফল্ট true-ই থেকে যেত (কখনো populate হতো না) যদি এই
 * page নিজে subscription ট্রিগার না করত — কারণ useElementsCore এর
 * useEffect শুধু তখনই চলে যখন কোনো component সেটা mount করে কল করে।
 * তাই এই তিনটা hook এখানে আবার কল করা (mutation action discard করেও)
 * genuinely প্রয়োজনীয়, শুধু defensive না। ছোট ট্রেড-অফ: প্রতিটা
 * consuming page (analysis, পরে design/optimization/documentation)
 * নিজের নিজের subscription + অব্যবহৃত action closure তৈরি করবে —
 * originally একটাই page.tsx এ সবকিছু mount হওয়ায় এই ওভারহেড ছিল না,
 * কিন্তু ডেটা correctness (deep-link এ সঠিক তথ্য দেখানো) এর তুলনায়
 * এই ছোট ওভারহেড গ্রহণযোগ্য ট্রেড-অফ।
 *
 * isLoading গেট এখানে ইচ্ছাকৃতভাবে নেই — AnalysisPanel নিজেই এই
 * তিনটা store এর isLoading চেক করে না (মূল page.tsx এও করত না,
 * AnalysisPanel এই কারণেই props হিসেবে শুধু projectId নেয়, loading
 * state না)।
 */
export default function AnalysisPage({ params }: PageProps<"/model/[projectId]/analysis">) {
  const { projectId } = use(params);

  useElementsCore(projectId);
  useMaterialSectionLibrary(projectId);
  useLoadCore(projectId);

  return (
    <DualPanelViewportShell projectId={projectId} topBar={<AnalysisPanel projectId={projectId} />} />
  );
}
