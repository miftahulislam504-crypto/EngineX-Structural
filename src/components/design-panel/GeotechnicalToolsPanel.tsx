"use client";

import { useState } from "react";
import {
  computeBearingCapacity,
  type BearingCapacityMethod,
  type FootingShape,
  type BearingCapacityResult,
} from "@/lib/design/bearingCapacity";
import {
  computeElasticSettlement,
  computeConsolidationSettlement,
  checkTotalSettlement,
  type FootingRigidity,
  type TotalSettlementResult,
} from "@/lib/design/settlementAnalysis";
import {
  computeSubgradeReactionModulus,
  computeSoilSpringStiffness,
  type SubgradeReactionMethod,
  type SubgradeReactionResult,
} from "@/lib/design/soilSpring";

function fmt(v: number, decimals = 1): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

type Tool = "bearing-capacity" | "settlement" | "soil-spring";

/**
 * Phase 7e — Geotechnical Tools panel। Standalone calculator (কোনো
 * model element bound না, RetainingWallDesignPanel এর মতো) — Bearing
 * Capacity derivation, Settlement analysis, Soil Spring (Winkler ks)
 * তিনটা আলাদা sub-tool একসাথে, কারণ তিনটাই একই geotechnical-input
 * চরিত্রের ছোট স্বাধীন calculator (আলাদা তিনটা design-tab বানানো
 * অপ্রয়োজনীয় হতো)। এই app কোনো geotechnical analysis করে না — সব
 * soil parameter (φ, c, γ, Es, Cc, ইত্যাদি) geotechnical report থেকে
 * ইঞ্জিনিয়ার সরবরাহ করেন।
 */
