"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { StructuralElement } from "@/lib/types/element";

interface ElementsLayerProps {
  elements: StructuralElement[];
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  /**
   * true হলে (draw mode চালু) সব element mesh এর onClick prop বাদ
   * দেওয়া হয়। GridLines/StoryPlanes এর মতোই কারণ — একটা existing
   * Slab/Wall mesh draw mode এ ক্লিক ইন্টারসেপ্ট করলে নিচের DrawPlane
   * পর্যন্ত ক্লিক পৌঁছাতো না।
   */
  interactionDisabled?: boolean;
}

const COLOR_BEAM = "#f97316"; // orange
const COLOR_COLUMN = "#eab308"; // yellow
const COLOR_BRACE = "#ec4899"; // pink — bracing সহজে আলাদা করা যায় beam/column থেকে
const COLOR_PILE = "#7c2d12"; // dark brown — মাটির নিচের element হিসেবে বোঝানো
const COLOR_SLAB = "#94a3b8"; // slate
const COLOR_WALL = "#78716c"; // stone
const COLOR_SHEAR_WALL = "#dc2626"; // red — lateral system এর গুরুত্বপূর্ণ অংশ হিসেবে দৃষ্টি আকর্ষণ করে
const COLOR_CORE_WALL = "#b91c1c"; // darker red — shear wall এর কাছাকাছি কিন্তু distinguishable
const COLOR_FOOTING = "#a16207"; // amber-brown
const COLOR_SELECTED = "#38bdf8"; // sky

/**
 * প্রতিটা element category কে ভিন্ন geometry primitive দিয়ে দেখায়:
 *   - Beam/Column: একটা পাতলা cylinder, দুই পয়েন্টের মাঝে সঠিক
 *     length/rotation নিয়ে বসানো (line renderer না, কারণ পরবর্তী
 *     Phase-এ section shape অনুযায়ী প্রকৃত cross-section দেখানোর
 *     সুযোগ রাখতে cylinder/mesh ভিত্তি হিসেবে বেশি উপযুক্ত)
 *   - Slab/Wall: polygon vertices থেকে বানানো একটা flat extruded mesh
 *   - Footing: একটা box, location-কেন্দ্রে বসানো
 */
export function ElementsLayer({
  elements,
  selectedElementId,
  onSelectElement,
  interactionDisabled = false,
}: ElementsLayerProps) {
  return (
    <group>
      {elements.map((element) => {
        const isSelected = element.elementId === selectedElementId;

        switch (element.category) {
          case "beam":
          case "column":
          case "brace":
          case "pile":
            return (
              <LineElementMesh
                key={element.elementId}
                elementId={element.elementId}
                startPoint={element.startPoint}
                endPoint={element.endPoint}
                color={isSelected ? COLOR_SELECTED : getLineElementColor(element.category)}
                label={element.label}
                onSelect={() => onSelectElement(element.elementId)}
                interactionDisabled={interactionDisabled}
              />
            );

          case "slab":
          case "wall":
          case "shear-wall":
          case "core-wall":
            return (
              <AreaElementMesh
                key={element.elementId}
                vertices={element.vertices}
                thickness={element.thickness}
                color={isSelected ? COLOR_SELECTED : getAreaElementColor(element.category)}
                onSelect={() => onSelectElement(element.elementId)}
                interactionDisabled={interactionDisabled}
              />
            );

          case "footing":
            return (
              <FootingMesh
                key={element.elementId}
                location={element.location}
                width={element.width}
                length={element.length}
                thickness={element.thickness}
                color={isSelected ? COLOR_SELECTED : COLOR_FOOTING}
                onSelect={() => onSelectElement(element.elementId)}
                interactionDisabled={interactionDisabled}
              />
            );

          default: {
            // Exhaustiveness check — ভবিষ্যতে নতুন category (cable,
            // spring, damper ইত্যাদি) যোগ হলে এখানে কম্পাইল এরর দেবে
            // যদি নতুন case না লেখা হয়।
            const exhaustiveCheck: never = element;
            console.error("Unhandled element category:", exhaustiveCheck);
            return null;
          }
        }
      })}
    </group>
  );
}

function getLineElementColor(category: "beam" | "column" | "brace" | "pile"): string {
  switch (category) {
    case "beam":
      return COLOR_BEAM;
    case "column":
      return COLOR_COLUMN;
    case "brace":
      return COLOR_BRACE;
    case "pile":
      return COLOR_PILE;
  }
}

function getAreaElementColor(category: "slab" | "wall" | "shear-wall" | "core-wall"): string {
  switch (category) {
    case "slab":
      return COLOR_SLAB;
    case "wall":
      return COLOR_WALL;
    case "shear-wall":
      return COLOR_SHEAR_WALL;
    case "core-wall":
      return COLOR_CORE_WALL;
  }
}

