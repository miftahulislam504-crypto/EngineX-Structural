"use client";

import { useFrame } from "@react-three/fiber";
import { useVisualizationViewStore } from "@/lib/viewport/useVisualizationViewStore";

const CYCLE_SECONDS = 2.5;

/**
 * Phase 10l/10p — Deformation ও Mode Shape animation driver।
 *
 * এই component কোনো geometry render করে না (null রিটার্ন করে) — শুধু
 * useFrame হুক ব্যবহার করে প্রতি frame এ useVisualizationViewStore এর
 * animationPhase (10l, deformed shape breathing) ও/অথবা
 * modeShapeAnimationPhase (10p, mode shape breathing) আপডেট করে (0 →
 * 1 → 0, ২.৫ সেকেন্ড cycle এ, smooth loop)। VisualizationElementsLayer
 * সেই phase (sin দিয়ে modulated) ব্যবহার করে scale multiply করে।
 *
 * দুইটা আলাদা animation একই useFrame hook এ handle করা হচ্ছে (আলাদা
 * component না বানিয়ে) কারণ দুইটাই একই clock থেকে phase বের করে,
 * শুধু ভিন্ন enable flag/target state এ লেখে — একই hook এ if-branch
 * দিয়ে যথেষ্ট, দুইটা প্রায়-অভিন্ন Canvas child component ডুপ্লিকেট
 * করার দরকার নেই।
 *
 * আলাদা component হিসেবে রাখা হলো কারণ useFrame শুধু <Canvas> এর
 * ভেতরে কাজ করে (react-three-fiber requirement) — VisualizationViewport
 * এর মূল ফাংশনে সরাসরি useFrame কল করা যাবে না (সেটা Canvas এর বাইরে
 * রান হয়), তাই এই ছোট child component Canvas এর ভেতরে বসিয়ে useFrame
 * ব্যবহার করা হচ্ছে — react-three-fiber এর standard প্যাটার্ন।
 *
 * isAnimating false হলে useFrame এর ভেতরেই early-return করে কিছু
 * করে না (phase আগের মান ধরে রাখে, static deformed shape দেখাতে)।
 */
export function DeformationAnimator() {
  const isAnimating = useVisualizationViewStore((s) => s.isAnimating);
  const setAnimationPhase = useVisualizationViewStore((s) => s.setAnimationPhase);
  const modeShapeAnimating = useVisualizationViewStore((s) => s.modeShapeAnimating);
  const setModeShapeAnimationPhase = useVisualizationViewStore((s) => s.setModeShapeAnimationPhase);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (isAnimating) {
      const phase = (t % CYCLE_SECONDS) / CYCLE_SECONDS; // 0..1, ক্রমাগত loop
      setAnimationPhase(phase);
    }
    // Phase 10p — mode shape animation একই clock ব্যবহার করে কিন্তু
    // independent enable flag এ (deformation animation ও mode shape
    // animation একসাথে চালু থাকতে পারে না UI তে — VisualizationViewport
    // এ mutually exclusive রাখা হয়েছে, কিন্তু এখানে driver level এ
    // দুইটা আলাদা useFrame hook না রেখে (React Three Fiber একাধিক
    // useFrame perf-wise খারাপ না, কিন্তু একই clock থেকে phase বের করা
    // যখন লাগে তখন একটাই hook যথেষ্ট) একসাথে handle করা হচ্ছে।
    if (modeShapeAnimating) {
      const phase = (t % CYCLE_SECONDS) / CYCLE_SECONDS;
      setModeShapeAnimationPhase(phase);
    }
  });

  return null;
}
