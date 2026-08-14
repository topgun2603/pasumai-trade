"use client";

import {
  ArrowRightIcon,
  CheckIcon,
  HandshakeIcon,
  MessageSquareIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { countdown, relativeTime } from "@/lib/format";
import { GRADES, GRADE_LABELS, QUANTITY_UNITS } from "@/lib/domain/enums";
import { formatMoney, formatRate, money } from "@/lib/domain/money";
import type { GradeBand } from "@/lib/domain/models";
import {
  canAccept,
  canPropose,
  gap,
  hasExpired,
  isSettled,
  lastProposalBy,
  PARTY_LABELS,
  rateFor,
  roundCount,
  standingProposal,
  valueAt,
  type Negotiation,
  type NegotiationMessage,
  type Party,
} from "@/lib/domain/negotiation";
import { LOCALE_META, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * A price bargain, as a thread.
 *
 * Two things make this different from a chat box with a number in it:
 *
 *  - A **proposal is a card, not a sentence.** All three grade rates, and what
 *    the lot is worth at each, laid out the same way every time. A price
 *    buried in prose is a price that gets misread — and the farmer reading it
 *    may be doing so on a phone, in a field, in a second language.
 *
 *  - **The guards decide what is offered.** Accept and Send are enabled by the
 *    same domain functions the server enforces, and when they refuse, the
 *    reason is shown rather than the button silently doing nothing.
 *
 * `now` is passed in from the server so the countdown renders identically on
 * both sides of hydration.
 */

function localeOf(message: NegotiationMessage): Locale | undefined {
  const value = message.locale;
  return value && value in LOCALE_META ? (value as Locale) : undefined;
}

/** The three rates, priced out against the actual quantity. */
function ProposalCard({
  negotiation,
  bands,
  now,
  expiresAt,
  tone,
}: {
  negotiation: Negotiation;
  bands: readonly GradeBand[];
  now: number;
  expiresAt?: Date;
  tone: "mine" | "theirs" | "agreed";
}) {
  const expired = expiresAt ? now >= expiresAt.getTime() : false;
  const unitLabel = QUANTITY_UNITS[negotiation.unit].en;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        tone === "agreed"
          ? "border-success/40 bg-success-soft"
          : tone === "mine"
            ? "border-primary/30 bg-background"
            : "border-border bg-background",
        expired && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide uppercase">
          {tone === "agreed" ? "Agreed" : "Proposed rates"}
        </span>
        {expiresAt ? (
          <Badge
            variant="outline"
            className={cn(
              "tabular",
              expired
                ? "border-border text-muted-foreground"
                : "border-warning/40 bg-warning-soft text-warning",
            )}
          >
            {countdown(expiresAt, now)}
          </Badge>
        ) : null}
      </div>

      <ul className="flex flex-col gap-1">
        {GRADES.map((grade) => {
          const rate = rateFor(bands, grade);
          if (rate === undefined) return null;
          return (
            <li key={grade} className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground text-sm">
                Grade {GRADE_LABELS[grade]}
              </span>
              <span className="tabular flex items-baseline gap-2">
                <span className="font-medium">
                  {formatRate(money(rate), unitLabel)}
                </span>
                <span className="text-faint text-xs">
                  {formatMoney(valueAt(negotiation, bands, grade))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-faint text-xs">
        Right-hand figure is the whole lot at that grade — grading happens at
        pickup, so all three are settled now.
      </p>
    </div>
  );
}

function Bubble({
  negotiation,
  message,
  viewer,
  now,
}: {
  negotiation: Negotiation;
  message: NegotiationMessage;
  viewer: Party;
  now: number;
}) {
  const mine = message.author === viewer;
  const locale = localeOf(message);

  if (message.kind === "withdraw") {
    return (
      <li className="flex flex-col items-center gap-1 py-2">
        <span className="text-muted-foreground text-xs">
          {PARTY_LABELS[message.author]} ended this bargain ·{" "}
          {relativeTime(message.sentAt, now)}
        </span>
        {message.text ? (
          <p
            lang={locale ? LOCALE_META[locale].tag : undefined}
            className="text-muted-foreground max-w-md text-center text-sm"
          >
            {message.text}
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <li className={cn("flex flex-col gap-1.5", mine ? "items-end" : "items-start")}>
      <span className="text-faint flex items-center gap-1.5 text-xs">
        {mine ? "You" : PARTY_LABELS[message.author]}
        <span aria-hidden>·</span>
        {relativeTime(message.sentAt, now)}
        {locale && locale !== "en" ? (
          <Badge variant="secondary" className="px-1 py-0 text-[10px]">
            {LOCALE_META[locale].englishName}
          </Badge>
        ) : null}
      </span>

      <div className={cn("flex max-w-md flex-col gap-2", mine && "items-end")}>
        {message.text ? (
          <p
            lang={locale ? LOCALE_META[locale].tag : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              mine
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {message.text}
          </p>
        ) : null}

        {message.bands && message.kind !== "accept" ? (
          <ProposalCard
            negotiation={negotiation}
            bands={message.bands}
            now={now}
            expiresAt={message.expiresAt}
            tone={mine ? "mine" : "theirs"}
          />
        ) : null}

        {message.kind === "accept" ? (
          <div className="border-success/40 bg-success-soft text-success flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <HandshakeIcon className="size-4 shrink-0" />
            <span>
              {mine ? "You accepted" : `${PARTY_LABELS[message.author]} accepted`} these
              rates. The order is placed.
            </span>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * A phrase offered as a tap, in the language of whoever is reading.
 *
 * Comes from Controls rather than a literal here — a farmer who cannot type
 * needs these to exist in Telugu and Kannada the day the platform reaches
 * those states, not the next time someone edits this file.
 */
export interface QuickReply {
  readonly id: string;
  readonly text: Readonly<Record<string, string>>;
}

export function BargainThread({
  negotiation,
  viewer,
  now,
  quickReplies,
  validForMinutes,
  onSend,
  pending,
}: {
  negotiation: Negotiation;
  viewer: Party;
  now: number;
  quickReplies: readonly QuickReply[];
  /** How long a proposal holds, from platform policy. */
  validForMinutes: number;
  onSend: (draft: {
    kind: "note" | "proposal" | "accept" | "withdraw";
    text?: string;
    bands?: GradeBand[];
    validForMinutes?: number;
  }) => Promise<boolean>;
  pending: boolean;
}) {
  const standing = standingProposal(negotiation);
  const theirs = standing && standing.author !== viewer ? standing : undefined;

  // Counter-offers open prefilled with what is on the table, so the buyer edits
  // a number rather than retyping three.
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const source = standing?.bands ?? [];
    return Object.fromEntries(
      GRADES.map((grade) => [grade, String((rateFor(source, grade) ?? 0) / 100 || "")]),
    );
  });
  const [text, setText] = useState("");
  const [countering, setCountering] = useState(false);

  const settled = isSettled(negotiation);
  const acceptCheck = canAccept(negotiation, viewer, now);

  const proposed: GradeBand[] = GRADES.map((grade) => ({
    grade,
    ratePerUnit: Math.round(Number(draft[grade] ?? 0) * 100),
  }));
  const proposeCheck = canPropose(negotiation, viewer, proposed);

  const distance = gap(negotiation);
  const gapGrades = GRADES.filter((g) => distance[g] !== undefined);
  const unitLabel = QUANTITY_UNITS[negotiation.unit].en;

  // A farmer reads their own language; the buyer console is English.
  const viewerLocale = viewer === "farmer" ? "ta" : "en";

  // "2h", "45m", "1h 30m" — the policy figure, said the way it reads.
  const hours = Math.floor(validForMinutes / 60);
  const minutes = validForMinutes % 60;
  const holdLabel =
    hours === 0
      ? `${minutes}m`
      : minutes === 0
        ? `${hours}h`
        : `${hours}h ${minutes}m`;

  async function send(
    kind: "note" | "proposal" | "accept" | "withdraw",
    extra: { bands?: GradeBand[]; validForMinutes?: number } = {},
  ) {
    const ok = await onSend({ kind, text: text.trim() || undefined, ...extra });
    if (ok) {
      setText("");
      setCountering(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex flex-col leading-tight">
          <span className="font-medium">
            {negotiation.produceName} · {negotiation.quantity}{" "}
            {QUANTITY_UNITS[negotiation.unit].en}
          </span>
          <span className="text-faint text-xs">
            {viewer === "buyer" ? negotiation.farmerName : negotiation.buyerName} ·{" "}
            {roundCount(negotiation)} round
            {roundCount(negotiation) === 1 ? "" : "s"} · listing{" "}
            {negotiation.listingId}
          </span>
        </div>

        {settled ? (
          <Badge
            variant="outline"
            className={
              negotiation.status === "agreed"
                ? "border-success/40 bg-success-soft text-success"
                : "border-border text-muted-foreground"
            }
          >
            {negotiation.status === "agreed"
              ? "Agreed"
              : negotiation.status === "withdrawn"
                ? "Ended"
                : "Expired"}
          </Badge>
        ) : gapGrades.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-faint text-xs">Apart by</span>
            <span className="tabular flex gap-2 text-sm">
              {gapGrades.map((grade) => (
                <span key={grade} className="flex items-baseline gap-1">
                  <span className="text-faint text-xs">{GRADE_LABELS[grade]}</span>
                  {formatRate(money(distance[grade]!), unitLabel)}
                </span>
              ))}
            </span>
          </div>
        ) : null}
      </header>

      <ol className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {negotiation.messages.map((message) => (
          <Bubble
            key={message.id}
            negotiation={negotiation}
            message={message}
            viewer={viewer}
            now={now}
          />
        ))}
      </ol>

      {settled ? (
        <footer className="bg-muted/40 border-t p-4">
          {negotiation.status === "agreed" && negotiation.agreedBands ? (
            <ProposalCard
              negotiation={negotiation}
              bands={negotiation.agreedBands}
              now={now}
              tone="agreed"
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              This thread is closed and kept as the record of what was discussed.
            </p>
          )}
        </footer>
      ) : (
        <footer className="bg-muted/40 flex flex-col gap-3 border-t p-4">
          {theirs ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => send("accept")}
                disabled={pending || !acceptCheck.allowed}
                title={acceptCheck.allowed ? undefined : acceptCheck.refusal.message}
              >
                <CheckIcon className="size-4" />
                Accept {formatRate(money(rateFor(theirs.bands ?? [], "a") ?? 0), unitLabel)}{" "}
                / A
              </Button>
              <Button variant="outline" onClick={() => setCountering((v) => !v)}>
                <ArrowRightIcon className="size-4" />
                Counter
              </Button>
              {!acceptCheck.allowed && hasExpired(theirs, now) ? (
                <span className="text-warning text-xs">
                  {acceptCheck.refusal.message}
                </span>
              ) : null}
            </div>
          ) : (
            <Button variant="outline" onClick={() => setCountering((v) => !v)}>
              <SendIcon className="size-4" />
              {lastProposalBy(negotiation, viewer) ? "Revise your rates" : "Send rates"}
            </Button>
          )}

          {countering ? (
            <div className="bg-background flex flex-col gap-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                {GRADES.map((grade) => (
                  <div key={grade} className="flex flex-col gap-1.5">
                    <Label htmlFor={`rate-${grade}`} className="text-sm">
                      Grade {GRADE_LABELS[grade]}
                      <span className="text-faint text-xs font-normal">
                        ₹ per {unitLabel}
                      </span>
                    </Label>
                    <Input
                      id={`rate-${grade}`}
                      inputMode="decimal"
                      value={draft[grade] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [grade]: e.target.value }))
                      }
                      className="tabular"
                    />
                  </div>
                ))}
              </div>

              {!proposeCheck.allowed ? (
                <p className="text-destructive text-xs">
                  {proposeCheck.refusal.message}
                </p>
              ) : (
                <p className="text-faint text-xs">
                  Whole lot at grade A:{" "}
                  {formatMoney(valueAt(negotiation, proposed, "a"))} · at grade C:{" "}
                  {formatMoney(valueAt(negotiation, proposed, "c"))}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setCountering(false)}>
                  <XIcon className="size-4" />
                  Cancel
                </Button>
                <Button
                  onClick={() => send("proposal", { bands: proposed, validForMinutes })}
                  disabled={pending || !proposeCheck.allowed}
                >
                  <SendIcon className="size-4" />
                  Send rates · holds {holdLabel}
                </Button>
              </div>
            </div>
          ) : null}

          <Separator />

          <div className="flex flex-wrap gap-1.5">
            {quickReplies.map((reply) => {
              // Shown in the reader's language, falling back to English so a
              // phrase nobody has translated yet is still offered.
              const label = reply.text[viewerLocale] ?? reply.text.en;
              const tag =
                reply.text[viewerLocale] && viewerLocale in LOCALE_META
                  ? LOCALE_META[viewerLocale as Locale].tag
                  : "en-IN";

              return (
                <Button
                  key={reply.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => setText(label)}
                >
                  <MessageSquareIcon className="size-3.5" />
                  <span lang={tag}>{label}</span>
                </Button>
              );
            })}
          </div>

          <div className="flex items-end gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a message"
              aria-label="Message"
              rows={2}
              className="flex-1 resize-none"
            />
            <Button
              variant="outline"
              disabled={pending || !text.trim()}
              onClick={() => send("note")}
            >
              <SendIcon className="size-4" />
              Send
            </Button>
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!text.trim()) {
                toast.error("Say why you are ending it", {
                  description:
                    "The farmer is owed a reason — otherwise they are left guessing whether to hold the stock.",
                });
                return;
              }
              void send("withdraw");
            }}
            className="text-muted-foreground hover:text-destructive self-start text-xs underline underline-offset-2"
          >
            End this bargain
          </button>
        </footer>
      )}
    </div>
  );
}
