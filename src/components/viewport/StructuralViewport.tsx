"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport, Grid } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { GridLines } from "./GridLines";
import { StoryPlanes } from "./StoryPlanes";
import { OriginMarker } from "./OriginMarker";
import { ElementsLayer } from "./ElementsLayer";
import { DetailingLayer } from "./DetailingLayer";
import { DrawPlane } from "./DrawPlane";
import { DrawPreview } from "./DrawPreview";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";
import { useDrawModeStore } from "@/lib/viewport/useDrawModeStore";
import { useDetailingStore } from "@/lib/detailing/useDetailingStore";
import { useStructuralCameraStore } from "@/lib/viewport/useStructuralCameraStore";
import { snapToNearestGrid } from "@/lib/viewport/gridSnap";
import type { Point3D } from "@/lib/types/element";
import {
  deriveGridsFromElements,
  computeModelExtent,
} from "@/lib/geometry/deriveGridsFromElements";

/**
 * Structural Model 3D Viewport।
 *
 * Phase 1: Grid ও Story।
 * Phase 2a: + Beam/Column/Slab/Wall/Footing (ElementsLayer)।
 * Phase 2b: + Draw Mode — Slab/Wall এর জন্য click-to-draw polygon
 * তৈরির interaction (DrawPlane/DrawPreview)।
 *
 * Draw mode চালু থাকলে (activeCategory !== null):
 *   - GridLines/StoryPlanes/ElementsLayer কে interactionDisabled={true}
 *     পাস করা হয়, যা তাদের onClick prop সম্পূর্ণ বাদ দেয় (শুধু handler
 *     কে no-op করে না)। এটা জরুরি একটা নির্দিষ্ট কারণে: এই
 *     component গুলোর onClick এ event.stopPropagation() আছে, যেটা
 *     handler-টা "কিছু না করেও" call হয়ে যেত যদি onClick prop attach
 *     করা থাকতো — ফলে raycasting hit এখানেই থেমে যেত এবং নিচের
 *     DrawPlane পর্যন্ত ক্লিক পৌঁছাতোই না (বিশেষত StoryPlanes এর
 *     ক্ষেত্রে এটা মারাত্মক ছিল, কারণ সেটা একটা পূর্ণ ২০x২০ মিটার
 *     সলিড প্লেন — প্রায় প্রতিটা ক্লিকই তাতে আটকে যেত)। onClick prop
 *     সম্পূর্ণ বাদ দিলে raycasting এই object কে হিটই ধরে না, তাই
 *     ক্লিক bubble করে DrawPlane পর্যন্ত পৌঁছায়।
 *   - DrawPlane নামের একটা অদৃশ্য প্লেন mount হয় যেটা raw click point
 *     ধরে, grid snap করে, এবং draw store এ যোগ করে।
 *
 * Phase 10 (Detailing tab): + Detailing overlay — showDetailing=true
 * হলে DetailingLayer mount হয়, যা useDetailingStore-এ generate করা
 * rebar geometry-কে (Design panel-এর "Send to Detailing Model" বাটন
 * থেকে) প্রতিটা element-এর প্রকৃত world position-এ বসায়। CSI-এর
 * Detailing view-এর মতো, main structural viewport-এরই একটা
 * টগল-করা যায় এমন layer — আলাদা viewport না, কারণ rebar কে সবসময়
 * member-এর প্রকৃত context এ দেখাই বেশি অর্থবহ। (এটা Visualization
 * tab/VisualizationViewport, Phase 10i, থেকে ইচ্ছাকৃতভাবে আলাদা —
 * সেটা ভবিষ্যতের stress contour/DCR/mode-shape কাজের জন্য সংরক্ষিত,
 * নিজস্ব read-only viewport হিসেবে।)
 *
 * Phase 3 (camera persistence) — ক্যামেরা প্রথমবার (কোনো saved state
 * না থাকলে) isometric-এর কাছাকাছি default angle এ শুরু হয় (CAD
 * সফটওয়্যারে পরিচিত কনভেনশন), কিন্তু তারপর useStructuralCameraStore
 * এ থাকা শেষ position/target থেকে শুরু হয়। এটা জরুরি কারণ page.tsx এ
 * এই component দুইটা আলাদা JSX position এ বসানো আছে (dual-panel block
 * — Elements/Analysis, আর single-panel block — Detailing) — React
 * তাই Elements/Analysis ↔ Detailing এর মধ্যে সুইচ করলে <Canvas>
 * unmount+remount করে, camera prop শুধু initial construction-এই কাজ
 * করে (@react-three/fiber এর নিজস্ব কমেন্ট, নিচে দেখুন) — এই store
 * ছাড়া প্রতিবার hardcoded default এ রিসেট হতো।
 *
 * initialCamera একটা useMemo দিয়ে mount-এ একবারই store থেকে পড়া হয়
 * (getState(), reactive subscription না) — ইচ্ছাকৃতভাবে, কারণ
 * @react-three/fiber এর camera prop handling shallow-equality চেক করে
 * (dist/events-*.esm.js এর "Create default camera, don't overwrite
 * any user-set state" ব্লক) — যদি এখানে reactive store subscription
 * ব্যবহার করে প্রতি render এ নতুন camera prop object পাস করা হতো,
 * store আপডেট হওয়ার সাথে সাথেই সেই shallow-equality চেক ব্যর্থ হয়ে
 * applyProps() আবার চলত, যা OrbitControls এর live mutation এর সাথে
 * conflict করত (প্রতি drag-end এ camera জোর করে reset হয়ে যেত)। তাই
 * mount-time snapshot ব্যবহার করা হয়েছে — শুধু remount এর সময় সাহায্য
 * করবে, চলমান render এ কখনো camera prop বদলাবে না।
 *
 * OrbitControls এর 'end' event এ (drag/gesture শেষ হলে — 'change' এর
 * চেয়ে অনেক কম ঘন ঘন, প্রতি frame এ না) store আপডেট হয়।
 */
