"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { Point3D } from "@/lib/types/element";

interface DrawPreviewProps {
  points: Point3D[];
}

const VERTEX_COLOR = "#38bdf8";
const LINE_COLOR = "#38bdf8";
const PREVIEW_FILL_COLOR = "#38bdf8";

/**
 * আঁকার সময় এখন পর্যন্ত রাখা vertex গুলো visualize করে:
 *   - প্রতিটা vertex একটা ছোট গোলক
 *   - vertex গুলোর মধ্যে সংযোগকারী রেখা
 *   - ৩+ vertex হলে একটা অর্ধ-স্বচ্ছ polygon preview (শেষ vertex
 *     থেকে প্রথম vertex পর্যন্ত বন্ধ করে দেখানো হয়, যদিও ইউজার এখনো
 *     "Finish" চাপেননি — এটা preview করার জন্য, চূড়ান্ত shape কেমন
 *     দেখাবে সেটা আগে থেকে বোঝাতে)
 */
export function DrawPreview({ points }: DrawPreviewProps) {
  const linePoints: [number, number, number][] = useMemo(
    () => points.map((p) => [p.x, p.y + 0.01, p.z]), // সামান্য উপরে তুলে দেওয়া হয়েছে যাতে story plane এর সাথে z-fighting না হয়
    [points]
  );

  const polygonGeometry = useMemo(() => {
    if (points.length < 3) {
      return null;
    }

    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].z);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].z);
    }
    shape.closePath();

    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI / 2);
    return geom;
  }, [points]);

  const averageY = points.length > 0 ? points[0].y : 0;

  return (
    <group>
      {points.map((point, index) => (
        <mesh key={index} position={[point.x, point.y + 0.01, point.z]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color={VERTEX_COLOR} />
        </mesh>
      ))}

      {linePoints.length >= 2 && (
        <Line points={linePoints} color={LINE_COLOR} lineWidth={2} />
      )}

      {polygonGeometry && (
        <mesh geometry={polygonGeometry} position={[0, averageY + 0.005, 0]}>
          <meshBasicMaterial
            color={PREVIEW_FILL_COLOR}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
