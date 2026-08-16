"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useControls } from "@/components/admin/use-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_LABELS, type DocumentKind } from "@/lib/domain/admin";
import {
  hasDigits,
  TOPICS,
  TOPIC_LABELS,
  type Speaker,
  type Topic,
  type VocabularyEntry,
} from "@/lib/domain/bargain-vocabulary";
import { QUANTITY_UNITS, type QuantityUnit } from "@/lib/domain/enums";
import type { State } from "@/lib/domain/location";
import { POLICY_FIELDS, type PlatformPolicy } from "@/lib/domain/policy";
import type { DocumentRule, Pack, Phrase } from "@/lib/mock/reference";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Editors for the reference data that has no home of its own.
 *
 * Everything here follows the pattern the crop and location dialogs set: state
 * seeded once from props, remounted by `key` when the record changes, and no
 * effect syncing the two.
 */

function Field({
  label,
  htmlFor,
  hint,
  required,
  wide,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"}>
      <Label htmlFor={htmlFor} className="text-sm">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : (
          <span className="text-faint text-xs font-normal">optional</span>
        )}
      </Label>
      {children}
      {hint ? <p className="text-faint text-xs">{hint}</p> : null}
    </div>
  );
}

function ActiveSwitch({
  id,
  active,
  onChange,
  label,
}: {
  id: string;
  active: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <div className="border-border flex items-center justify-between gap-4 rounded-md border px-3 py-2.5 sm:col-span-2">
      <div className="flex flex-col">
        <Label htmlFor={id} className="text-sm">
          Active
        </Label>
        <span className="text-faint text-xs">{label}</span>
      </div>
      <Switch id={id} checked={active} onCheckedChange={onChange} />
    </div>
  );
}

/* -------------------------------------------------------------------------
   Pack
   ------------------------------------------------------------------------- */

