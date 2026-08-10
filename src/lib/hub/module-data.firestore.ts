"use client";

// src/lib/hub/module-data.firestore.ts
//
// Ported from EngineXDraw's apps/web/src/lib/hub/module-data.firestore.ts,
// itself ported from CivilOS Hub's lib/firestore/module-data.firestore.ts
// — see the header comment on event.firestore.ts for the db()/
// firestorePaths wiring changes (this file also needs storage(), this
// app's equivalent lazy getter for Firebase Storage — see
// src/lib/firebase/client.ts).
//
// Hub's own design principle (see its file comment): "Large Geometry,
// Analysis Matrix, Mesh, Large Result Dataset, Generated PDF, Excel,
// Model Snapshot — these go to Firebase Storage. Firestore only holds
// metadata/status/reference/version/storagePath." This app's BBS exports
// (xlsx/pdf, already implemented — see src/lib/documentation) and future
// analysis/design result bundles are exactly this kind of heavy data, so
// Phase 6 (Structural → Hub outgoing sync) is expected to push them
// through uploadModuleData() rather than as inline Firestore document
// fields. Nothing in this app calls it yet — Phase 0 only wires up the
// function itself.

import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import type { ModuleId } from "./dependency.types";
import type { SourceApp } from "./contract.types";
import { bumpModuleVersion } from "./dependency.firestore";

export interface ModuleDataFile {
  fileName: string;
  fileUrl: string;
  storagePath: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  sourceApp: SourceApp;
  moduleVersion: number;
}

// Storage path: projects/{projectId}/moduleData/{moduleId}/{timestamp}_{filename}
export async function uploadModuleData(
  projectId: string,
  moduleId: ModuleId,
  sourceApp: SourceApp,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ModuleDataFile> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `projects/${projectId}/moduleData/${moduleId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage(), storagePath);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      () => resolve(),
    );
  });

  const fileUrl = await getDownloadURL(storageRef);
  const moduleVersion = await bumpModuleVersion(projectId, moduleId);

  const record: ModuleDataFile = {
    fileName: file.name,
    fileUrl,
    storagePath,
    fileSize: file.size,
    fileType: file.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    sourceApp,
    moduleVersion,
  };

  await setDoc(doc(db(), firestorePaths.hubModuleDataMetadata(projectId, moduleId)), {
    ...record,
    updatedAt: serverTimestamp(),
  });

  return record;
}

export async function getModuleDataFile(projectId: string, moduleId: ModuleId): Promise<ModuleDataFile | null> {
  const snap = await getDoc(doc(db(), firestorePaths.hubModuleDataMetadata(projectId, moduleId)));
  if (!snap.exists()) return null;
  const d = snap.data();
  if (!d.storagePath) return null;
  return {
    fileName: d.fileName,
    fileUrl: d.fileUrl,
    storagePath: d.storagePath,
    fileSize: d.fileSize,
    fileType: d.fileType,
    uploadedAt: d.uploadedAt,
    sourceApp: d.sourceApp,
    moduleVersion: d.moduleVersion,
  } as ModuleDataFile;
}
