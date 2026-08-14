import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { firebaseConfig, requireFirebaseConfig } from "./config";

/**
 * The browser Firebase SDK.
 *
 * **Reads only.** Security Rules deny every client write, and the only path to
 * a mutation is a Next.js route handler holding Admin SDK credentials. Use
 * this for `onSnapshot` listeners and one-off gets; never for `setDoc`,
 * `updateDoc`, `addDoc` or `deleteDoc`. See the architecture doc, "Trust
 * boundary".
 *
 * Live listeners are the reason Firestore was chosen over a relational store,
 * so reads staying direct is the point — not a shortcut.
 */

let app: FirebaseApp | undefined;

/**
 * Reuses the existing app rather than initialising twice. Next re-executes
 * modules across HMR boundaries and route transitions, and a second
 * `initializeApp` with the same name throws.
 */
export function firebaseApp(): FirebaseApp {
  if (app) return app;
  app =
    getApps().length > 0 ? getApp() : initializeApp(requireFirebaseConfig());
  return app;
}

export function firestore(): Firestore {
  return getFirestore(firebaseApp());
}

export function auth(): Auth {
  return getAuth(firebaseApp());
}

/**
 * Analytics, loaded lazily and only where it works.
 *
 * `getAnalytics()` reads `window` and throws if called during a server render,
 * which is why the config snippet from the Firebase console cannot be pasted
 * into a Next app unchanged. `isSupported()` additionally covers browsers with
 * storage disabled and unsupported webviews.
 *
 * The dynamic import keeps roughly 40 KB of analytics out of the initial
 * bundle — which matters most on the farmer PWA, where the target is a budget
 * Android on an intermittent connection.
 *
 * Returns `null` when analytics is unavailable, so callers never branch on
 * environment themselves.
 */
export async function analytics() {
  if (typeof window === "undefined") return null;
  if (!firebaseConfig.measurementId) return null;

  const { getAnalytics, isSupported } = await import("firebase/analytics");
  if (!(await isSupported())) return null;

  return getAnalytics(firebaseApp());
}
