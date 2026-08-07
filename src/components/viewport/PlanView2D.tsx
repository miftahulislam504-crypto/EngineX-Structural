"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, MapControls } from "@react-three/drei";
import { GridLines } from "./GridLines";
import { StoryPlanes } from "./StoryPlanes";
import { ElementsLayer } from "./ElementsLayer";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useSelectionStore } from "@/lib/viewport/useSelectionStore";

/**
 * Plan View (2D) — Phase 0.4।
 *
 * উপর থেকে সরাসরি নিচে (top-down orthographic) দেখা একটা প্লান ভিউ।
 * এটা আলাদা কোনো drafting engine (Konva/SVG) না — বরং StructuralViewport
 * এর মতোই GridLines/StoryPlanes/ElementsLayer পুনর্ব্যবহার করে, শুধু
 * ক্যামেরা আলাদা (perspective+OrbitControls এর বদলে orthographic+
 * MapControls, যা rotation বন্ধ রাখে — শুধু pan/zoom, একটা মানচিত্রের
 * মতো)। যেহেতু element geometry-ই real 3D mesh (LineElementMesh,
 * AreaElementMesh ইত্যাদি — ElementsLayer.tsx দেখুন), সরাসরি উপর থেকে
 * দেখলেই এগুলো প্রকৃত plan-view আয়তক্ষেত্র হিসেবে দেখা যায়, আলাদা করে
 * "top-down projection" আঁকতে হয় না।
 *
 * ⚠️ এই মুহূর্তে **view-only** — click করে grid/story/element select
 * করা যাবে (দেখার জন্য), কিন্তু নতুন element আঁকা বা existing element
 * move করা যাবে না। এটা ইচ্ছাকৃত সিদ্ধান্ত (এই Phase-এর scope আলোচনা
 * দেখুন): যেহেতু ভবিষ্যতে বেশিরভাগ element Architectural sync থেকে
 * automatically আসার কথা, শুধু manual element এর জন্য plan-view edit
 * দরকার হবে — সেটা একটা future phase-এ (Part 3-এর কাছাকাছি) যোগ হবে,
 * তখন DrawPlane-এর মতো একটা click-to-place/drag-to-move interaction
 * layer এখানে বসবে।
 *
 * Story selector: একটা প্লান ভিউতে একসাথে সব floor এর element দেখলে
 * ঘন হয়ে যায় (superimposed), তাই একটা story dropdown দিয়ে single-floor
 * isolate করার সুযোগ রাখা হয়েছে — "সব" অপশনে সব floor একসাথেও দেখা
 * যায়।
 */