export function PackDialog({
  pack,
  open,
  onOpenChange,
}: {
  pack?: Pack;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { create, update, pending } = useControls();
  const [unit, setUnit] = useState<QuantityUnit>(
    (pack?.unit as QuantityUnit) ?? "kg",
  );
  const [container, setContainer] = useState(pack?.container ?? "");
  const [packSize, setPackSize] = useState(String(pack?.packSize ?? ""));
  const [active, setActive] = useState(pack?.active ?? true);

  // Shown, not typed. The server derives the same string, so a label can never
  // disagree with the size the money is calculated against.
  const preview =
    packSize && container
      ? `${packSize} ${unit} ${container.toLowerCase()}`
      : "—";

  async function save() {
    const body = { unit, container, packSize: Number(packSize), active };
    const ok = pack
      ? await update("packs", pack.id, body)
      : await create("packs", body);
    if (ok) {
      toast.success(pack ? `${preview} updated` : `${preview} added`);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pack ? `Edit ${pack.label}` : "Add a pack"}</DialogTitle>
          <DialogDescription>
            How produce is packed for sale. Stock is priced per pack, so the
            size here is what the buyer&rsquo;s money is calculated against.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Container" htmlFor="pack-container" required>
              <Input
                id="pack-container"
                value={container}
                onChange={(e) => setContainer(e.target.value)}
                placeholder="Crate"
              />
            </Field>

            <Field label="Unit" htmlFor="pack-unit" required>
              <Select value={unit} onValueChange={(v) => setUnit(v as QuantityUnit)}>
                <SelectTrigger id="pack-unit">
                  <SelectValue>{QUANTITY_UNITS[unit].en}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(QUANTITY_UNITS).map(([key, labels]) => (
                    <SelectItem key={key} value={key}>
                      {labels.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Pack size"
              htmlFor="pack-size"
              required
              hint="How many units one pack holds"
            >
              <Input
                id="pack-size"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                inputMode="decimal"
                placeholder="25"
                className="tabular"
              />
            </Field>

            <Field label="Label" htmlFor="pack-label" hint="Generated, not typed">
              <Input id="pack-label" value={preview} readOnly disabled />
            </Field>

            <ActiveSwitch
              id="pack-active"
              active={active}
              onChange={setActive}
              label="Inactive packs disappear from new stock lines"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : pack ? "Save changes" : "Add pack"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
   Phrase
   ------------------------------------------------------------------------- */

const EVENTS = [
  { id: "quoteReceived", label: "Buyer quoted a price" },
  { id: "priceAgreed", label: "Price agreed" },
  { id: "vehicleDispatched", label: "Vehicle dispatched" },
  { id: "handoverCode", label: "Handover code issued" },
  { id: "paymentSettled", label: "Payment settled" },
  { id: "listingExpired", label: "Listing expired" },
  { id: "bargainClosed", label: "Bargain closed unanswered" },
];

const CHANNELS = [
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "inApp", label: "In-app" },
];

export function PhraseDialog({
  phrase,
  kind,
  open,
  onOpenChange,
}: {
  phrase?: Phrase;
  kind: "notification" | "quickReply";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { create, update, pending } = useControls();
  const [text, setText] = useState<Record<string, string>>(() => ({
    ...(phrase?.text ?? { en: "" }),
  }));
  const [event, setEvent] = useState(phrase?.event ?? EVENTS[0].id);
  const [channel, setChannel] = useState(phrase?.channel ?? "sms");
  const [audience, setAudience] = useState(phrase?.audience ?? "farmer");
  const [active, setActive] = useState(phrase?.active ?? true);

  const effectiveKind = phrase?.kind ?? kind;
  const isNotification = effectiveKind === "notification";

  async function save() {
    if (!text.en?.trim()) {
      toast.error("English is required");
      return;
    }
    const body = {
      kind: effectiveKind,
      event: isNotification ? event : "",
      channel: isNotification ? channel : "",
      audience,
      text,
      active,
    };
    const ok = phrase
      ? await update("phrases", phrase.id, body)
      : await create("phrases", body);
    if (ok) {
      toast.success(phrase ? "Phrase updated" : "Phrase added");
      onOpenChange(false);
    }
  }

  const missing = LOCALES.filter((l) => !text[l]?.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {phrase
              ? "Edit phrase"
              : isNotification
                ? "Add a notification"
                : "Add a quick reply"}
          </DialogTitle>
          <DialogDescription>
            {isNotification
              ? "Sent to the farmer in their own language. Use {braces} for values the platform fills in — they must appear in every translation."
              : "Offered as a tap in the bargaining screen, so a farmer on a feature phone does not have to type."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {isNotification ? (
              <>
                <Field label="Sent when" htmlFor="phrase-event" required>
                  <Select value={event} onValueChange={setEvent}>
                    <SelectTrigger id="phrase-event">
                      <SelectValue>
                        {EVENTS.find((e) => e.id === event)?.label ?? event}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {EVENTS.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Channel" htmlFor="phrase-channel" required>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger id="phrase-channel">
                      <SelectValue>
                        {CHANNELS.find((c) => c.id === channel)?.label ?? channel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            ) : null}

            <Field label="Spoken to" htmlFor="phrase-audience" required>
              <Select
                value={audience}
                onValueChange={(v) => setAudience(v as Phrase["audience"])}
              >
                <SelectTrigger id="phrase-audience">
                  <SelectValue className="capitalize">{audience}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="farmer">Farmer</SelectItem>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex flex-col gap-3">
            {LOCALES.map((locale) => (
              <div key={locale} className="flex flex-col gap-1.5">
                <Label htmlFor={`phrase-${locale}`} className="text-sm">
                  <span lang={LOCALE_META[locale].tag}>
                    {LOCALE_META[locale].nativeName}
                  </span>
                  <span className="text-faint text-xs font-normal">
                    {LOCALE_META[locale].englishName}
                  </span>
                  {locale === "en" ? (
                    <span className="text-destructive" aria-hidden>
                      *
                    </span>
                  ) : null}
                </Label>
                <Textarea
                  id={`phrase-${locale}`}
                  lang={LOCALE_META[locale].tag}
                  rows={2}
                  value={text[locale] ?? ""}
                  onChange={(e) =>
                    setText((t) => ({ ...t, [locale]: e.target.value }))
                  }
                  className="resize-none"
                />
              </div>
            ))}

            {missing.length > 0 ? (
              <p className="text-warning text-xs">
                Missing {missing.map((l) => LOCALE_META[l].englishName).join(", ")}.
                Those readers get the English text — which for an SMS to a farmer
                means a message they cannot read.
              </p>
            ) : null}
          </div>

          <ActiveSwitch
            id="phrase-active"
            active={active}
            onChange={setActive}
            label={
              isNotification
                ? "Inactive notifications are not sent"
                : "Inactive replies are not offered"
            }
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : phrase ? "Save changes" : "Add phrase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
   Bargain phrase
   ------------------------------------------------------------------------- */

const SPEAKERS: Array<{ id: Speaker; label: string; hint: string }> = [
  { id: "farmer", label: "Farmer only", hint: "Only the farmer can send it." },
  { id: "buyer", label: "Buyer only", hint: "Only the buyer can send it." },
  { id: "both", label: "Either side", hint: "Both can send it." },
];

/**
 * A sentence either side of a bargain can send.
 *
 * The only way words reach a bargaining screen, which makes this form heavier
 * than it looks. Two things it does that the notification editor does not:
 *
 *  - **Refuses digits before you save.** A number in a phrase is a phone
 *    number in a bargain — the exact thing the fixed vocabulary exists to
 *    prevent — and the platform would be translating it six ways and putting
 *    its own name behind it. Caught here so the mistake is visible while the
 *    text is on screen, and again on the server so it cannot be posted round.
 *
 *  - **Names who may say it.** A farmer does not say "we will collect
 *    tomorrow", so the phrase appears only on the side that can mean it.
 */
export function BargainPhraseDialog({
  phrase,
  open,
  onOpenChange,
}: {
  phrase?: VocabularyEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { create, update, pending } = useControls();
  const [text, setText] = useState<Record<string, string>>(() => ({
    ...(phrase?.text ?? { en: "" }),
  }));
  const [speaker, setSpeaker] = useState<Speaker>(phrase?.speaker ?? "both");
  const [topic, setTopic] = useState<Topic>(phrase?.topic ?? "price");
  const [active, setActive] = useState(phrase?.active ?? true);

  const missing = LOCALES.filter((l) => !text[l]?.trim());
  const numeric = LOCALES.filter((l) => text[l] && hasDigits(text[l]));

  async function save() {
    if (!text.en?.trim()) {
      toast.error("English is required");
      return;
    }
    if (numeric.length > 0) {
      toast.error("Phrases carry no numbers", {
        description:
          "A number in a bargain phrase is how a phone number reaches the other side. Say it in words, or leave it to the rate and quantity fields.",
      });
      return;
    }

    const body = { text, speaker, topic, active };
    const ok = phrase
      ? await update("bargainPhrases", phrase.id, body)
      : await create("bargainPhrases", body);
    if (ok) {
      toast.success(phrase ? "Phrase updated" : "Phrase added", {
        description: "Farmers and buyers see it on their next bargain screen.",
      });
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {phrase ? "Edit bargain phrase" : "Add a bargain phrase"}
          </DialogTitle>
          <DialogDescription>
            Bargains have no text box — this list is everything a farmer or a
            buyer can say. Write it in all six languages: each side reads it in
            their own, so a missing translation lands as English in front of
            someone who may not read English.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Who may say it" htmlFor="bargain-speaker" required>
              <Select value={speaker} onValueChange={(v) => setSpeaker(v as Speaker)}>
                <SelectTrigger id="bargain-speaker">
                  <SelectValue>
                    {SPEAKERS.find((s) => s.id === speaker)?.label ?? speaker}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SPEAKERS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Topic"
              htmlFor="bargain-topic"
              required
              hint="Groups the buttons on the bargaining screen. Carries no rule."
            >
              <Select value={topic} onValueChange={(v) => setTopic(v as Topic)}>
                <SelectTrigger id="bargain-topic">
                  <SelectValue>{TOPIC_LABELS[topic]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TOPICS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TOPIC_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex flex-col gap-3">
            {LOCALES.map((locale) => (
              <div key={locale} className="flex flex-col gap-1.5">
                <Label htmlFor={`bargain-${locale}`} className="text-sm">
                  <span lang={LOCALE_META[locale].tag}>
                    {LOCALE_META[locale].nativeName}
                  </span>
                  <span className="text-faint text-xs font-normal">
                    {LOCALE_META[locale].englishName}
                  </span>
                  {locale === "en" ? (
                    <span className="text-destructive" aria-hidden>
                      *
                    </span>
                  ) : null}
                </Label>
                <Textarea
                  id={`bargain-${locale}`}
                  lang={LOCALE_META[locale].tag}
                  rows={2}
                  value={text[locale] ?? ""}
                  onChange={(e) =>
                    setText((t) => ({ ...t, [locale]: e.target.value }))
                  }
                  className={cn(
                    "resize-none",
                    text[locale] && hasDigits(text[locale])
                      ? "border-destructive focus-visible:ring-destructive"
                      : undefined,
                  )}
                />
              </div>
            ))}

            {numeric.length > 0 ? (
              <p className="text-destructive text-xs">
                {numeric.map((l) => LOCALE_META[l].englishName).join(", ")} contain
                a number. Bargain phrases carry no digits — a number here is how a
                phone number reaches the other side, and the platform would be
                translating it into six languages.
              </p>
            ) : missing.length > 0 ? (
              <p className="text-warning text-xs">
                Missing {missing.map((l) => LOCALE_META[l].englishName).join(", ")}.
                Those readers get the English text, which in a bargain is a
                sentence they may not be able to read.
              </p>
            ) : null}
          </div>

          <ActiveSwitch
            id="bargain-active"
            active={active}
            onChange={setActive}
            label="Inactive phrases are not offered, and the server refuses them"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || numeric.length > 0}>
            {pending ? "Saving…" : phrase ? "Save changes" : "Add phrase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
   Document rule
   ------------------------------------------------------------------------- */

const SUBJECTS: Array<{ id: DocumentRule["subject"]; label: string }> = [
  { id: "farmer", label: "Farmer" },
  { id: "buyer", label: "Buyer" },
  { id: "driver", label: "Driver" },
  { id: "vehicle", label: "Vehicle" },
];

export function DocumentRuleDialog({
  rule,
  states,
  open,
  onOpenChange,
}: {
  rule?: DocumentRule;
  states: readonly State[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { create, update, pending } = useControls();
  const [stateId, setStateId] = useState(rule?.stateId ?? states[0]?.id ?? "");
  const [subject, setSubject] = useState<DocumentRule["subject"]>(
    rule?.subject ?? "farmer",
  );
  const [required, setRequired] = useState<DocumentKind[]>([
    ...(rule?.required ?? []),
  ]);
  const [active, setActive] = useState(rule?.active ?? true);

  function toggle(kind: DocumentKind) {
    setRequired((current) =>
      current.includes(kind)
        ? current.filter((k) => k !== kind)
        : [...current, kind],
    );
  }

  async function save() {
    const body = { stateId, subject, required, active };
    const ok = rule
      ? await update("documentRules", rule.id, body)
      : await create("documentRules", body);
    if (ok) {
      toast.success(rule ? "Rule updated" : "Rule added");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {rule ? "Edit document rule" : "Add a document rule"}
          </DialogTitle>
          <DialogDescription>
            Which documents this kind of account must produce to be verified in
            this state. Compliance differs across borders, so the rule is held
            per state rather than as one national list.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="State" htmlFor="rule-state" required>
              <Select value={stateId} onValueChange={setStateId} disabled={Boolean(rule)}>
                <SelectTrigger id="rule-state">
                  <SelectValue>
                    {states.find((s) => s.id === stateId)?.name ?? stateId}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {states.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Applies to" htmlFor="rule-subject" required>
              <Select
                value={subject}
                onValueChange={(v) => setSubject(v as DocumentRule["subject"])}
                disabled={Boolean(rule)}
              >
                <SelectTrigger id="rule-subject">
                  <SelectValue>
                    {SUBJECTS.find((s) => s.id === subject)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Required documents</span>
            <ul className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(DOCUMENT_LABELS) as DocumentKind[]).map((kind) => (
                <li key={kind} className="flex items-center gap-2">
                  <Checkbox
                    id={`doc-${kind}`}
                    checked={required.includes(kind)}
                    onCheckedChange={() => toggle(kind)}
                  />
                  <Label htmlFor={`doc-${kind}`} className="text-sm font-normal">
                    {DOCUMENT_LABELS[kind]}
                  </Label>
                </li>
              ))}
            </ul>
            {required.includes("aadhaar") ? (
              <p className="text-warning text-xs">
                Collect masked Aadhaar only — first eight digits blacked out, or
                offline e-KYC. Storing the full number is a liability nothing on
                this platform needs.
              </p>
            ) : null}
          </div>

          <ActiveSwitch
            id="rule-active"
            active={active}
            onChange={setActive}
            label="Inactive rules are not enforced at registration"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : rule ? "Save changes" : "Add rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
   Policy
   ------------------------------------------------------------------------- */

export function PolicyDialog({
  policy,
  open,
  onOpenChange,
}: {
  policy: PlatformPolicy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { update, pending } = useControls();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      POLICY_FIELDS.map((f) => [
        f.key,
        // Money is stored in paise and edited in rupees. Nobody types 1500000
        // when they mean fifteen thousand.
        String(f.money ? policy[f.key] / 100 : policy[f.key]),
      ]),
    ),
  );

  const groups = [...new Set(POLICY_FIELDS.map((f) => f.group))];

  async function save() {
    const body = Object.fromEntries(
      POLICY_FIELDS.map((f) => [
        f.key,
        f.money ? Math.round(Number(draft[f.key]) * 100) : Number(draft[f.key]),
      ]),
    );
    const ok = await update("settings", "policy", body);
    if (ok) {
      toast.success("Policy updated");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Platform policy</DialogTitle>
          <DialogDescription>
            The numbers the rules read. The rules themselves stay in code — this
            is what they compare against.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4">
          {groups.map((group) => (
            <div key={group} className="flex flex-col gap-3">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {group}
              </span>
              <div className="grid gap-4 sm:grid-cols-2">
                {POLICY_FIELDS.filter((f) => f.group === group).map((field) => (
                  <Field
                    key={field.key}
                    label={field.label}
                    htmlFor={`policy-${field.key}`}
                    hint={field.help}
                    required
                    wide
                  >
                    <div className="flex items-center gap-2">
                      {field.money ? <span className="text-faint">₹</span> : null}
                      <Input
                        id={`policy-${field.key}`}
                        value={draft[field.key] ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [field.key]: e.target.value }))
                        }
                        inputMode="decimal"
                        className="tabular max-w-32"
                      />
                      {field.money ? null : (
                        <span className="text-faint text-sm">{field.suffix}</span>
                      )}
                    </div>
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
