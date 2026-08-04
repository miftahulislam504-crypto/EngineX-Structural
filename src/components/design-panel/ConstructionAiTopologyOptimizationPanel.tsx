"use client";

import { useState } from "react";
import {
  runConstructionOptimization,
  runAiOptimization,
  runTopologyOptimization,
  CONSTRUCTION_OPTIMIZATION_TEMPLATE,
  AI_OPTIMIZATION_TEMPLATE,
  TOPOLOGY_OPTIMIZATION_TEMPLATE,
  type ConstructionOptimizationGoal,
  type AiOptimizationTarget,
  type TopologyOptimizationMethod,
  type ConstructionOptimizationResult,
  type AiOptimizationResult,
  type TopologyOptimizationResult,
} from "@/lib/design/constructionAiTopologyOptimization";

const CONSTRUCTION_GOAL_LABELS: Record<ConstructionOptimizationGoal, string> = {
  "minimize-total-duration": "Minimize Total Duration",
  "minimize-crane-moves": "Minimize Crane Moves",
  "maximize-formwork-reuse": "Maximize Formwork Reuse",
  "minimize-resource-conflicts": "Minimize Resource Conflicts",
};

const AI_TARGET_LABELS: Record<AiOptimizationTarget, string> = {
  foundation: "Foundation",
  section: "Section",
  weight: "Weight",
  cost: "Cost",
  "combined-multi-objective": "Combined Multi-Objective",
};

const TOPOLOGY_METHOD_LABELS: Record<TopologyOptimizationMethod, string> = {
  simp: "SIMP (Solid Isotropic Material with Penalization)",
  "level-set": "Level-Set Method",
  beso: "BESO (Bi-directional Evolutionary Structural Optimization)",
  eso: "ESO (Evolutionary Structural Optimization)",
};

type Mode = "construction" | "ai" | "topology";

/**
 * Construction / AI / Topology Optimization (Phase 9e) — তিনটাই
 * framework placeholder, master plan অনুযায়ী। 9a-9d এর মতো কোনো
 * বাস্তব candidate-sweep/takeoff এখানে নেই — প্রতিটা mode শুধু
 * problem shape preview করে এবং কেন এখনো implement করা যায়নি তার
 * স্পষ্ট কারণ দেখায় (module docstring দেখুন)।
 */