export function PlanView2D() {
  const geometry = useGeometryStore((s) => s.geometry);
  const elements = useElementsStore((s) => s.elements);
  const selection = useSelectionStore((s) => s.selection);
  const setSelection = useSelectionStore((s) => s.setSelection);

  const [isolatedStoryId, setIsolatedStoryId] = useState<string | null>(null);

  const selectedGridId = selection.type === "grid" ? selection.gridId : null;
  const selectedStoryId = selection.type === "story" ? selection.storyId : null;
  const selectedElementId = selection.type === "element" ? selection.elementId : null;

  const isEmpty = geometry.grids.length === 0 && geometry.stories.length === 0 && elements.length === 0;

  const sortedStories = useMemo(
    () => [...geometry.stories].sort((a, b) => a.elevation - b.elevation),
    [geometry.stories]
  );

  // isolate করা থাকলে শুধু সেই storyId এর element দেখানো হয়। BaseElement
  // এ সরাসরি storyId?: string ফিল্ড আছে (lib/types/element.ts) — তাই
  // z-coordinate থেকে elevation অনুমান করার দরকার নেই, element নিজেই
  // জানে কোন story-র। Foundation-type element (footing ইত্যাদি) storyId
  // ছাড়াই থাকতে পারে (base-এ) — isolation চালু থাকলে সেগুলো লুকানো
  // থাকবে (একটা নির্দিষ্ট floor-এর plan এ foundation দেখানোর দরকার নেই),
  // isolation ছাড়া (সব ফ্লোর) অবস্থায় দেখা যাবে।
  const visibleElements = useMemo(() => {
    if (!isolatedStoryId) return elements;
    return elements.filter((el) => el.storyId === isolatedStoryId);
  }, [elements, isolatedStoryId]);

  // ক্যামেরার zoom/bound — মডেলের extent থেকে একটা যুক্তিসঙ্গত ডিফল্ট।
  // খুব ছোট মডেলেও (একটা মাত্র grid) কিছু padding রাখা হয়েছে যাতে
  // camera একদম ক্লোজ-আপ না হয়ে যায়।
  const modelExtent = useMemo(() => {
    const xs = geometry.grids.filter((g) => g.direction === "Y").map((g) => g.coordinate);
    const ys = geometry.grids.filter((g) => g.direction === "X").map((g) => g.coordinate);
    // StoryPlanes.tsx এর PLANE_SPAN (20m) এর সাথে ডিফল্ট মিলিয়ে রাখা
    // হলো, যাতে খালি/ছোট মডেলে 2D আর 3D ভিউয়ের প্রাথমিক zoom level
    // কাছাকাছি অনুভূত হয়।
    const maxX = xs.length ? Math.max(...xs.map(Math.abs)) : 10;
    const maxY = ys.length ? Math.max(...ys.map(Math.abs)) : 10;
    return Math.max(maxX, maxY, 10) * 1.4;
  }, [geometry.grids]);

  return (
    <div className="relative w-full h-full bg-surface">
      {/* Story isolator */}
      {sortedStories.length > 0 && (
        <div className="absolute top-3 left-3 z-10">
          <select
            value={isolatedStoryId ?? ""}
            onChange={(e) => setIsolatedStoryId(e.target.value === "" ? null : e.target.value)}
            className="bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-sm text-text-primary shadow-card outline-none"
          >
            <option value="">সব ফ্লোর (Plan)</option>
            {sortedStories.map((story) => (
              <option key={story.storyId} value={story.storyId}>
                {story.name} ({story.elevation}m)
              </option>
            ))}
          </select>
        </div>
      )}

      <Canvas
        orthographic
        onPointerMissed={() => setSelection({ type: "none" })}
      >
        <Suspense fallback={null}>
          {/* উপর থেকে সরাসরি নিচে — zoom মডেলের extent অনুযায়ী */}
          <OrthographicCamera
            makeDefault
            position={[0, 50, 0]}
            zoom={300 / modelExtent}
            near={0.1}
            far={200}
          />

          <ambientLight intensity={0.9} />
          <directionalLight position={[0, 20, 0]} intensity={0.4} />

          <GridLines
            grids={geometry.grids}
            stories={geometry.stories}
            selectedGridId={selectedGridId}
            onSelectGrid={(gridId) => setSelection({ type: "grid", gridId })}
            interactionDisabled={false}
          />

          <StoryPlanes
            stories={geometry.stories}
            selectedStoryId={selectedStoryId}
            onSelectStory={(storyId) => setSelection({ type: "story", storyId })}
            interactionDisabled={false}
          />

          <ElementsLayer
            elements={visibleElements}
            selectedElementId={selectedElementId}
            onSelectElement={(elementId) => setSelection({ type: "element", elementId })}
            interactionDisabled={false}
          />

          {/* rotation নেই — শুধু pan (ড্র্যাগ) ও zoom (স্ক্রল), মানচিত্রের
              মতো আচরণ, যাতে ব্যবহারকারী ভুলে plan view থেকে বেরিয়ে
              isometric-এ চলে না যায়। */}
          <MapControls makeDefault enableRotate={false} enableDamping dampingFactor={0.1} />
        </Suspense>
      </Canvas>

      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-text-muted text-sm">
            এখনো কোনো Grid, Story বা Element যোগ করা হয়নি।
          </p>
        </div>
      )}
    </div>
  );
}
