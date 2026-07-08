import type { StructuralGrid } from "@/lib/types/geometry";
import type { Point3D } from "@/lib/types/element";

/**
 * একটা raw ৩D পয়েন্টকে সবচেয়ে কাছের Grid intersection এ snap করে।
 *
 * পদ্ধতি: X-direction গ্রিডগুলোর মধ্যে raw point এর x-কোঅর্ডিনেটের
 * সবচেয়ে কাছেরটা খুঁজে বের করা, Y-direction গ্রিডগুলোর মধ্যে
 * z-কোঅর্ডিনেটের সবচেয়ে কাছেরটা খুঁজে বের করা (মনে রাখবেন viewport
 * এ Y=elevation, তাই "প্লান" কোঅর্ডিনেট আসলে X ও Z)। দুটো মিলিয়ে
 * snap করা পয়েন্ট তৈরি হয়।
 *
 * snapThreshold এর বাইরে হলে snap করা হয় না (raw coordinate ব্যবহৃত
 * হয়) — নাহলে দূরের কোনো গ্রিডে ভুল করে snap হয়ে যেতে পারে, যেটা
 * বিভ্রান্তিকর হবে ইঞ্জিনিয়ারের জন্য।
 */
export function snapToNearestGrid(
  point: Point3D,
  grids: StructuralGrid[],
  snapThreshold: number = 0.75 // মিটার — এই দূরত্বের মধ্যে গ্রিড থাকলেই snap হবে
): Point3D {
  const xGrids = grids.filter((g) => g.direction === "X" && g.visible);
  const yGrids = grids.filter((g) => g.direction === "Y" && g.visible);

  const snappedX = findNearestCoordinate(point.x, xGrids, snapThreshold);
  const snappedZ = findNearestCoordinate(point.z, yGrids, snapThreshold);

  return {
    x: snappedX,
    y: point.y,
    z: snappedZ,
  };
}

function findNearestCoordinate(
  value: number,
  candidateGrids: StructuralGrid[],
  threshold: number
): number {
  if (candidateGrids.length === 0) {
    return value;
  }

  let nearest = candidateGrids[0];
  let nearestDistance = Math.abs(value - nearest.coordinate);

  for (const grid of candidateGrids) {
    const distance = Math.abs(value - grid.coordinate);
    if (distance < nearestDistance) {
      nearest = grid;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= threshold ? nearest.coordinate : value;
}
