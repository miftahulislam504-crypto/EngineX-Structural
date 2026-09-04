import * as THREE from "three";

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface PlanarPolygonMeshResult {
  /** Extruded geometry, already built in its own local 2D (u, v) basis — position/quaternion (below) place it in world space. */
  geometry: THREE.ExtrudeGeometry;
  /** World-space centroid of the polygon — use as the mesh's `position`. */
  position: [number, number, number];
  /** Rotates the local (u, v, normal) basis to align with world axes — use as the mesh's `quaternion`. */
  quaternion: THREE.Quaternion;
}

/**
 * একটা arbitrary-plane polygon (flat horizontal slab, vertical wall, বা
 * inclined stair waist slab — যেকোনো orientation) থেকে সঠিকভাবে
 * positioned/oriented একটা extruded 3D mesh geometry বানায়।
 *
 * আগে AreaElementMesh (দুই viewport এই duplicate) hardcoded ধরে নিত
 * polygon সবসময় flat XZ প্লেনে থাকে — শুধু vertices[].x আর vertices[].z
 * পড়ে shape বানাত, Y পুরোপুরি উপেক্ষা করে rotateX(-90°) দিয়ে জোর করে
 * flat বসিয়ে দিত, position একটা constant averageY তে। এটা flat slab এর
 * জন্য কাকতালীয়ভাবে ঠিক দেখাত, কিন্তু inclined stair waist slab (Y
 * vertex থেকে vertex এ পাল্টায়) বা vertical wall এ ভুল geometry
 * তৈরি করত — waist slab flat হয়ে যেত, সব storey mixed averageY তে গিয়ে
 * slab/beam/column এর সাথে misalign হতো।
 *
 * এই function বদলে polygon এর প্রকৃত 3D plane derive করে:
 *   1. Newell's method দিয়ে polygon normal বের করে (non-planar হলেও
 *      robust — ইতিমধ্যে weightOptimization.ts এর
 *      computePlanarPolygon3DAreaM2 এ একই পদ্ধতি ব্যবহৃত ও verified)।
 *   2. normal থেকে একটা orthonormal local basis (u, v, normal) বানায়।
 *   3. প্রতিটা vertex কে local (u, v) কোঅর্ডিনেটে project করে সেই
 *      প্লেনেই 2D shape বানায় ও extrude করে (depth = thickness, normal
 *      বরাবর)।
 *   4. geometry কে centroid-এ কেন্দ্র করে world-এ position/quaternion
 *      দিয়ে সঠিক জায়গায়/অভিমুখে বসায়।
 *
 * ফলাফল: flat horizontal slab আগের মতোই সঠিক থাকে (normal ≈ +Y হলে এই
 * function পুরনো rotateX(-90°) behavior এর সমতুল্য ফল দেয়), আর
 * inclined/vertical polygon ও এখন geometrically সঠিক।
 */
export function buildPlanarPolygonMesh(
  vertices: Point3D[],
  thicknessMm: number
): PlanarPolygonMeshResult | null {
  if (vertices.length < 3) return null;

  const pts = vertices.map((v) => new THREE.Vector3(v.x, v.y, v.z));

  // Newell's method — non-planar/noisy vertex সেটেও একটা robust average
  // normal দেয়, শুধু প্রথম তিন vertex থেকে cross product নেওয়ার চেয়ে
  // ভালো (তিনটে প্রায়-কোলিনিয়ার হলে সেটা degenerate হতে পারত)।
  const normal = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    normal.x += (curr.y - next.y) * (curr.z + next.z);
    normal.y += (curr.z - next.z) * (curr.x + next.x);
    normal.z += (curr.x - next.x) * (curr.y + next.y);
  }
  if (normal.lengthSq() < 1e-10) return null; // degenerate (সব vertex কলিনিয়ার)
  normal.normalize();

  const centroid = new THREE.Vector3();
  pts.forEach((p) => centroid.add(p));
  centroid.divideScalar(pts.length);

  // local basis: normal-এর সাথে orthogonal দুইটা vector (u, v)।
  // reference axis হিসেবে world-Y ব্যবহার করা হচ্ছে, normal প্রায়
  // world-Y এর সমান্তরাল হলে (flat horizontal polygon) world-X এ পড়ে
  // যাই, যাতে cross product degenerate না হয়।
  const worldUp = new THREE.Vector3(0, 1, 0);
  const reference = Math.abs(normal.dot(worldUp)) > 0.999
    ? new THREE.Vector3(1, 0, 0)
    : worldUp;
  const u = new THREE.Vector3().crossVectors(reference, normal).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();

  // প্রতিটা vertex কে (u, v) local 2D কোঅর্ডিনেটে project করে shape বানাই।
  const shape = new THREE.Shape();
  const toLocal = (p: THREE.Vector3) => {
    const rel = new THREE.Vector3().subVectors(p, centroid);
    return { lu: rel.dot(u), lv: rel.dot(v) };
  };
  const first = toLocal(pts[0]);
  shape.moveTo(first.lu, first.lv);
  for (let i = 1; i < pts.length; i++) {
    const { lu, lv } = toLocal(pts[i]);
    shape.lineTo(lu, lv);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(thicknessMm / 1000, 0.01),
    bevelEnabled: false,
  });

  // local basis (u, v, normal) কে world axes-এ align করার rotation।
  // ExtrudeGeometry স্থানীয়ভাবে XY প্লেনে বানানো হয় ও +Z বরাবর extrude
  // হয় — তাই local-X ↦ u, local-Y ↦ v, local-Z ↦ normal ম্যাপ করা হচ্ছে।
  const basisMatrix = new THREE.Matrix4().makeBasis(u, v, normal);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(basisMatrix);

  return {
    geometry,
    position: [centroid.x, centroid.y, centroid.z],
    quaternion,
  };
}
