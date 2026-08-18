"use client";

import {
  BellIcon,
  BellRingIcon,
  HandshakeIcon,
  LeafIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  RouteIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SproutIcon,
  StoreIcon,
  TrashIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { DeleteDialog } from "@/components/admin/location-dialogs";
import {
  BargainPhraseDialog,
  DocumentRuleDialog,
  PackDialog,
  PhraseDialog,
  PolicyDialog,
} from "@/components/admin/reference-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DOCUMENT_LABELS, type DocumentKind } from "@/lib/domain/admin";
import {
  TOPICS,
  TOPIC_LABELS,
  type Speaker,
  type VocabularyEntry,
} from "@/lib/domain/bargain-vocabulary";
import type { State } from "@/lib/domain/location";
import { formatMoney, money } from "@/lib/domain/money";
import { POLICY_FIELDS, type PlatformPolicy, type PolicyField } from "@/lib/domain/policy";
import type { DocumentRule, Pack, Phrase } from "@/lib/mock/reference";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

function ActivePill({ active, on, off }: { active: boolean; on: string; off: string }) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? "border-success/40 bg-success-soft text-success"
          : "border-border bg-secondary text-muted-foreground"
      }
    >
      {active ? on : off}
    </Badge>
  );
}

function PanelHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Policy
   ------------------------------------------------------------------------- */

/**
 * A face per policy group.
 *
 * Six bordered boxes of identical grey text is a wall an operator has to read
 * top to bottom to find the one they came for. The icon and the tint are what
 * make "the subscription reminders" findable at a glance; they carry no meaning
 * beyond telling the groups apart, which is why they are flat chart tokens and
 * not the success/warning tones this console reserves for urgency.
 */
const POLICY_LOOK: Record<PolicyField["group"], { icon: LucideIcon; disc: string }> = {
  Bargaining: { icon: HandshakeIcon, disc: "bg-chart-2/12 text-chart-2" },
  Freshness: { icon: LeafIcon, disc: "bg-chart-1/12 text-chart-1" },
  Compliance: { icon: ShieldCheckIcon, disc: "bg-chart-4/12 text-chart-4" },
  Supply: { icon: PackageIcon, disc: "bg-chart-5/12 text-chart-5" },
  Subscriptions: { icon: BellRingIcon, disc: "bg-chart-3/12 text-chart-3" },
  Distance: { icon: RouteIcon, disc: "bg-chart-2/12 text-chart-2" },
};

/**
 * The number apart from its unit, so the number can be the thing you see.
 *
 * The unit is also made to agree with it. A suffix is stored in the plural
 * because that is how it reads beside an input in the edit dialog, but a panel
 * showing "1 days before" looks like a page nobody finished.
 */
function showPolicy(field: PolicyField, raw: number): { value: string; unit: string } {
  if (field.money) return { value: formatMoney(money(raw)), unit: "" };
  // A percentage hugs its number; "130 %" is not how anybody writes it.
  if (field.suffix === "%") return { value: `${raw}%`, unit: "" };
  return {
    value: String(raw),
    unit: raw === 1 ? field.suffix.replace(/^(\w+)s(?=\s|$)/, "$1") : field.suffix,
  };
}

/**
 * The numbers, shown as they are read.
 *
 * Displayed as a grid rather than hidden behind the edit dialog because the
 * common case is checking what a value currently is — "why is this document
 * warning already?" — not changing it.
 */