export function GeotechnicalToolsPanel() {
  const [tool, setTool] = useState<Tool>("bearing-capacity");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Geotechnical Tools</h3>
        <p className="text-xs text-text-muted mb-3">
          Bearing capacity derivation, settlement analysis, and soil spring (Winkler) calculators.
        </p>
        <p className="text-xs text-status-holdText bg-status-holdBg border border-status-holdBorder rounded-md px-2.5 py-2 mb-3">
          This app does not perform geotechnical analysis (no SPT/CPT interpretation, no boring-log processing) —
          all soil parameters below must come from your geotechnical report.
        </p>

        <div className="flex gap-1.5 mb-3">
          {(
            [
              ["bearing-capacity", "Bearing Capacity"],
              ["settlement", "Settlement"],
              ["soil-spring", "Soil Spring"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id)}
              className={`flex-1 rounded-md text-xs font-medium py-1.5 transition-colors ${
                tool === id ? "bg-brand-600 text-white" : "bg-surface-card border border-surface-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tool === "bearing-capacity" && <BearingCapacityTool />}
      {tool === "settlement" && <SettlementTool />}
      {tool === "soil-spring" && <SoilSpringTool />}
    </div>
  );
}

function BearingCapacityTool() {
  const [method, setMethod] = useState<BearingCapacityMethod>("meyerhof");
  const [footingShape, setFootingShape] = useState<FootingShape>("square");
  const [frictionAngleDeg, setFrictionAngleDeg] = useState("30");
  const [cohesionKPa, setCohesionKPa] = useState("0");
  const [soilUnitWeightKNPerM3, setSoilUnitWeightKNPerM3] = useState("18");
  const [footingDepthM, setFootingDepthM] = useState("1.5");
  const [footingWidthM, setFootingWidthM] = useState("2");
  const [footingLengthM, setFootingLengthM] = useState("2");
  const [factorOfSafety, setFactorOfSafety] = useState("3");
  const [waterTableDepthM, setWaterTableDepthM] = useState("");

  const [result, setResult] = useState<BearingCapacityResult | null>(null);

  function handleCompute() {
    const r = computeBearingCapacity({
      method,
      footingShape,
      frictionAngleDeg: Number(frictionAngleDeg) || 0,
      cohesionKPa: Number(cohesionKPa) || 0,
      soilUnitWeightKNPerM3: Number(soilUnitWeightKNPerM3) || 0,
      footingDepthM: Number(footingDepthM) || 0,
      footingWidthM: Number(footingWidthM) || 0,
      footingLengthM: footingShape === "rectangular" ? Number(footingLengthM) || undefined : undefined,
      factorOfSafety: Number(factorOfSafety) || 3,
      waterTableDepthM: waterTableDepthM.trim() !== "" ? Number(waterTableDepthM) : undefined,
    });
    setResult(r);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as BearingCapacityMethod)}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
        >
          <option value="terzaghi">Terzaghi</option>
          <option value="meyerhof">Meyerhof</option>
        </select>
        <select
          value={footingShape}
          onChange={(e) => setFootingShape(e.target.value as FootingShape)}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
        >
          <option value="strip">Strip</option>
          <option value="square">Square</option>
          <option value="circular">Circular</option>
          <option value="rectangular">Rectangular</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Friction Angle φ (°)</label>
          <input
            type="number"
            step="any"
            value={frictionAngleDeg}
            onChange={(e) => setFrictionAngleDeg(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Cohesion c (kPa)</label>
          <input
            type="number"
            step="any"
            value={cohesionKPa}
            onChange={(e) => setCohesionKPa(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Soil Unit Weight γ (kN/m³)</label>
          <input
            type="number"
            step="any"
            value={soilUnitWeightKNPerM3}
            onChange={(e) => setSoilUnitWeightKNPerM3(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Footing Depth Df (m)</label>
          <input
            type="number"
            step="any"
            value={footingDepthM}
            onChange={(e) => setFootingDepthM(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Footing Width B (m)</label>
          <input
            type="number"
            step="any"
            value={footingWidthM}
            onChange={(e) => setFootingWidthM(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        {footingShape === "rectangular" && (
          <div>
            <label className="block text-xs text-text-muted mb-1">Footing Length L (m)</label>
            <input
              type="number"
              step="any"
              value={footingLengthM}
              onChange={(e) => setFootingLengthM(e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Factor of Safety</label>
          <input
            type="number"
            step="any"
            value={factorOfSafety}
            onChange={(e) => setFactorOfSafety(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Water Table Depth (m, optional)</label>
          <input
            type="number"
            step="any"
            value={waterTableDepthM}
            onChange={(e) => setWaterTableDepthM(e.target.value)}
            placeholder="dry if blank"
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleCompute}
        className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
      >
        ▶ Compute Bearing Capacity
      </button>

      {result && (
        <div className="space-y-3">
          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
            <p className="text-xs text-text-muted font-medium mb-1">Bearing Capacity Factors</p>
            <p className="text-xs text-text-secondary">
              Nc = {fmt(result.factors.Nc, 2)}, Nq = {fmt(result.factors.Nq, 2)}, Nγ = {fmt(result.factors.Ngamma, 2)}
            </p>
          </div>
          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1">
            <p className="text-xs text-text-muted font-medium mb-1">Result</p>
            <p className="text-xs text-text-secondary">Ultimate qu = {fmt(result.ultimateBearingCapacityKPa)} kPa</p>
            <p className="text-xs text-text-secondary">Net ultimate = {fmt(result.netUltimateBearingCapacityKPa)} kPa</p>
            <p className="text-sm text-status-activeText font-medium">
              Allowable qa = {fmt(result.allowableBearingPressureKPa)} kPa
            </p>
          </div>
          {result.warnings.length > 0 && (
            <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-status-holdText leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettlementTool() {
  const [netPressureKPa, setNetPressureKPa] = useState("");
  const [footingWidthM, setFootingWidthM] = useState("2");
  const [footingLengthM, setFootingLengthM] = useState("2");
  const [soilElasticModulusMPa, setSoilElasticModulusMPa] = useState("");
  const [soilPoissonRatio, setSoilPoissonRatio] = useState("0.3");
  const [rigidity, setRigidity] = useState<FootingRigidity>("rigid");

  const [includeConsolidation, setIncludeConsolidation] = useState(false);
  const [initialVoidRatio, setInitialVoidRatio] = useState("0.7");
  const [compressionIndex, setCompressionIndex] = useState("0.2");
  const [recompressionIndex, setRecompressionIndex] = useState("");
  const [layerThicknessM, setLayerThicknessM] = useState("3");
  const [initialEffectiveStressKPa, setInitialEffectiveStressKPa] = useState("");
  const [stressIncreaseKPa, setStressIncreaseKPa] = useState("");
  const [preconsolidationPressureKPa, setPreconsolidationPressureKPa] = useState("");

  const [allowableSettlementMm, setAllowableSettlementMm] = useState("25");

  const [result, setResult] = useState<TotalSettlementResult | null>(null);

  function handleCompute() {
    const elastic = computeElasticSettlement({
      netFoundationPressureKPa: Number(netPressureKPa) || 0,
      footingWidthM: Number(footingWidthM) || 0,
      footingLengthM: Number(footingLengthM) || undefined,
      soilElasticModulusMPa: Number(soilElasticModulusMPa) || 0,
      soilPoissonRatio: Number(soilPoissonRatio) || 0.3,
      rigidity,
    });

    const consolidation = includeConsolidation
      ? computeConsolidationSettlement({
          initialVoidRatio: Number(initialVoidRatio) || 0,
          compressionIndex: Number(compressionIndex) || 0,
          recompressionIndex: recompressionIndex.trim() !== "" ? Number(recompressionIndex) : undefined,
          layerThicknessM: Number(layerThicknessM) || 0,
          initialEffectiveStressKPa: Number(initialEffectiveStressKPa) || 0,
          stressIncreaseKPa: Number(stressIncreaseKPa) || 0,
          preconsolidationPressureKPa:
            preconsolidationPressureKPa.trim() !== "" ? Number(preconsolidationPressureKPa) : undefined,
        })
      : undefined;

    const total = checkTotalSettlement({
      elastic,
      consolidation,
      allowableTotalSettlementMm: Number(allowableSettlementMm) || 25,
    });
    setResult(total);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-secondary font-medium">Elastic (Immediate) Settlement</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Net Pressure q (kPa)</label>
          <input
            type="number"
            step="any"
            value={netPressureKPa}
            onChange={(e) => setNetPressureKPa(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Soil Elastic Modulus Es (MPa)</label>
          <input
            type="number"
            step="any"
            value={soilElasticModulusMPa}
            onChange={(e) => setSoilElasticModulusMPa(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Footing Width B (m)</label>
          <input
            type="number"
            step="any"
            value={footingWidthM}
            onChange={(e) => setFootingWidthM(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Footing Length L (m)</label>
          <input
            type="number"
            step="any"
            value={footingLengthM}
            onChange={(e) => setFootingLengthM(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Poisson&apos;s Ratio ν</label>
          <input
            type="number"
            step="any"
            value={soilPoissonRatio}
            onChange={(e) => setSoilPoissonRatio(e.target.value)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Rigidity</label>
          <select
            value={rigidity}
            onChange={(e) => setRigidity(e.target.value as FootingRigidity)}
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          >
            <option value="rigid">Rigid</option>
            <option value="flexible">Flexible</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-text-secondary pt-1">
        <input type="checkbox" checked={includeConsolidation} onChange={(e) => setIncludeConsolidation(e.target.checked)} />
        Include consolidation settlement (clay layer)
      </label>

      {includeConsolidation && (
        <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-2">
          <p className="text-xs text-text-secondary font-medium">Consolidation Settlement</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              value={initialVoidRatio}
              onChange={(e) => setInitialVoidRatio(e.target.value)}
              placeholder="e0"
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
            <input
              type="number"
              step="any"
              value={compressionIndex}
              onChange={(e) => setCompressionIndex(e.target.value)}
              placeholder="Cc"
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              value={recompressionIndex}
              onChange={(e) => setRecompressionIndex(e.target.value)}
              placeholder="Cr (optional)"
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
            <input
              type="number"
              step="any"
              value={layerThicknessM}
              onChange={(e) => setLayerThicknessM(e.target.value)}
              placeholder="H (m)"
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              value={initialEffectiveStressKPa}
              onChange={(e) => setInitialEffectiveStressKPa(e.target.value)}
              placeholder="σ'0 (kPa)"
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
            <input
              type="number"
              step="any"
              value={stressIncreaseKPa}
              onChange={(e) => setStressIncreaseKPa(e.target.value)}
              placeholder="Δσ' (kPa)"
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
          </div>
          <input
            type="number"
            step="any"
            value={preconsolidationPressureKPa}
            onChange={(e) => setPreconsolidationPressureKPa(e.target.value)}
            placeholder="σ'c (kPa, optional — over-consolidated)"
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-text-muted mb-1">Allowable Total Settlement (mm)</label>
        <input
          type="number"
          step="any"
          value={allowableSettlementMm}
          onChange={(e) => setAllowableSettlementMm(e.target.value)}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
        />
      </div>

      <button
        type="button"
        onClick={handleCompute}
        className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
      >
        ▶ Compute Settlement
      </button>

      {result && (
        <div className="space-y-3">
          <div
            className={`rounded-md border px-3 py-2.5 ${
              result.adequate
                ? "bg-status-activeBg border-status-activeBorder text-status-activeText"
                : "bg-red-50 border-red-200 text-red-600"
            }`}
          >
            <p className="text-xs font-medium">
              {result.adequate ? "✓" : "✗"} Total Settlement = {fmt(result.totalSettlementMm)} mm (allowable{" "}
              {fmt(result.allowableSettlementMm)} mm, {fmt(result.utilizationRatio * 100, 0)}%)
            </p>
          </div>
          {result.warnings.length > 0 && (
            <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-status-holdText leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SoilSpringTool() {
  const [method, setMethod] = useState<SubgradeReactionMethod>("from-allowable-bearing-pressure");

  const [plateLoadTestKsKNPerM3, setPlateLoadTestKsKNPerM3] = useState("");
  const [plateWidthM, setPlateWidthM] = useState("0.3");
  const [allowableBearingPressureKPa, setAllowableBearingPressureKPa] = useState("");
  const [assumedSettlementMm, setAssumedSettlementMm] = useState("25");
  const [soilElasticModulusMPa, setSoilElasticModulusMPa] = useState("");
  const [soilPoissonRatio, setSoilPoissonRatio] = useState("0.3");
  const [actualFoundationWidthM, setActualFoundationWidthM] = useState("2");

  const [tributaryAreaM2, setTributaryAreaM2] = useState("1");

  const [result, setResult] = useState<SubgradeReactionResult | null>(null);

  function handleCompute() {
    const r = computeSubgradeReactionModulus({
      method,
      plateLoadTestKsKNPerM3: Number(plateLoadTestKsKNPerM3) || undefined,
      plateWidthM: Number(plateWidthM) || 0.3,
      allowableBearingPressureKPa: Number(allowableBearingPressureKPa) || undefined,
      assumedSettlementAtAllowablePressureMm: Number(assumedSettlementMm) || 25,
      soilElasticModulusMPa: Number(soilElasticModulusMPa) || undefined,
      soilPoissonRatio: Number(soilPoissonRatio) || 0.3,
      footingWidthM: Number(actualFoundationWidthM) || undefined,
      actualFoundationWidthM: Number(actualFoundationWidthM) || undefined,
    });
    setResult(r);
  }

  const spring =
    result && result.modulusOfSubgradeReactionKNPerM3 > 0
      ? computeSoilSpringStiffness({
          modulusOfSubgradeReactionKNPerM3: result.modulusOfSubgradeReactionKNPerM3,
          tributaryAreaM2: Number(tributaryAreaM2) || 0,
        })
      : null;

  return (
    <div className="space-y-3">
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value as SubgradeReactionMethod)}
        className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
      >
        <option value="from-allowable-bearing-pressure">From Allowable Bearing Pressure</option>
        <option value="from-plate-load-test">From Plate Load Test</option>
        <option value="from-elastic-modulus">From Soil Elastic Modulus</option>
      </select>

      {method === "from-allowable-bearing-pressure" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            value={allowableBearingPressureKPa}
            onChange={(e) => setAllowableBearingPressureKPa(e.target.value)}
            placeholder="qa (kPa)"
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
          <input
            type="number"
            step="any"
            value={assumedSettlementMm}
            onChange={(e) => setAssumedSettlementMm(e.target.value)}
            placeholder="assumed settlement (mm)"
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      )}

      {method === "from-plate-load-test" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            value={plateLoadTestKsKNPerM3}
            onChange={(e) => setPlateLoadTestKsKNPerM3(e.target.value)}
            placeholder="plate ks (kN/m³)"
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
          <input
            type="number"
            step="any"
            value={plateWidthM}
            onChange={(e) => setPlateWidthM(e.target.value)}
            placeholder="plate width (m)"
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      )}

      {method === "from-elastic-modulus" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            value={soilElasticModulusMPa}
            onChange={(e) => setSoilElasticModulusMPa(e.target.value)}
            placeholder="Es (MPa)"
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
          <input
            type="number"
            step="any"
            value={soilPoissonRatio}
            onChange={(e) => setSoilPoissonRatio(e.target.value)}
            placeholder="ν"
            className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-text-muted mb-1">Actual Foundation Width (m)</label>
        <input
          type="number"
          step="any"
          value={actualFoundationWidthM}
          onChange={(e) => setActualFoundationWidthM(e.target.value)}
          className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
        />
      </div>

      <button
        type="button"
        onClick={handleCompute}
        className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 transition-colors"
      >
        ▶ Compute ks
      </button>

      {result && (
        <div className="space-y-3">
          <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
            <p className="text-sm text-status-activeText font-medium">
              ks = {fmt(result.modulusOfSubgradeReactionKNPerM3, 0)} kN/m³
            </p>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Tributary Area (m², for a node/point spring)</label>
            <input
              type="number"
              step="any"
              value={tributaryAreaM2}
              onChange={(e) => setTributaryAreaM2(e.target.value)}
              className="w-full rounded-md bg-surface-card border border-surface-border text-text-primary text-xs px-2 py-1.5"
            />
          </div>

          {spring && (
            <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5">
              <p className="text-sm text-status-activeText font-medium">
                Node Spring Stiffness K = {fmt(spring.springStiffnessKNPerM, 0)} kN/m
              </p>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="rounded-md bg-surface border border-surface-border px-3 py-2.5 space-y-1.5">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-status-holdText leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
