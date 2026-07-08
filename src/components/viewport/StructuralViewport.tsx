"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { GridLines } from "./GridLines";
import { StoryPlanes } from "./StoryPlanes";
import { OriginMarker } from "./OriginMarker";
import { ElementsLayer } from "./ElementsLayer";
import { DrawPlane } from "./DrawPlane";
import { DrawPreview } from "./DrawPreview";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";
import { useDrawModeStore } from "@/lib/viewport/useDrawModeStore";
import { snapToNearestGrid } from "@/lib/viewport/gridSnap";
import type { Point3D } from "@/lib/types/element";

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
 * ক্যামেরা একটা isometric-এর কাছাকাছি default angle এ শুরু হয়,
 * যেটা CAD সফটওয়্যারে পরিচিত কনভেনশন।
 */
export function StructuralViewport() {
  const geometry = useGeometryStore((s) => s.geometry);
  const elements = useElementsStore((s) => s.elements);
  const selection = useSelectionStore((s) => s.selection);
  const setSelection = useSelectionStore((s) => s.setSelection);

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

  function handleDrawPlaneClick(rawPoint: Point3D) {
    const snapped = snapToNearestGrid(rawPoint, geometry.grids);
    addDrawPoint(snapped);
  }

  return (
    <div className="relative w-full h-full bg-slate-950">
      <Canvas
        camera={{ position: [14, 10, 14], fov: 45 }}
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

          <OriginMarker />

          <GridLines
            grids={geometry.grids}
            stories={geometry.stories}
            selectedGridId={selectedGridId}
            onSelectGrid={(gridId) => setSelection({ type: "grid", gridId })}
            interactionDisabled={isDrawing}
          />

          <StoryPlanes
            stories={geometry.stories}
            selectedStoryId={selectedStoryId}
            onSelectStory={(storyId) => setSelection({ type: "story", storyId })}
            interactionDisabled={isDrawing}
          />

          <ElementsLayer
            elements={elements}
            selectedElementId={selectedElementId}
            onSelectElement={(elementId) => setSelection({ type: "element", elementId })}
            interactionDisabled={isDrawing}
          />

          {isDrawing && (
            <>
              <DrawPlane elevation={drawElevation} onPointClick={handleDrawPlaneClick} />
              <DrawPreview points={drawPoints} />
            </>
          )}

          <OrbitControls makeDefault enableDamping dampingFactor={0.1} />

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
          <p className="text-slate-500 text-sm">
            এখনো কোনো Grid, Story বা Element যোগ করা হয়নি। ডানপাশের প্যানেল থেকে শুরু করুন।
          </p>
        </div>
      )}
    </div>
  );
}
