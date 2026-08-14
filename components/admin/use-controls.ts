"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { EditableCollection } from "@/lib/domain/controls";

/**
 * Create, update and delete against the controls API.
 *
 * Every mutation ends with `router.refresh()` rather than local state
 * surgery. The Controls page reads from Firestore in a server component, so a
 * refresh re-reads the source of truth — the screen can never disagree with
 * the database, and a write that half-failed shows the real result instead of
 * an optimistic lie about reference data everything else depends on.
 *
 * The API returns a plain `error` string for every failure, so a rejected
 * write surfaces the server's own reason ("still used by 9 listings") rather
 * than a generic message invented here.
 */
export function useControls() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function send(
    method: "POST" | "PATCH" | "DELETE",
    collection: EditableCollection,
    id: string | null,
    body?: Record<string, unknown>,
  ): Promise<boolean> {
    setPending(true);
    try {
      const url = id
        ? `/api/controls/${collection}/${encodeURIComponent(id)}`
        : `/api/controls/${collection}`;

      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const detail = await response
          .json()
          .then((d: { error?: string }) => d.error)
          .catch(() => null);

        toast.error("Could not save", {
          description:
            detail ??
            (response.status === 404
              ? "The write API is only available in development until authentication is connected."
              : `Server returned ${response.status}.`),
        });
        return false;
      }

      router.refresh();
      return true;
    } catch {
      toast.error("Could not reach the server");
      return false;
    } finally {
      setPending(false);
    }
  }

  return {
    pending,
    create: (collection: EditableCollection, body: Record<string, unknown>) =>
      send("POST", collection, null, body),
    update: (
      collection: EditableCollection,
      id: string,
      body: Record<string, unknown>,
    ) => send("PATCH", collection, id, body),
    remove: (collection: EditableCollection, id: string) =>
      send("DELETE", collection, id),
  };
}
