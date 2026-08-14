"use client";

import {
  BellIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";

import { DeleteDialog } from "@/components/admin/location-dialogs";
import {
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
import type { State } from "@/lib/domain/location";
import { formatMoney, money } from "@/lib/domain/money";
import { POLICY_FIELDS, type PlatformPolicy } from "@/lib/domain/policy";
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <div key={group} className="bg-card flex flex-col gap-3 rounded-lg border p-4">
            <h3 className="font-medium">{group}</h3>
            <dl className="flex flex-col gap-2.5">
              {POLICY_FIELDS.filter((f) => f.group === group).map((field) => (
                <div key={field.key} className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-sm">{field.label}</dt>
                  <dd className="tabular font-medium">
                    {field.money
                      ? formatMoney(money(policy[field.key]))
                      : `${policy[field.key]} ${field.suffix}`}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
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
