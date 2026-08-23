"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizationElementsLayer } from "@/components/viewport/VisualizationElementsLayer";
import type { StructuralElement, ElementCategory } from "@/lib/types/element";
import type { AnalysisNode } from "@/lib/analysis/runAnalysis";
import { buildNodeDisplacementLookup, type NodeTranslation } from "@/lib/viewport/nodeDisplacementLookup";

/**
 * Deformed Shape Snapshot Canvas (Report-Audit Phase A4, 2026-08-20).
 *
 * সমস্যা: Design Report PDF সম্পূর্ণ server-side রেন্ডার হয়
 * (api/documentation/[projectId]/design-report/route.tsx, renderToBuffer)
 * কিন্তু deformed shape viewport client-side WebGL (React Three Fiber,
 * VisualizationViewport.tsx)। Server-এ WebGL নেই — headless browser
 * (puppeteer ইত্যাদি) ছাড়া server-side rendering সম্ভব না, যা এই
 * architecture এ নতুন ভারী dependency যোগ করত। তাই সমাধান: client-side
 * এ (Download বাটনে ক্লিক করার সময়) একটা OFFSCREEN <Canvas> mount করে
 * snapshot নেওয়া, base64 PNG হিসেবে POST body-তে server-এ পাঠানো, তারপর
 * PDF composer সেটা <Image> হিসেবে বসায়। এই কম্পোনেন্ট শুধু সেই
 * offscreen capture এর দায়িত্ব নেয় — ব্যবহারকারীর কাছে কখনো visible না
 * (position: fixed, opacity 0, pointer-events none, off-viewport)।
 *
 * VisualizationViewport.tsx এর পুরো state (mode shape, force diagram,
 * stress contour, DCR heat map, camera persistence, selection) এখানে
 * ইচ্ছাকৃতভাবে বাদ — Phase A4 এর scope শুধু deformed shape, বাকি সব
 * layer/interactivity এর জন্য এতগুলো Zustand store dependency এখানে
 * টেনে আনার দরকার নেই (snapshot একবারের জন্য, ইন্টারঅ্যাক্টিভ na)।
 * Grid/Story reference lines ও ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছে — একটা
 * ছাপা রিপোর্টের স্ন্যাপশটে শুধু কাঠামোর deformed shape স্পষ্ট থাকাই
 * বেশি useful, viewport-editing এর reference grid না।
 *
 * Camera positioning: VisualizationViewport এর persisted camera store
 * এখানে প্রযোজ্য না (ভিন্ন context, ব্যবহারকারী কখনো এই ক্যামেরা
 * নিজে সেট করেননি) — তাই এই কম্পোনেন্ট নিজে elements এর bounding box
 * থেকে একটা isometric-ish ফ্রেমিং ক্যামেরা বসায় (CameraFitter, নিচে),
 * যাতে undeformed reference geometry না দেখেও পুরো deformed shape
 * frame এর মধ্যে থাকে।
 */

export interface DeformedShapeSnapshotProps {
  elements: StructuralElement[];
  nodes: AnalysisNode[];
  nodalDisplacements: NodeTranslation[];
  /** Deformation visually বোঝা যাওয়ার জন্য multiplier — বাস্তব ১:১ displacement (মিলিমিটার-স্কেল) খালি চোখে দেখা যায় না, তাই amplify করা আবশ্যক (VisualizationViewport এর deformationScale এর মতোই ধারণা)। */
  deformationScale: number;
  /** base64 data URL (PNG) রেডি হলে কল হয় — ব্যর্থ হলে null। একবারই কল হওয়া উচিত, caller unmount করে দেবে এরপর। */
  onCaptured: (dataUrl: string | null) => void;
}

const SNAPSHOT_WIDTH = 900;
const SNAPSHOT_HEIGHT = 650;

function elementPoints(element: StructuralElement): { x: number; y: number; z: number }[] {
  if ("vertices" in element) return element.vertices;
  if ("startPoint" in element && "endPoint" in element) return [element.startPoint, element.endPoint];
  return [];
}

function allVisibleCategoryMap(): Record<ElementCategory, boolean> {
  const categories: ElementCategory[] = [
    "beam",
    "column",
    "brace",
    "pile",
    "slab",
    "wall",
    "shear-wall",
    "core-wall",
    "footing",
    "combined-footing",
    "strip-footing",
    "mat-foundation",
    "pile-cap",
    "pile-group",
  ];
  const map = {} as Record<ElementCategory, boolean>;
  for (const c of categories) map[c] = true;
  return map;
}

