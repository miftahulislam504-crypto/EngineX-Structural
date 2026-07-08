import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Firebase config — Hub এবং এই App একই Firebase project শেয়ার করে,
 * তাই একই env vars ব্যবহার করা হচ্ছে (Vercel-এ সেট করতে হবে)।
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

/**
 * গুরুত্বপূর্ণ: এখানে ইচ্ছাকৃতভাবে lazy getter ব্যবহার করা হয়েছে
 * (module-level `export const auth = getAuth(...)` নয়)।
 *
 * কারণ: "use client" পেজেও Next.js build worker route module-টা
 * একবার লোড/evaluate করে prerendering চেষ্টার সময়, browser-এ পৌঁছানোর
 * আগেই। module top-level এ getAuth()/getFirestore() সরাসরি কল করলে
 * সেটা build-time এ (যখন env vars খালি বা placeholder) চলে গিয়ে
 * "auth/invalid-api-key" এরর দিয়ে পুরো build ভেঙে দেয়।
 *
 * getter ফাংশন হিসেবে রাখলে এটা শুধু তখনই রান হয় যখন কোনো client
 * component সত্যিকারে browser-এ mount হয়ে auth()/db()/storage() কল করে।
 */
let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedStorage: FirebaseStorage | null = null;

export function getFirebaseClientApp(): FirebaseApp {
  if (!cachedApp) {
    cachedApp = getFirebaseApp();
  }
  return cachedApp;
}

export function auth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseClientApp());
  }
  return cachedAuth;
}

export function db(): Firestore {
  if (!cachedDb) {
    cachedDb = getFirestore(getFirebaseClientApp());
  }
  return cachedDb;
}

export function storage(): FirebaseStorage {
  if (!cachedStorage) {
    cachedStorage = getStorage(getFirebaseClientApp());
  }
  return cachedStorage;
}