interface StructuralViewportProps {
  showDetailing?: boolean;
  showStirrups?: boolean;
  showMesh?: boolean;
  isolateElementId?: string | null;
}

export function StructuralViewport({
  showDetailing = false,
  showStirrups = true,
  showMesh = true,
  isolateElementId = null,
}: StructuralViewportProps = {}) {
  const geometry = useGeometryStore((s) => s.geometry);
  const elements = useElementsStore((s) => s.elements);
  const selection = useSelectionStore((s) => s.selection);
  const setSelection = useSelectionStore((s) => s.setSelection);
  const detailingResults = useDetailingStore((s) => s.results);

  const drawActiveCategory = useDrawModeStore((s) => s.activeCategory);
  const drawPoints = useDrawModeStore((s) => s.points);
  const drawElevation = useDrawModeStore((s) => s.drawElevation);
  const addDrawPoint = useDrawModeStore((s) => s.addPoint);

  const isDrawing = drawActiveCategory !== null;

  const selectedGridId = selection.type === "grid" ? selection.gridId : null;
  const selectedStoryId = selection.type === "story" ? selection.storyId : null;
  const selectedElementId = selection.type === "element" ? selection.elementId : null;

  const isEmpty =
    geometry.grids.length === 0 && geometry.stories.length === 0 && elements.length === 0;

  // Auto-derived grid — element geometry (column/beam/slab/...) থেকে
  // manual grid এর পাশাপাশি বের করা হয়। দ্র. deriveGridsFromElements.ts
  // এর টপ-লেভেল doc-comment ও PlanView2D.tsx এর একই প্যাটার্ন।
  const autoGrids = useMemo(
    () => deriveGridsFromElements(elements, geometry.grids),
    [elements, geometry.grids]
  );
  const allGrids = useMemo(
    () => [...geometry.grids, ...autoGrids],
    [geometry.grids, autoGrids]
  );
  const modelExtent = useMemo(
    () => computeModelExtent(elements, allGrids),
    [elements, allGrids]
  );
  const groundGridSpan = Math.ceil(modelExtent.span + 4);

  function handleDrawPlaneClick(rawPoint: Point3D) {
    // snap এখন auto-derived grid সহ সব গ্রিডের বিরুদ্ধে হয় — ব্যবহারকারী
    // draw mode এ existing column-এর লাইনে snap করতে পারবেন, শুধু
    // manually বসানো grid না।
    const snapped = snapToNearestGrid(rawPoint, allGrids);
    addDrawPoint(snapped);
  }

  // --- Phase 3: camera persistence (উপরের doc-comment দেখুন) ---
  const orbitControlsRef = useRef<OrbitControlsImpl>(null);
  const setStructuralCamera = useStructuralCameraStore((s) => s.setCamera);
  // getState() ইচ্ছাকৃতভাবে — reactive subscription না, mount-time
  // snapshot। useMemo([]) এম্পটি dep array মানে এই কম্পোনেন্টের
  // জীবনকালে (mount থেকে unmount পর্যন্ত) একবারই হিসাব হয়।
  const initialCamera = useMemo(() => {
    const stored = useStructuralCameraStore.getState();
    return {
      position: [stored.position.x, stored.position.y, stored.position.z] as [
        number,
        number,
        number,
      ],
      target: [stored.target.x, stored.target.y, stored.target.z] as [number, number, number],
    };
  }, []);

  function handleOrbitEnd() {
    const controls = orbitControlsRef.current;
    if (!controls) return;
    const cam = controls.object;
    setStructuralCamera(
      { x: cam.position.x, y: cam.position.y, z: cam.position.z },
      { x: controls.target.x, y: controls.target.y, z: controls.target.z },
    );
  }

  return (
    <div className="relative w-full h-full bg-surface">
      <Canvas
        camera={{ position: initialCamera.position, fov: 45 }}
        onPointerMissed={() => {
          // draw mode এ background ক্লিক করলে selection পরিবর্তনের
          // দরকার নেই (এবং করা উচিতও না, কারণ draw session এ কোনো
          // selection concept প্রাসঙ্গিক না) — তাই শুধু normal mode এ
          // selection ক্লিয়ার করা হয়।
          if (!isDrawing) {
            setSelection({ type: "none" });
          }
        }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 15, 10]} intensity={0.8} />

          {/* Reference floor grid — CAD সফটওয়্যার (ETABS ইত্যাদি) এর
              মতো একটা হালকা ground-plane grid, শুধু spatial depth/scale
              cue হিসেবে। GridLines.tsx এর structural grid থেকে আলাদা —
              এটা কোনো ডেটা রাখে না, ক্লিক-নিষ্ক্রিয়, শুধু visual। span
              এখন মডেলের bounding box (groundGridSpan) অনুযায়ী dynamic,
              যাতে বড় মডেলে ground grid ছোট না পড়ে যায় এবং ছোট মডেলে
              অকারণ বড় না হয়। */}
          <Grid
            position={[0, -0.01, 0]}
            args={[groundGridSpan, groundGridSpan]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#dde3ea"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#c4ccd6"
            fadeDistance={Math.max(groundGridSpan * 1.5, 30)}
            fadeStrength={1}
            followCamera={false}
            infiniteGrid={false}
          />

          <OriginMarker />

          <GridLines
            grids={allGrids}
            stories={geometry.stories}
            selectedGridId={selectedGridId}
            onSelectGrid={(gridId) => setSelection({ type: "grid", gridId })}
            interactionDisabled={isDrawing}
            extent={modelExtent}
          />

          <StoryPlanes
            stories={geometry.stories}
            selectedStoryId={selectedStoryId}
            onSelectStory={(storyId) => setSelection({ type: "story", storyId })}
            interactionDisabled={isDrawing}
            extent={modelExtent}
          />

          <ElementsLayer
            elements={elements}
            selectedElementId={selectedElementId}
            onSelectElement={(elementId) => setSelection({ type: "element", elementId })}
            interactionDisabled={isDrawing}
          />

          {showDetailing && (
            <DetailingLayer
              elements={elements}
              detailingResults={detailingResults}
              showStirrups={showStirrups}
              showMesh={showMesh}
              isolateElementId={isolateElementId}
            />
          )}

          {isDrawing && (
            <>
              <DrawPlane elevation={drawElevation} onPointClick={handleDrawPlaneClick} />
              <DrawPreview points={drawPoints} />
            </>
          )}

          <OrbitControls
            ref={orbitControlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.1}
            target={initialCamera.target}
            onEnd={handleOrbitEnd}
          />

          <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
            <GizmoViewport
              axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
              labelColor="#0f172a"
            />
          </GizmoHelper>
        </Suspense>
      </Canvas>

      {isEmpty && !isDrawing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-text-muted text-sm">
            এখনো কোনো Grid, Story বা Element যোগ করা হয়নি। ডানপাশের প্যানেল থেকে শুরু করুন।
          </p>
        </div>
      )}
    </div>
  );
}