export function PolicyPanel({
  policy,
  editable,
}: {
  policy: PlatformPolicy;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const groups = [...new Set(POLICY_FIELDS.map((f) => f.group))];

  return (
    <section className="flex flex-col gap-4">
      <PanelHeading
        title="Platform policy"
        description="The numbers every rule reads: how long a price holds, when a document starts warning, what counts as a thin district. The rules themselves stay in code — these are what they compare against."
        action={
          <Button disabled={!editable} onClick={() => setOpen(true)}>
            <SettingsIcon className="size-4" />
            Edit policy
          </Button>
        }
      />

      {/*
        `items-start`, so a card holding one number is the height of one number.
        These groups are three and four rows apart in length — stretched to a
        common height, the short ones were mostly empty ruled box, which reads
        as a setting that failed to load rather than a group with one setting.
      */}
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => {
          const look = POLICY_LOOK[group];

          return (
            <div key={group} className="bg-card flex flex-col rounded-lg border">
              <div className="flex items-center gap-2.5 border-b px-4 py-3">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${look.disc}`}
                >
                  <look.icon className="size-4" />
                </span>
                <h3 className="font-medium">{group}</h3>
              </div>

              <dl className="divide-y">
                {POLICY_FIELDS.filter((f) => f.group === group).map((field) => {
                  const shown = showPolicy(field, policy[field.key]);

                  return (
                    /* The help text on hover: these labels are terse by
                       necessity, and the sentence explaining what a number
                       actually governs is already written for the edit dialog. */
                    <div key={field.key} className="flex flex-col gap-1 px-4 py-3" title={field.help}>
                      <dt className="text-muted-foreground text-xs">{field.label}</dt>
                      <dd className="tabular text-2xl leading-none font-semibold">
                        {shown.value}
                        {shown.unit ? (
                          <span className="text-muted-foreground ml-1.5 text-sm font-normal">
                            {shown.unit}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
      </div>

      {open ? (
        <PolicyDialog policy={policy} open onOpenChange={() => setOpen(false)} />
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------
   Packs
   ------------------------------------------------------------------------- */

export function PacksPanel({
  packs,
  editable,
}: {
  packs: readonly Pack[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState<Pack | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Pack | null>(null);

  return (
    <section className="flex flex-col gap-4">
      <PanelHeading
        title="Packs"
        description="How produce is packed for sale. Stock is priced per pack, so a wrong size here misprices every line that uses it — which is why the label is generated from the size rather than typed alongside it."
        action={
          <Button disabled={!editable} onClick={() => setAdding(true)}>
            <PlusIcon className="size-4" />
            Add pack
          </Button>
        }
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40">Pack</TableHead>
              <TableHead>Container</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="min-w-24">Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {packs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <span className="text-muted-foreground text-sm">
                    No packs yet. Stock cannot be listed without one.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              packs.map((pack) => (
                <TableRow key={pack.id} className={pack.active ? undefined : "opacity-60"}>
                  <TableCell className="font-medium">{pack.label}</TableCell>
                  <TableCell>{pack.container}</TableCell>
                  <TableCell className="tabular text-right">{pack.packSize}</TableCell>
                  <TableCell>{pack.unit}</TableCell>
                  <TableCell>
                    <ActivePill active={pack.active} on="In use" off="Retired" />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <span className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!editable}
                        aria-label={`Edit ${pack.label}`}
                        onClick={() => setEditing(pack)}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!editable}
                        aria-label={`Delete ${pack.label}`}
                        onClick={() => setDeleting(pack)}
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {adding ? <PackDialog open onOpenChange={() => setAdding(false)} /> : null}
      {editing ? (
        <PackDialog
          key={editing.id}
          pack={editing}
          open
          onOpenChange={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog
          collection="packs"
          id={deleting.id}
          name={deleting.label}
          open
          onOpenChange={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------
   Phrases
   ------------------------------------------------------------------------- */

/**
 * Everything the platform says to a farmer.
 *
 * Translation coverage is a column rather than a detail, because an SMS a
 * farmer cannot read is the failure mode — and it is invisible from the
 * English side, which is the only side an operator normally sees.
 */
export function PhrasesPanel({
  phrases,
  editable,
}: {
  phrases: readonly Phrase[];
  editable: boolean;
}) {
  const [kind, setKind] = useState<"notification" | "quickReply">("notification");
  const [editing, setEditing] = useState<Phrase | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Phrase | null>(null);

  const shown = phrases.filter((p) => p.kind === kind);

  return (
    <section className="flex flex-col gap-4">
      <PanelHeading
        title="Phrases"
        description="What the platform says to a farmer, in all six languages. A message that falls back to English is a message the person it was sent to may not be able to read, so coverage is shown rather than assumed."
        action={
          <Button disabled={!editable} onClick={() => setAdding(true)}>
            <PlusIcon className="size-4" />
            Add {kind === "notification" ? "notification" : "quick reply"}
          </Button>
        }
      />

      <div className="flex gap-1">
        {(
          [
            { id: "notification" as const, label: "Notifications", icon: BellIcon },
            { id: "quickReply" as const, label: "Quick replies", icon: MessageSquareIcon },
          ]
        ).map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={kind === id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setKind(id)}
          >
            <Icon className="size-3.5" />
            {label}
            <Badge variant="outline" className="tabular ml-1">
              {phrases.filter((p) => p.kind === id).length}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {kind === "notification" ? (
                <TableHead className="min-w-40">Sent when</TableHead>
              ) : null}
              <TableHead className="min-w-72">English</TableHead>
              <TableHead className="min-w-32">Coverage</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="min-w-24">Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <span className="text-muted-foreground text-sm">
                    Nothing here yet.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              shown.map((phrase) => {
                const named = LOCALES.filter((l) => phrase.text[l]);
                const missing = LOCALES.filter((l) => !phrase.text[l]);
                const complete = missing.length === 0;

                return (
                  <TableRow
                    key={phrase.id}
                    className={phrase.active ? undefined : "opacity-60"}
                  >
                    {kind === "notification" ? (
                      <TableCell>
                        <span className="flex flex-col leading-tight">
                          <span className="font-medium">{phrase.event}</span>
                          <span className="text-faint text-xs uppercase">
                            {phrase.channel}
                          </span>
                        </span>
                      </TableCell>
                    ) : null}

                    <TableCell>
                      <span className="text-sm">{phrase.text.en}</span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "tabular",
                          complete
                            ? "border-success/40 bg-success-soft text-success"
                            : "border-warning/40 bg-warning-soft text-warning",
                        )}
                      >
                        {named.length}/{LOCALES.length}
                      </Badge>
                      {missing.length > 0 ? (
                        <span className="text-faint mt-1 block text-xs">
                          no {missing.map((l) => LOCALE_META[l].englishName).join(", ")}
                        </span>
                      ) : null}
                    </TableCell>

                    <TableCell className="capitalize">{phrase.audience}</TableCell>

                    <TableCell>
                      <ActivePill
                        active={phrase.active}
                        on={kind === "notification" ? "Sending" : "Offered"}
                        off="Off"
                      />
                    </TableCell>

                    <TableCell className="pr-4 text-right">
                      <span className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!editable}
                          aria-label={`Edit ${phrase.text.en}`}
                          onClick={() => setEditing(phrase)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!editable}
                          aria-label={`Delete ${phrase.text.en}`}
                          onClick={() => setDeleting(phrase)}
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {adding ? (
        <PhraseDialog kind={kind} open onOpenChange={() => setAdding(false)} />
      ) : null}
      {editing ? (
        <PhraseDialog
          key={editing.id}
          phrase={editing}
          kind={editing.kind}
          open
          onOpenChange={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog
          collection="phrases"
          id={deleting.id}
          name={deleting.text.en}
          open
          onOpenChange={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------
   Bargain vocabulary
   ------------------------------------------------------------------------- */

const SPEAKER_LABELS: Record<Speaker, string> = {
  farmer: "Farmer",
  buyer: "Buyer",
  both: "Either side",
};

/**
 * Everything a farmer or a buyer can say while bargaining.
 *
 * Not the same thing as Phrases above, and worth keeping apart. A notification
 * is something the platform says; this is what the *people* say, and there is
 * nothing else — a bargain has no text box, so this table is the complete
 * vocabulary of every negotiation on the platform.
 *
 * That makes adding a row a bigger decision than it looks, and removing one
 * bigger still: a phrase somebody needs and cannot find is a deal that moves to
 * a phone call, where no price is recorded and neither side has anything to
 * point at afterwards.
 */
export function BargainVocabularyPanel({
  vocabulary,
  live,
  editable,
}: {
  vocabulary: readonly VocabularyEntry[];
  /** False when these are the shipped defaults rather than stored records. */
  live: boolean;
  editable: boolean;
}) {
  const [speaker, setSpeaker] = useState<Speaker | "all">("all");
  const [editing, setEditing] = useState<VocabularyEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<VocabularyEntry | null>(null);

  const shown = vocabulary
    .filter((p) => speaker === "all" || p.speaker === speaker || p.speaker === "both")
    .sort(
      (a, b) =>
        TOPICS.indexOf(a.topic) - TOPICS.indexOf(b.topic) ||
        a.text.en.localeCompare(b.text.en, "en-IN"),
    );

  return (
    <section className="flex flex-col gap-4">
      <PanelHeading
        title="Bargain vocabulary"
        description="Every sentence a farmer or a buyer can send while bargaining. There is no text box on that screen — this list is all of it, which is what keeps phone numbers out of a negotiation and gives both sides the same message in their own language."
        action={
          <Button disabled={!editable} onClick={() => setAdding(true)}>
            <PlusIcon className="size-4" />
            Add phrase
          </Button>
        }
      />

      {!live ? (
        <p className="border-warning/40 bg-warning-soft text-warning rounded-lg border px-3 py-2 text-xs">
          These are the phrases the platform ships with, not stored records —
          the collection is empty or unreachable. Adding one here writes the
          first stored phrase, and from then on the stored list is the one both
          consoles use.
        </p>
      ) : null}

      <div className="flex gap-1">
        {(
          [
            { id: "all" as const, label: "All", icon: MessagesSquareIcon },
            { id: "farmer" as const, label: "Farmer says", icon: SproutIcon },
            { id: "buyer" as const, label: "Buyer says", icon: StoreIcon },
          ]
        ).map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={speaker === id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSpeaker(id)}
          >
            <Icon className="size-3.5" />
            {label}
            <Badge variant="outline" className="tabular ml-1">
              {
                vocabulary.filter(
                  (p) => id === "all" || p.speaker === id || p.speaker === "both",
                ).length
              }
            </Badge>
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-72">English</TableHead>
              <TableHead className="min-w-32">Topic</TableHead>
              <TableHead className="min-w-28">Who says it</TableHead>
              <TableHead className="min-w-32">Coverage</TableHead>
              <TableHead className="min-w-24">Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <span className="text-muted-foreground text-sm">
                    Nothing here yet.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              shown.map((phrase) => {
                const named = LOCALES.filter((l) => phrase.text[l]);
                const missing = LOCALES.filter((l) => !phrase.text[l]);
                const complete = missing.length === 0;

                return (
                  <TableRow
                    key={phrase.id}
                    className={phrase.active ? undefined : "opacity-60"}
                  >
                    <TableCell>
                      <span className="flex flex-col leading-tight">
                        <span className="text-sm">{phrase.text.en}</span>
                        {/* The Tamil, because that is who reads it today and a
                            wrong translation is invisible in an English-only
                            table. */}
                        {phrase.text.ta ? (
                          <span lang="ta-IN" className="text-faint text-xs">
                            {phrase.text.ta}
                          </span>
                        ) : null}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary">{TOPIC_LABELS[phrase.topic]}</Badge>
                    </TableCell>

                    <TableCell className="text-sm">
                      {SPEAKER_LABELS[phrase.speaker]}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "tabular",
                          complete
                            ? "border-success/40 bg-success-soft text-success"
                            : "border-warning/40 bg-warning-soft text-warning",
                        )}
                      >
                        {named.length}/{LOCALES.length}
                      </Badge>
                      {missing.length > 0 ? (
                        <span className="text-faint mt-1 block text-xs">
                          no {missing.map((l) => LOCALE_META[l].englishName).join(", ")}
                        </span>
                      ) : null}
                    </TableCell>

                    <TableCell>
                      <ActivePill active={phrase.active} on="Offered" off="Off" />
                    </TableCell>

                    <TableCell className="pr-4 text-right">
                      <span className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!editable}
                          aria-label={`Edit ${phrase.text.en}`}
                          onClick={() => setEditing(phrase)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          // A shipped phrase has no stored record to delete, so
                          // the button would 404. Switching it off is the way
                          // to retire one, and it is available either way.
                          disabled={!editable || !live}
                          aria-label={`Delete ${phrase.text.en}`}
                          onClick={() => setDeleting(phrase)}
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {adding ? (
        <BargainPhraseDialog open onOpenChange={() => setAdding(false)} />
      ) : null}
      {editing ? (
        <BargainPhraseDialog
          key={editing.id}
          phrase={editing}
          open
          onOpenChange={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog
          collection="bargainPhrases"
          id={deleting.id}
          name={deleting.text.en}
          open
          onOpenChange={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------
   Document rules
   ------------------------------------------------------------------------- */

export function DocumentRulesPanel({
  rules,
  states,
  editable,
}: {
  rules: readonly DocumentRule[];
  states: readonly State[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState<DocumentRule | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<DocumentRule | null>(null);

  const stateName = (id: string) => states.find((s) => s.id === id)?.name ?? id;

  return (
    <section className="flex flex-col gap-4">
      <PanelHeading
        title="Document rules"
        description="Which documents each kind of account must produce to be verified, per state. FSSAI thresholds, permits and licensing differ the moment you cross a border, so this stops being a constant as soon as the platform leaves Tamil Nadu."
        action={
          <Button disabled={!editable} onClick={() => setAdding(true)}>
            <PlusIcon className="size-4" />
            Add rule
          </Button>
        }
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-32">State</TableHead>
              <TableHead className="min-w-24">Applies to</TableHead>
              <TableHead className="min-w-72">Required</TableHead>
              <TableHead className="min-w-24">Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <span className="text-muted-foreground text-sm">
                    No rules yet — nothing is required at registration.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id} className={rule.active ? undefined : "opacity-60"}>
                  <TableCell className="font-medium">
                    {stateName(rule.stateId)}
                  </TableCell>
                  <TableCell className="capitalize">{rule.subject}</TableCell>
                  <TableCell>
                    {rule.required.length === 0 ? (
                      <span className="text-warning text-xs">
                        Nothing required — anyone can be verified
                      </span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {rule.required.map((kind) => (
                          <Badge key={kind} variant="secondary">
                            {DOCUMENT_LABELS[kind as DocumentKind] ?? kind}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ActivePill active={rule.active} on="Enforced" off="Not enforced" />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <span className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!editable}
                        aria-label={`Edit ${stateName(rule.stateId)} ${rule.subject} rule`}
                        onClick={() => setEditing(rule)}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!editable}
                        aria-label={`Delete ${stateName(rule.stateId)} ${rule.subject} rule`}
                        onClick={() => setDeleting(rule)}
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {adding ? (
        <DocumentRuleDialog states={states} open onOpenChange={() => setAdding(false)} />
      ) : null}
      {editing ? (
        <DocumentRuleDialog
          key={editing.id}
          rule={editing}
          states={states}
          open
          onOpenChange={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog
          collection="documentRules"
          id={deleting.id}
          name={`${stateName(deleting.stateId)} ${deleting.subject} rule`}
          open
          onOpenChange={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}
