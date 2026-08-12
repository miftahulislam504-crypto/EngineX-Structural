"use client";

import { Text } from "@react-three/drei";

/**
 * Origin (0,0,0) এবং X/Y/Z অক্ষ নির্দেশক। Three.js এর দুনিয়ায় Y-অক্ষ
 * "উপর" (আমরা elevation কে Y হিসেবে ধরছি, স্ট্রাকচারাল ইঞ্জিনিয়ারিং
 * এ যদিও সাধারণত Z কে উচ্চতা ধরা হয় — কিন্তু Three.js/R3F এর native
 * up-axis Y, এবং viewport controls (OrbitControls) সেই কনভেনশন
 * ধরেই কাজ করে সবচেয়ে স্বাভাবিকভাবে, তাই viewport এ Y=elevation
 * ব্যবহার করা হচ্ছে। Firestore এ ডেটা কিন্তু ইঞ্জিনিয়ারিং কনভেনশন
 * মেনে elevation নামেই থাকছে, অক্ষের নাম নিয়ে বিভ্রান্তি এড়াতে)।
 */
export function OriginMarker() {
  const axisLength = 2;

  return (
    <group>
      {/* X axis — red */}
      <mesh position={[axisLength / 2, 0, 0]}>
        <boxGeometry args={[axisLength, 0.02, 0.02]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <Text position={[axisLength + 0.3, 0, 0]} fontSize={0.3} color="#ef4444">
        X
      </Text>

      {/* Z axis — blue (plan-view horizontal, perpendicular to X) */}
      <mesh position={[0, 0, axisLength / 2]}>
        <boxGeometry args={[0.02, 0.02, axisLength]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>
      <Text position={[0, 0, axisLength + 0.3]} fontSize={0.3} color="#3b82f6">
        Z
      </Text>

      {/* Y axis (elevation/up) — green */}
      <mesh position={[0, axisLength / 2, 0]}>
        <boxGeometry args={[0.02, axisLength, 0.02]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <Text position={[0, axisLength + 0.3, 0]} fontSize={0.3} color="#22c55e">
        Y (EL)
      </Text>

      {/* Origin point */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}