/** elements এর bounding box থেকে ক্যামেরা position/target বসায় ও তারপর (কয়েক frame পরে, geometry mount নিশ্চিত হওয়ার জন্য) onReady কল করে। */
function CameraFitter({ elements, onReady }: { elements: StructuralElement[]; onReady: () => void }) {
  const { camera, invalidate } = useThree();
  const framesWaited = useRef(0);

  useEffect(() => {
    const box = new THREE.Box3();
    let hasPoint = false;
    for (const el of elements) {
      for (const p of elementPoints(el)) {
        box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z));
        hasPoint = true;
      }
    }
    if (!hasPoint) {
      camera.position.set(10, 10, 10);
      camera.lookAt(0, 0, 0);
      invalidate();
      return;
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    // Isometric-ish view angle, distance scaled to fit the whole bounding box in frame.
    const distance = maxDim * 1.8;
    camera.position.set(center.x + distance * 0.7, center.y + distance * 0.6, center.z + distance * 0.7);
    camera.lookAt(center);
    if ("updateProjectionMatrix" in camera) {
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
    invalidate();
  }, [elements, camera, invalidate]);

  // frameloop="demand" এ প্রতিটা রি-রেন্ডার manual invalidate() লাগে
  // (imperative camera.position.set() reactive props change না, তাই
  // auto-invalidate ট্রিগার হয় না) — rAF দিয়ে কয়েক frame ধরে বারবার
  // invalidate করে নিশ্চিত করা হচ্ছে যে geometry mesh গুলো আসলেই GPU তে
  // render হয়ে গেছে ক্যাপচারের আগে (mount হওয়ার সাথে সাথেই toDataURL()
  // ডাকলে ফাঁকা/আংশিক frame ক্যাপচার হতে পারে)।
  useEffect(() => {
    let raf: number;
    function tick() {
      framesWaited.current += 1;
      invalidate();
      if (framesWaited.current >= 5) {
        onReady();
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onReady, invalidate]);

  return null;
}

function CaptureOnReady({ ready, onCaptured }: { ready: boolean; onCaptured: (dataUrl: string | null) => void }) {
  const { gl } = useThree();
  const capturedRef = useRef(false);

  useEffect(() => {
    if (!ready || capturedRef.current) return;
    capturedRef.current = true;
    try {
      const dataUrl = gl.domElement.toDataURL("image/png");
      onCaptured(dataUrl);
    } catch {
      // toDataURL WebGL context lost/tainted হলে throw করতে পারে —
      // snapshot ছাড়াই PDF generate হবে, ব্লক করা হবে না।
      onCaptured(null);
    }
  }, [ready, gl, onCaptured]);

  return null;
}

export function DeformedShapeSnapshotCanvas({
  elements,
  nodes,
  nodalDisplacements,
  deformationScale,
  onCaptured,
}: DeformedShapeSnapshotProps) {
  const [cameraReady, setCameraReady] = useState(false);
  const handleCameraReady = useCallback(() => setCameraReady(true), []);
  const categoryVisibility = useMemo(() => allVisibleCategoryMap(), []);
  const deformationLookup = useMemo(
    () => buildNodeDisplacementLookup(nodes, nodalDisplacements),
    [nodes, nodalDisplacements]
  );

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: SNAPSHOT_WIDTH,
        height: SNAPSHOT_HEIGHT,
        opacity: 0,
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      <Canvas
        gl={{ preserveDrawingBuffer: true }} // toDataURL() এর জন্য আবশ্যক — না দিলে render হওয়ার পরপরই buffer clear হয়ে যায়, capture খালি আসবে
        camera={{ fov: 45 }}
        frameloop="demand" // static snapshot — continuous re-render দরকার নেই, শুধু CameraFitter/invalidate যা trigger করে তাই
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 10]} intensity={0.8} />
        <VisualizationElementsLayer
          elements={elements}
          selectedElementId={null}
          onSelectElement={() => {}}
          categoryVisibility={categoryVisibility}
          isolatedStoryId={null}
          fadeNonIsolated={false}
          renderMode="solid"
          deformationLookup={deformationLookup}
          deformationScale={deformationScale}
          dcrRecords={null}
          stressContourLookup={null}
        />
        <CameraFitter elements={elements} onReady={handleCameraReady} />
        <CaptureOnReady ready={cameraReady} onCaptured={onCaptured} />
      </Canvas>
    </div>
  );
}
