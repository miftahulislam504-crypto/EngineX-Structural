/**
 * Firestore Schema — কেন্দ্রীয় path helper।
 *
 * নিয়ম: কোনো জায়গায় hand-typed collection path লেখা যাবে না।
 * সব সময় এই ফাংশনগুলা ব্যবহার করতে হবে, যাতে schema বদলালে
 * শুধু এই একটা ফাইল আপডেট করলেই চলে।
 *
 * Structure:
 *   projects/{projectId}                                  ← Hub owns this document
 *   projects/{projectId}/structuralModel/geometryCore      ← Grid/Story (Phase 1)
 *   projects/{projectId}/structuralModel/materialLibrary   ← Material library (Phase 2a+, single doc — সাধারণত কয়েকটা মাত্র material থাকে)
 *   projects/{projectId}/structuralModel/sectionLibrary    ← Section library (Phase 2a+, single doc — একই যুক্তি)
 *   projects/{projectId}/structuralModel/loadPatterns      ← Load Pattern list (Phase 3, single doc — সংখ্যায় কম, সাধারণত ১০-২০টার বেশি হয় না)
 *   projects/{projectId}/structuralModel/loadCombinations  ← Load Combination list (Phase 3, single doc — একই যুক্তি)
 *   projects/{projectId}/structuralElements/{elementId}    ← Beam/Column/Slab/... (subcollection, কারণ সংখ্যায় শত-হাজার হতে পারে)
 *   projects/{projectId}/elementDetailing/{elementId}      ← Phase 10j — প্রতি element-এর persisted rebar detailing result (subcollection, elements-এর সাথে ১:১, তাই একই sizing যুক্তি)
 *   projects/{projectId}/loadCases/{loadCaseId}            ← প্রতিটা element-এ প্রযুক্ত নির্দিষ্ট লোড (subcollection, কারণ প্রতিটা element একাধিক load case নিতে পারে — Materials/Sections/Patterns এর থেকে ভিন্ন, এটা elements-এর মতোই সংখ্যায় বড় হতে পারে)
 *   projects/{projectId}/analysisRuns/{runId}
 *   projects/{projectId}/analysisRuns/{runId}/results/{resultId}
 *   projects/{projectId}/designResults/{designId}
 *   projects/{projectId}/hubSync/outgoing                ← this app writes, Hub reads
 *   projects/{projectId}/hubSync/incoming                 ← Hub writes, this app reads
 */

export const firestorePaths = {
  project: (projectId: string) => `projects/${projectId}`,

  geometryCore: (projectId: string) =>
    `projects/${projectId}/structuralModel/geometryCore`,

  materialLibrary: (projectId: string) =>
    `projects/${projectId}/structuralModel/materialLibrary`,

  sectionLibrary: (projectId: string) =>
    `projects/${projectId}/structuralModel/sectionLibrary`,

  structuralElements: (projectId: string) =>
    `projects/${projectId}/structuralElements`,
  structuralElement: (projectId: string, elementId: string) =>
    `projects/${projectId}/structuralElements/${elementId}`,

  elementDetailingResults: (projectId: string) =>
    `projects/${projectId}/elementDetailing`,
  elementDetailingResult: (projectId: string, elementId: string) =>
    `projects/${projectId}/elementDetailing/${elementId}`,

  loadPatterns: (projectId: string) => `projects/${projectId}/structuralModel/loadPatterns`,

  loadCases: (projectId: string) => `projects/${projectId}/loadCases`,
  loadCase: (projectId: string, loadCaseId: string) =>
    `projects/${projectId}/loadCases/${loadCaseId}`,

  loadCombinations: (projectId: string) =>
    `projects/${projectId}/structuralModel/loadCombinations`,

  analysisRuns: (projectId: string) => `projects/${projectId}/analysisRuns`,
  analysisRun: (projectId: string, runId: string) =>
    `projects/${projectId}/analysisRuns/${runId}`,
  analysisResults: (projectId: string, runId: string) =>
    `projects/${projectId}/analysisRuns/${runId}/results`,

  designResults: (projectId: string) => `projects/${projectId}/designResults`,

  // Hub sync — Section 20 এর Integration Layer
  hubSyncOutgoing: (projectId: string) =>
    `projects/${projectId}/hubSync/outgoing`,
  hubSyncIncoming: (projectId: string) =>
    `projects/${projectId}/hubSync/incoming`,
} as const;