interface LineElementMeshProps {
  elementId: string;
  startPoint: { x: number; y: number; z: number };
  endPoint: { x: number; y: number; z: number };
  color: string;
  label: string;
  onSelect: () => void;
  interactionDisabled?: boolean;
}

function LineElementMesh({
  startPoint,
  endPoint,
  color,
  onSelect,
  interactionDisabled = false,
}: LineElementMeshProps) {
  const { midpoint, length, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(startPoint.x, startPoint.y, startPoint.z);
    const end = new THREE.Vector3(endPoint.x, endPoint.y, endPoint.z);

    const direction = new THREE.Vector3().subVectors(end, start);
    const len = direction.length();
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    // CylinderGeometry ডিফল্টভাবে Y-অক্ষ বরাবর দাঁড়ানো থাকে; আমাদের
    // দরকার start→end দিক বরাবর ঘোরানো। এই quaternion সেই rotation
    // হিসাব করে (Y-axis থেকে direction-এর দিকে)।
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    );

    return { midpoint: mid, length: len, quaternion: quat };
  }, [startPoint, endPoint]);

  // পাতলা cylinder — প্রকৃত section dimension (Phase 2a তে sectionId
  // রেফারেন্স আছে কিন্তু viewport এ এখনো actual cross-section shape
  // render করা হচ্ছে না, এটা একটা schematic representation, Phase 10
  // এর Results Visualization এ আরও বাস্তবসম্মত রেন্ডারিং আসবে)।
  const radius = 0.06;

  return (
    <mesh
      position={midpoint}
      quaternion={quaternion}
      onClick={
        interactionDisabled
          ? undefined
          : (e) => {
              e.stopPropagation();
              onSelect();
            }
      }
    >
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

interface AreaElementMeshProps {
  vertices: { x: number; y: number; z: number }[];
  thickness: number;
  color: string;
  onSelect: () => void;
  interactionDisabled?: boolean;
}

function AreaElementMesh({
  vertices,
  thickness,
  color,
  onSelect,
  interactionDisabled = false,
}: AreaElementMeshProps) {
  const geometry = useMemo(() => {
    if (vertices.length < 3) {
      return null;
    }

    // Three.js ShapeGeometry একটা 2D shape (XY প্লেনে) থেকে বানাতে হয়,
    // তারপর আমরা সেটাকে আমাদের XZ প্লেনে rotate করে বসাই (কারণ এই
    // viewport এ Y = elevation, তাই "প্লান" প্লেন হলো XZ)।
    const shape = new THREE.Shape();
    shape.moveTo(vertices[0].x, vertices[0].z);
    for (let i = 1; i < vertices.length; i++) {
      shape.lineTo(vertices[i].x, vertices[i].z);
    }
    shape.closePath();

    const extrudeSettings = {
      depth: Math.max(thickness / 1000, 0.01), // mm থেকে মিটারে কনভার্ট, viewport এর একক অনুযায়ী
      bevelEnabled: false,
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // ExtrudeGeometry XY প্লেনে তৈরি হয় এবং Z-দিকে extrude করে; আমাদের
    // দরকার XZ প্লেনে থাকা এবং Y-দিকে (elevation) সামান্য extrude।
    // তাই X-অক্ষ বরাবর -90° rotate করে geometry-কে সঠিক অভিমুখে আনা হচ্ছে।
    geom.rotateX(-Math.PI / 2);

    return geom;
  }, [vertices, thickness]);

  const averageY = useMemo(() => {
    if (vertices.length === 0) return 0;
    return vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;
  }, [vertices]);

  if (!geometry) {
    return null;
  }

  return (
    <mesh
      geometry={geometry}
      position={[0, averageY, 0]}
      onClick={
        interactionDisabled
          ? undefined
          : (e) => {
              e.stopPropagation();
              onSelect();
            }
      }
    >
      <meshStandardMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

interface FootingMeshProps {
  location: { x: number; y: number; z: number };
  width: number;
  length: number;
  thickness: number;
  color: string;
  onSelect: () => void;
  interactionDisabled?: boolean;
}

function FootingMesh({
  location,
  width,
  length,
  thickness,
  color,
  onSelect,
  interactionDisabled = false,
}: FootingMeshProps) {
  // mm থেকে মিটারে কনভার্ট, কারণ Grid/Story কোঅর্ডিনেট মিটারে কিন্তু
  // element dimension (width/length/thickness) মিলিমিটারে রাখা হয়েছে
  // (ইঞ্জিনিয়ারিং কনভেনশন — cross-section dimension সাধারণত mm এ,
  // spatial coordinate মিটারে)।
  const widthM = width / 1000;
  const lengthM = length / 1000;
  const thicknessM = thickness / 1000;

  return (
    <mesh
      position={[location.x, location.y - thicknessM / 2, location.z]}
      onClick={
        interactionDisabled
          ? undefined
          : (e) => {
              e.stopPropagation();
              onSelect();
            }
      }
    >
      <boxGeometry args={[widthM, thicknessM, lengthM]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
