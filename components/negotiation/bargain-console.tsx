"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  BargainThread,
  type QuickReply,
} from "@/components/negotiation/bargain-thread";
import { Badge } from "@/components/ui/badge";
import { QUANTITY_UNITS } from "@/lib/domain/enums";
import { formatRate, money } from "@/lib/domain/money";
import type { GradeBand } from "@/lib/domain/models";
import {
  gap,
  hasExpired,
  rateFor,
  standingProposal,
  type Negotiation,
  type Party,
} from "@/lib/domain/negotiation";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The bargaining screen: threads down the left, the open one on the right.
 *
 * Sending goes through the API and then `router.refresh()`, so what comes back
 * is what Firestore holds. Optimistically appending would be pleasant and
 * wrong — the other side may have countered or walked away in the meantime,
 * and this screen decides what a farmer is paid.
 */
export function BargainConsole({
  threads,
  viewer,
  now,
  quickReplies,
  validForMinutes,
  editable,
}: {
  threads: Negotiation[];
  viewer: Party;
  now: number;
  quickReplies: readonly QuickReply[];
  validForMinutes: number;
  editable: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(threads[0]?.id ?? null);
  const [pending, setPending] = useState(false);

  const selected = threads.find((t) => t.id === selectedId) ?? threads[0];

  async function send(draft: {
    kind: "note" | "proposal" | "accept" | "withdraw";
    text?: string;
    bands?: GradeBand[];
    validForMinutes?: number;
  }): Promise<boolean> {
    if (!selected) return false;

    if (!editable) {
      toast.error("Read only", {
        description:
          "Bargaining is disabled until the console is behind authentication — the endpoint cannot yet tell who is sending.",
      });
      return false;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/negotiations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          author: viewer,
          locale: viewer === "farmer" ? "ta" : "en",
          // Rates travel as paise keyed by grade, not as an array, so a
          // reordered array cannot quietly reprice the wrong grade.
          bands: draft.bands
            ? Object.fromEntries(draft.bands.map((b) => [b.grade, b.ratePerUnit]))
            : undefined,
        }),
      });

      if (!response.ok) {
        const detail = await response
          .json()
          .then((d: { error?: string }) => d.error)
          .catch(() => null);

        // 402 is the one refusal the person can clear themselves, so it gets a
        // way out rather than an apology. The button that reached here was
        // deliberately not hidden — seeing what bargaining looks like is how
        // someone decides the plan is worth it.
        if (response.status === 402) {
          toast.error("Subscription needed", {
            description: detail ?? "Bargaining needs an active plan.",
            action: {
              label: "See plans",
              onClick: () => router.push("/subscription"),
            },
          });
          return false;
        }

        toast.error("Not sent", {
          description: detail ?? `Server returned ${response.status}.`,
        });
        return false;
      }

      const result = (await response.json()) as { status: string };
      if (result.status === "agreed") {
        toast.success("Price agreed", {
          description: "These rates are now binding for this listing.",
        });
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

  if (threads.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-12 text-sm">
        No bargains yet.
      </div>
    );
  }

  return (
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[20rem_1fr]">
      <ul className="max-h-[calc(100svh-4rem)] overflow-y-auto border-b lg:border-r lg:border-b-0">
        {threads.map((thread) => {
          const standing = standingProposal(thread);
          const waiting =
            thread.status === "open" &&
            standing !== undefined &&
            standing.author !== viewer &&
            !hasExpired(standing, now);
          const distance = gap(thread);
          const last = thread.messages.at(-1);
          const active = thread.id === selected?.id;

          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => setSelectedId(thread.id)}
                aria-current={active}
                className={cn(
                  "hover:bg-muted/60 focus-visible:ring-ring flex w-full flex-col gap-1.5 border-b p-3 text-left focus-visible:ring-2 focus-visible:outline-none",
                  active && "bg-muted",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{thread.produceName}</span>
                  {thread.status === "open" ? (
                    waiting ? (
                      <Badge className="bg-warning-soft text-warning border-warning/40 border">
                        Your move
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Waiting</Badge>
                    )
                  ) : (
                    <Badge
                      variant="outline"
                      className={
                        thread.status === "agreed"
                          ? "border-success/40 bg-success-soft text-success"
                          : "text-muted-foreground"
                      }
                    >
                      {thread.status === "agreed" ? "Agreed" : "Closed"}
                    </Badge>
                  )}
                </span>

                <span className="text-muted-foreground text-xs">
                  {viewer === "buyer" ? thread.farmerName : thread.buyerName} ·{" "}
                  {thread.quantity} {QUANTITY_UNITS[thread.unit].en}
                </span>

                <span className="text-faint flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">
                    {last?.kind === "proposal"
                      ? `${last.author === viewer ? "You" : "They"} proposed ${formatRate(
                          money(rateFor(last.bands ?? [], "a") ?? 0),
                          QUANTITY_UNITS[thread.unit].en,
                        )} / A`
                      : (last?.text ?? "No messages")}
                  </span>
                  {last ? <span>{relativeTime(last.sentAt, now)}</span> : null}
                </span>

                {thread.status === "open" && distance.a !== undefined ? (
                  <span className="text-faint tabular text-xs">
                    {formatRate(money(distance.a), QUANTITY_UNITS[thread.unit].en)}{" "}
                    apart on grade A
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="max-h-[calc(100svh-4rem)] min-h-0">
        {selected ? (
          <BargainThread
            key={selected.id}
            negotiation={selected}
            viewer={viewer}
            now={now}
            quickReplies={quickReplies}
            validForMinutes={validForMinutes}
            onSend={send}
            pending={pending}
          />
        ) : null}
      </div>
    </div>
  );
}
