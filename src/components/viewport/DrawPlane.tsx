"use client";

import type { ThreeEvent } from "@react-three/fiber";

interface DrawPlaneProps {
  elevation: number;
  onPointClick: (point: { x: number; y: number; z: number }) => void;
}

const PLANE_SPAN = 40; // grid এর চেয়ে বড় span, যাতে grid এর বাইরেও ক্লিক করা যায়

/**
 * একটা অদৃশ্য অনুভূমিক প্লেন যা draw mode চালু থাকা অবস্থায় mount হয়,
 * নির্দিষ্ট elevation এ বসে। React Three Fiber এর built-in raycasting
 * এই প্লেনের সাথে ক্লিক-রে এর intersection বের করে দেয় (event.point
 * এ), যেটা আমরা সরাসরি world coordinate হিসেবে ব্যবহার করি।
 *
 * এটা StoryPlanes থেকে আলাদা কম্পোনেন্ট রাখা হয়েছে কারণ StoryPlanes
 * এর উদ্দেশ্য visual (semi-transparent, story দেখানো), আর এই প্লেন
 * এর উদ্দেশ্য purely interactive (সম্পূর্ণ অদৃশ্য, শুধু raycasting
 * target হিসেবে কাজ করে) — দুটো মিশিয়ে ফেললে StoryPlanes এর props
 * এ draw-mode-specific জিনিস ঢুকে যেত, যা তার একক দায়িত্বের বাইরে।
 */
export function DrawPlane({ elevation, onPointClick }: DrawPlaneProps) {
  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onPointClick({ x: e.point.x, y: elevation, z: e.point.z });
  }

  return (
    <mesh position={[0, elevation, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
      <planeGeometry args={[PLANE_SPAN, PLANE_SPAN]} />
      {/* transparent+opacity=0 ব্যবহার করা হয়েছে material.visible=false
          এর বদলে — এই প্লেনের raycasting (ক্লিক ধরা) কাজ করা জরুরি,
          কিন্তু rendering এ সম্পূর্ণ অদৃশ্য থাকা উচিত। opacity=0 দুটোই
          নিশ্চিত করে। */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