export function ConstructionAiTopologyOptimizationPanel() {
  const [mode, setMode] = useState<Mode>("construction");

  const [constructionGoal, setConstructionGoal] = useState<ConstructionOptimizationGoal>(
    CONSTRUCTION_OPTIMIZATION_TEMPLATE.goal
  );
  const [numberOfStories, setNumberOfStories] = useState(String(CONSTRUCTION_OPTIMIZATION_TEMPLATE.numberOfStories));
  const [constructionResult, setConstructionResult] = useState<ConstructionOptimizationResult | null>(null);

  const [aiTarget, setAiTarget] = useState<AiOptimizationTarget>(AI_OPTIMIZATION_TEMPLATE.target);
  const [aiResult, setAiResult] = useState<AiOptimizationResult | null>(null);

  const [topologyMethod, setTopologyMethod] = useState<TopologyOptimizationMethod>(
    TOPOLOGY_OPTIMIZATION_TEMPLATE.method
  );
  const [targetVolumeFraction, setTargetVolumeFraction] = useState(
    String(TOPOLOGY_OPTIMIZATION_TEMPLATE.targetVolumeFraction)
  );
  const [topologyResult, setTopologyResult] = useState<TopologyOptimizationResult | null>(null);

  function handleRunConstruction() {
    setConstructionResult(
      runConstructionOptimization({
        goal: constructionGoal,
        numberOfStories: Number(numberOfStories) || 1,
        notes: CONSTRUCTION_OPTIMIZATION_TEMPLATE.notes,
      })
    );
  }

  function handleRunAi() {
    setAiResult(
      runAiOptimization({
        target: aiTarget,
        notes: AI_OPTIMIZATION_TEMPLATE.notes,
      })
    );
  }

  function handleRunTopology() {
    setTopologyResult(
      runTopologyOptimization({
        method: topologyMethod,
        targetVolumeFraction: Number(targetVolumeFraction) || 0.4,
        notes: TOPOLOGY_OPTIMIZATION_TEMPLATE.notes,
      })
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-1">Construction / AI / Topology Optimization</h3>
        <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-md px-2.5 py-2 mb-3">
          Framework placeholders (Phase 9e) — তিনটাই এখনো কোনো বাস্তব অ্যালগরিদম চালায় না। প্রকৃত optimization
          এখন যেটা কাজ করে তা হলো 9a (Foundation) / 9b (Section) / 9c (Weight) / 9d (Cost) — এই ট্যাব শুধু কেন এই
          তিনটা এখনো implement করা যায়নি তার কারণ ব্যাখ্যা করে।
        </p>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode("construction")}
            className={`flex-1 rounded-md text-xs font-medium py-1.5 transition-colors ${
              mode === "construction" ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            Construction
          </button>
          <button
            type="button"
            onClick={() => setMode("ai")}
            className={`flex-1 rounded-md text-xs font-medium py-1.5 transition-colors ${
              mode === "ai" ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            AI
          </button>
          <button
            type="button"
            onClick={() => setMode("topology")}
            className={`flex-1 rounded-md text-xs font-medium py-1.5 transition-colors ${
              mode === "topology" ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            Topology
          </button>
        </div>
      </div>

      {mode === "construction" && (
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Optimization Goal</label>
            <select
              value={constructionGoal}
              onChange={(e) => setConstructionGoal(e.target.value as ConstructionOptimizationGoal)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
            >
              {(Object.keys(CONSTRUCTION_GOAL_LABELS) as ConstructionOptimizationGoal[]).map((g) => (
                <option key={g} value={g}>
                  {CONSTRUCTION_GOAL_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Number of Stories</label>
            <input
              type="number"
              value={numberOfStories}
              onChange={(e) => setNumberOfStories(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>
          <button
            type="button"
            onClick={handleRunConstruction}
            className="w-full rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 transition-colors"
          >
            Preview Problem Definition
          </button>
          {constructionResult && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
              <p className="text-xs text-slate-400 leading-relaxed">{constructionResult.message}</p>
            </div>
          )}
        </div>
      )}

      {mode === "ai" && (
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Optimization Target</label>
            <select
              value={aiTarget}
              onChange={(e) => setAiTarget(e.target.value as AiOptimizationTarget)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
            >
              {(Object.keys(AI_TARGET_LABELS) as AiOptimizationTarget[]).map((t) => (
                <option key={t} value={t}>
                  {AI_TARGET_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleRunAi}
            className="w-full rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 transition-colors"
          >
            Preview Problem Definition
          </button>
          {aiResult && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
              <p className="text-xs text-slate-400 leading-relaxed">{aiResult.message}</p>
            </div>
          )}
        </div>
      )}

      {mode === "topology" && (
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Method</label>
            <select
              value={topologyMethod}
              onChange={(e) => setTopologyMethod(e.target.value as TopologyOptimizationMethod)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
            >
              {(Object.keys(TOPOLOGY_METHOD_LABELS) as TopologyOptimizationMethod[]).map((m) => (
                <option key={m} value={m}>
                  {TOPOLOGY_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Target Volume Fraction (0-1)</label>
            <input
              type="number"
              step="any"
              value={targetVolumeFraction}
              onChange={(e) => setTargetVolumeFraction(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>
          <button
            type="button"
            onClick={handleRunTopology}
            className="w-full rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 transition-colors"
          >
            Preview Problem Definition
          </button>
          {topologyResult && (
            <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2.5">
              <p className="text-xs text-slate-400 leading-relaxed">{topologyResult.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
