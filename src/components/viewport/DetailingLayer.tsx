"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { RebarMesh } from "./RebarMesh";
import type { StructuralElement } from "@/lib/types/element";
import type { DetailingResult } from "@/lib/detailing/types";
import type { Point3D } from "@/lib/types/element";

interface DetailingLayerProps {
  elements: StructuralElement[];
  detailingResults: Record<string, DetailingResult>;
  showStirrups: boolean;
  showMesh: boolean;
  /** শুধু নির্বাচিত element এর detailing দেখাবে (null = সবগুলো, CSI-এর "whole structure" mode) */
  isolateElementId?: string | null;
}

/**
 * DetailingLayer — StructuralViewport-এ overlay হিসেবে বসে (main
 * ElementsLayer-এর পাশাপাশি, রঙিন schematic member-এর ভেতরে/উপরে)।
 * প্রতিটা element-এর জন্য যদি useDetailingStore-এ একটা generate করা
 * DetailingResult থাকে, সেটার local-space rebar geometry কে সেই
 * element-এর প্রকৃত world position/rotation এ transform করে বসায়।
 *
 * Line elements (beam/column): origin = startPoint, quaternion =
 * (Y-axis → direction) — ঠিক ElementsLayer.LineElementMesh এর মতোই,
 * যাতে rebar সবসময় দৃশ্যমান member-এর ভেতরে align থাকে।
 *
 * Area elements (slab/wall/footing/mat/pile-cap): origin = element-এর
 * একটা reference point (vertices[0] বা location), কোনো rotation ছাড়া
 * (generator local x/z ইতিমধ্যে world XZ প্লেনের সাথে align, দেখুন
 * generateSlabDetailing.ts docstring)।
 */
export function DetailingLayer({
  elements,
  detailingResults,
  showStirrups,
  showMesh,
  isolateElementId = null,
}: DetailingLayerProps) {
  const items = useMemo(() => {
    const out: {
      elementId: string;
      result: DetailingResult;
      origin: Point3D;
      quaternion?: THREE.Quaternion;
    }[] = [];

    for (const element of elements) {
      if (isolateElementId && element.elementId !== isolateElementId) continue;
      const result = detailingResults[element.elementId];
      if (!result) continue;

      switch (element.category) {
        case "beam":
        case "column": {
          const start = new THREE.Vector3(element.startPoint.x, element.startPoint.y, element.startPoint.z);
          const end = new THREE.Vector3(element.endPoint.x, element.endPoint.y, element.endPoint.z);
          const direction = new THREE.Vector3().subVectors(end, start);
          const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.clone().normalize()
          );
          out.push({ elementId: element.elementId, result, origin: element.startPoint, quaternion: quat });
          break;
        }

        case "slab":
        case "wall":
        case "shear-wall":
        case "core-wall":
        case "mat-foundation": {
          // Bounding box এর min corner কে origin ধরা হয়েছে (generator গুলো bbox min থেকেই local x/z শুরু করে, দেখুন generateSlabDetailing.ts)
          const xs = element.vertices.map((v) => v.x);
          const zs = element.vertices.map((v) => v.z);
          const y = element.vertices[0]?.y ?? 0;
          const origin: Point3D = { x: Math.min(...xs), y, z: Math.min(...zs) };
          out.push({ elementId: element.elementId, result, origin });
          break;
        }

        case "footing":
        case "pile-cap": {
          out.push({ elementId: element.elementId, result, origin: element.location });
          break;
        }

        default:
          break;
      }
    }

    return out;
  }, [elements, detailingResults, isolateElementId]);

  return (
    <group>
      {items.map((item) => (
        <RebarMesh
          key={item.elementId}
          longitudinalBars={item.result.longitudinalBars}
          transverseBars={item.result.transverseBars}
          meshBars={item.result.meshBars}
          originWorld={item.origin}
          quaternion={item.quaternion}
          visible={true}
          showStirrups={showStirrups}
          showMesh={showMesh}
        />
      ))}
    </group>
  );
}
