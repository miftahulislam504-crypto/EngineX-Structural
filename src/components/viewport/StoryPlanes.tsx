"use client";

import { Text } from "@react-three/drei";
import { DoubleSide } from "three";
import type { StructuralStory } from "@/lib/types/geometry";
import type { ModelExtent } from "@/lib/geometry/deriveGridsFromElements";

interface StoryPlanesProps {
  stories: StructuralStory[];
  selectedStoryId: string | null;
  onSelectStory: (storyId: string) => void;
  /**
   * true হলে (draw mode চালু) onClick prop সম্পূর্ণ বাদ দেওয়া হয়।
   * এটা GridLines এর চেয়েও বেশি গুরুত্বপূর্ণ এখানে — StoryPlanes পুরো
   * ২০x২০ মিটার এলাকা কভার করা একটা solid প্লেন, তাই fix ছাড়া draw
   * mode এ প্রায় প্রতিটা ক্লিকই এই প্লেনে আটকে যেত এবং নিচের DrawPlane
   * পর্যন্ত পৌঁছাতোই না (GridLines.tsx এর কমেন্টে বিস্তারিত কারণ)।
   */
  interactionDisabled?: boolean;
  /** মডেল bounding box — না দিলে পুরনো ২০মি ডিফল্ট span বজায় থাকে (দ্র. GridLines.tsx) */
  extent?: ModelExtent;
}

const DEFAULT_PLANE_SPAN = 20;

/**
 * প্রতিটা story কে একটা অর্ধ-স্বচ্ছ অনুভূমিক প্লেন হিসেবে দেখায়,
 * সাথে elevation লেখা থাকে। base level (isBaseLevel) আলাদা রঙে
 * চিহ্নিত থাকে যাতে ইঞ্জিনিয়ার সহজে ফাউন্ডেশন লেভেল চিনতে পারেন।
 */
export function StoryPlanes({
  stories,
  selectedStoryId,
  onSelectStory,
  interactionDisabled = false,
  extent,
}: StoryPlanesProps) {
  const visibleStories = stories.filter((s) => s.visible);
  const planeSpan = extent ? extent.span + 4 : DEFAULT_PLANE_SPAN;

  return (
    <group>
      {visibleStories.map((story) => {
        const isSelected = story.storyId === selectedStoryId;
        const baseColor = story.isBaseLevel ? "#a16207" : "#334155";
        const color = isSelected ? "#38bdf8" : story.color ?? baseColor;

        return (
          <group key={story.storyId} position={[0, story.elevation, 0]}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={
                interactionDisabled
                  ? undefined
                  : (e) => {
                      e.stopPropagation();
                      onSelectStory(story.storyId);
                    }
              }
            >
              <planeGeometry args={[planeSpan, planeSpan]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isSelected ? 0.14 : 0.06}
                side={DoubleSide}
              />
            </mesh>
            <Text
              position={[-planeSpan / 2 - 1.2, 0, -planeSpan / 2]}
              fontSize={0.32}
              color={color}
              anchorX="left"
              anchorY="middle"
            >
              {`${story.name} (EL ${story.elevation.toFixed(2)}m)`}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
