"use client";

import { BellOffIcon, BellRingIcon, LoaderIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { firebaseConfig } from "@/lib/firebase/config";

/**
 * Turning phone notifications on, for this device.
 *
 * Per device, not per person: a farmer with the console open on a laptop and
 * the app on a phone has two registrations and both should buzz, so this asks
 * on whichever one it is running on.
 *
 * It never asks on its own. A permission prompt that appears unprompted is the
 * one people dismiss without reading — and a dismissed prompt in most browsers
 * cannot be asked again, so a single mistimed request costs the channel
 * permanently. It appears as a button, and the browser is only asked once
 * somebody has pressed it.
 */

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

type State = "unsupported" | "unconfigured" | "off" | "asking" | "on" | "blocked";

/**
 * The browser's permission, read as the external state it is.
 *
 * Not an effect writing to state: `Notification.permission` is a value owned by
 * the browser, and copying it into React state on mount is the cascading render
 * `useSyncExternalStore` exists to avoid. Nothing to subscribe to — the
 * permission only changes through the prompt this component raises, or through
 * browser settings, which reloads the page.
 */
const subscribe = () => () => {};

/** `"unavailable"` when this browser cannot do web push at all. */
function readPermission(): NotificationPermission | "unavailable" {
  if (typeof window === "undefined") return "default";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unavailable";
  }
  return Notification.permission;
}

export function PushToggle({ className }: { className?: string }) {
  // Server renders "default", the client corrects it after hydration. Both are
  // honest: on the server there is no browser to have granted anything.
  const permission = useSyncExternalStore(subscribe, readPermission, () => "default");

  const [pending, setPending] = useState<"asking" | null>(null);
  const [granted, setGranted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const state: State = pending
    ? "asking"
    : permission === "unavailable"
      ? "unsupported"
      : // The VAPID key is a per-project Web Push credential from the Firebase
        // console. Without it `getToken` fails with a message nobody can act
        // on, so the button says what is missing instead.
        !VAPID_KEY || !firebaseConfig.projectId
        ? "unconfigured"
        : permission === "denied"
          ? "blocked"
          : permission === "granted" || granted
            ? "on"
            : "off";

  const setState = (next: State) => {
    setPending(next === "asking" ? "asking" : null);
    if (next === "on") setGranted(true);
    if (next === "off") setGranted(false);
  };

  async function enable() {
    setState("asking");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }

      // The worker is fetched by URL, outside the bundle, so it cannot read the
      // build's environment — the config rides along in the query string.
      const query = new URLSearchParams({
        apiKey: firebaseConfig.apiKey ?? "",
        authDomain: firebaseConfig.authDomain ?? "",
        projectId: firebaseConfig.projectId ?? "",
        messagingSenderId: firebaseConfig.messagingSenderId ?? "",
        appId: firebaseConfig.appId ?? "",
      });

      const registration = await navigator.serviceWorker.register(
        `/firebase-messaging-sw.js?${query}`,
      );

      // Imported here rather than at the top of the file: the messaging SDK is
      // a sizeable chunk, and every console page would carry it for a button
      // most people press once.
      const { getMessaging, getToken } = await import("firebase/messaging");
      const { firebaseApp } = await import("@/lib/firebase/client");

      const fresh = await getToken(getMessaging(firebaseApp()), {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (!fresh) {
        setState("off");
        toast.error("Could not register this device.");
        return;
      }

      const response = await fetch("/api/notifications/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: fresh, label: navigator.userAgent.slice(0, 80) }),
      });

      if (!response.ok) {
        setState("off");
        const detail = (await response.json().catch(() => ({}))) as { error?: string };
        toast.error(detail?.error ?? "Could not register this device.");
        return;
      }

      setToken(fresh);
      setState("on");
      toast.success("Phone notifications on", {
        description: "Offers, settled prices and transport will reach this device.",
      });
    } catch (error) {
      setState("off");
      console.error("push registration failed", error);
      toast.error("Could not turn on notifications here.");
    }
  }

  async function disable() {
    setState("asking");
    try {
      if (token) {
        await fetch("/api/notifications/push", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
      }
      setToken(null);
      setState("off");
      toast.success("Turned off on this device");
    } catch {
      setState("on");
      toast.error("Could not turn them off.");
    }
  }

  if (state === "unsupported") {
    return (
      <p className={className}>
        <span className="text-faint text-xs">
          This browser cannot show phone notifications.
        </span>
      </p>
    );
  }

  if (state === "unconfigured") {
    return (
      <p className={className}>
        <span className="text-faint text-xs">
          Phone notifications are not set up on this deployment.
        </span>
      </p>
    );
  }

  if (state === "blocked") {
    return (
      <p className={className}>
        <span className="text-warning text-xs">
          Notifications are blocked for this site. Turn them back on in your
          browser&rsquo;s site settings — the page cannot ask again.
        </span>
      </p>
    );
  }

  return (
    <Button
      className={className}
      size="sm"
      variant={state === "on" ? "outline" : "default"}
      disabled={state === "asking"}
      onClick={state === "on" ? disable : enable}
    >
      {state === "asking" ? (
        <LoaderIcon className="size-3.5 animate-spin" />
      ) : state === "on" ? (
        <BellOffIcon className="size-3.5" />
      ) : (
        <BellRingIcon className="size-3.5" />
      )}
      {state === "on" ? "Turn off on this device" : "Notify me on this device"}
    </Button>
  );
}
