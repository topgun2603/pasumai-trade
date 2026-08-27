"use client";

import {
  ImageIcon,
  LayoutPanelTopIcon,
  PanelTopIcon,
  PlusIcon,
  SquareStackIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Placement } from "@/components/ads/ad-slot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ROLES, type Role } from "@/lib/auth/claims";
import {
  AD_SLOTS,
  adState,
  findSlot,
  MAX_WEIGHT,
  MIN_WEIGHT,
  HREF_PROBLEM,
  validateAd,
  type Ad,
  type AdFormat,
  type AdSurface,
} from "@/lib/domain/ad";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Where advertising is placed, and what is currently in each place.
 *
 * ## Organised by slot, not by campaign
 *
 * A list of ads sorted by date answers "what have we sold". It does not answer
 * the question operations actually opens this screen with, which is "what is
 * on the landing page right now" — and that question, asked of a flat list,
 * requires reading every row and remembering which slot each one names.
 *
 * So the page *is* the placement map. Every slot the product renders appears
 * whether or not anything is booked into it, an empty one says so, and a slot
 * holding three competing campaigns shows all three with their shares. What
 * gets sold and what is empty are both visible without a query.
 *
 * ## The preview is the component
 *
 * The form renders `<Placement>` — the same component the landing page uses —
 * against the values in the fields. Not a sketch of it, not an approximation
 * with the same class names: the thing itself, so it cannot look right here
 * and wrong in production.
 */

const FORMAT_ICON: Record<AdFormat, typeof PanelTopIcon> = {
  banner: PanelTopIcon,
  section: LayoutPanelTopIcon,
  card: SquareStackIcon,
};

const SURFACES: ReadonlyArray<{ id: AdSurface; label: string; hint: string }> = [
  { id: "landing", label: "Public site", hint: "Seen by anyone, signed in or not." },
  { id: "farm", label: "Farm console", hint: "Seen by farmers." },
  { id: "buying", label: "Buyer console", hint: "Seen by buyers and franchises." },
  { id: "agency", label: "Agency console", hint: "Seen by transport and manpower." },
];

const STATE_STYLE: Record<string, string> = {
  live: "border-success/40 bg-success-soft text-success",
  paused: "border-border text-muted-foreground",
  scheduled: "border-warning/40 bg-warning-soft text-warning",
  ended: "border-border text-faint",
};

/** The form's own shape — strings, because that is what inputs hold. */
interface Draft {
  id?: string;
  name: string;
  advertiser: string;
  slotId: string;
  headline: string;
  body: string;
  ctaLabel: string;
  href: string;
  imagePath: string;
  imagePreview: string;
  imageAlt: string;
  locales: Locale[];
  roles: Role[];
  startsAt: string;
  endsAt: string;
  weight: number;
}

function blank(slotId: string): Draft {
  return {
    name: "",
    advertiser: "",
    slotId,
    headline: "",
    body: "",
    ctaLabel: "",
    href: "",
    imagePath: "",
    imagePreview: "",
    imageAlt: "",
    locales: [],
    roles: [],
    startsAt: "",
    endsAt: "",
    weight: 1,
  };
}

function draftOf(ad: Ad): Draft {
  return {
    id: ad.id,
    name: ad.name,
    advertiser: ad.advertiser,
    slotId: ad.slotId,
    headline: ad.creative.headline,
    body: ad.creative.body ?? "",
    ctaLabel: ad.creative.ctaLabel ?? "",
    href: ad.creative.href ?? "",
    imagePath: ad.creative.imagePath ?? "",
    imagePreview: ad.signedImage ?? "",
    imageAlt: ad.creative.imageAlt ?? "",
    locales: [...ad.locales],
    roles: [...ad.roles],
    startsAt: forInput(ad.startsAt),
    endsAt: forInput(ad.endsAt),
    weight: ad.weight,
  };
}

/** `datetime-local` wants local wall-clock with no zone, which is not toISOString. */
function forInput(date?: Date): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AdManager({
  ads,
  now,
  editable,
}: {
  ads: readonly Ad[];
  /** From the server, so live/scheduled/ended agree either side of hydration. */
  now: number;
  editable: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Ad | null>(null);
  const [pending, start] = useTransition();

  function toggle(ad: Ad, active: boolean) {
    start(async () => {
      const res = await fetch(`/api/ads/${ad.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "That did not save." }));
        toast.error(error);
        return;
      }
      toast.success(active ? `${ad.name} is live.` : `${ad.name} is paused.`);
      router.refresh();
    });
  }

  function remove(ad: Ad) {
    start(async () => {
      const res = await fetch(`/api/ads/${ad.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("That did not delete.");
        return;
      }
      setRemoving(null);
      toast.success(`${ad.name} removed.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-10">
      {SURFACES.map((surface) => {
        const slots = AD_SLOTS.filter((slot) => slot.surface === surface.id);
        if (slots.length === 0) return null;

        return (
          <section key={surface.id} className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                {surface.label}
              </h2>
              <p className="text-muted-foreground text-sm">{surface.hint}</p>
            </div>

            <div className="flex flex-col gap-4">
              {slots.map((slot) => {
                const booked = ads.filter((ad) => ad.slotId === slot.id);
                const Icon = FORMAT_ICON[slot.format];
                const share = booked
                  .filter((ad) => adState(ad, now) === "live")
                  .reduce((sum, ad) => sum + ad.weight, 0);

                return (
                  <div key={slot.id} className="bg-card rounded-xl border">
                    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                      <span className="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                        <Icon className="size-4" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">{slot.label}</span>
                        <span className="text-muted-foreground text-xs">{slot.hint}</span>
                      </span>
                      <Badge variant="outline" className="shrink-0 capitalize">
                        {slot.format}
                      </Badge>
                      {editable ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDraft(blank(slot.id))}
                        >
                          <PlusIcon className="size-4" />
                          Place
                        </Button>
                      ) : null}
                    </div>

                    {booked.length === 0 ? (
                      <p className="text-muted-foreground px-4 py-5 text-sm">
                        Nothing booked. The page renders nothing here — no gap, no
                        placeholder.
                      </p>
                    ) : (
                      <ul className="divide-border divide-y">
                        {booked.map((ad) => {
                          const state = adState(ad, now);

                          return (
                            <li
                              key={ad.id}
                              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                            >
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="flex flex-wrap items-baseline gap-x-2">
                                  <span className="text-sm font-medium">{ad.name}</span>
                                  <span className="text-muted-foreground text-xs">
                                    {ad.advertiser}
                                  </span>
                                </span>
                                <span className="text-muted-foreground truncate text-xs">
                                  {ad.creative.headline}
                                </span>
                              </span>

                              {/*
                                Share is meaningless on its own — "3" answers
                                nothing. Against the live total in the same
                                slot it is the fraction of readers who will
                                actually see this one.
                              */}
                              {state === "live" && share > 0 ? (
                                <span className="text-muted-foreground tabular shrink-0 text-xs">
                                  {Math.round((ad.weight / share) * 100)}% of views
                                </span>
                              ) : null}

                              <Badge
                                variant="outline"
                                className={cn("shrink-0 capitalize", STATE_STYLE[state])}
                              >
                                {state}
                              </Badge>

                              {editable ? (
                                <span className="flex shrink-0 items-center gap-1">
                                  <Switch
                                    checked={ad.active}
                                    disabled={pending}
                                    onCheckedChange={(next) => toggle(ad, next)}
                                    aria-label={`${ad.active ? "Pause" : "Run"} ${ad.name}`}
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setDraft(draftOf(ad))}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => setRemoving(ad)}
                                    aria-label={`Remove ${ad.name}`}
                                  >
                                    <Trash2Icon className="size-4" />
                                  </Button>
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {draft ? (
        <AdForm
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            router.refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title="Remove this placement?"
        description={
          removing ? (
            <>
              <strong>{removing.name}</strong> for {removing.advertiser} will be deleted, along
              with its image. Anywhere it is currently showing goes back to rendering nothing.
            </>
          ) : null
        }
        confirmLabel="Remove"
        pending={pending}
        onConfirm={() => removing && remove(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
      />
    </div>
  );
}

/**
 * The form, with the real component rendered beside it.
 *
 * Everything is one dialog rather than a wizard. There are eleven fields and a
 * person booking a campaign has them all in front of them on the media plan;
 * splitting that across three steps adds clicks without removing decisions.
 */
function AdForm({
  draft: initial,
  onClose,
  onSaved,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [uploading, setUploading] = useState(false);
  /*
    Whether the reader is still typing the link.

    Every other field is complained about the moment it is empty, and that reads
    as a checklist. The link cannot work that way: it is empty, then briefly
    malformed, then right, and the malformed stretch is most of the typing.
  */
  const [typingLink, setTypingLink] = useState(false);
  const [pending, start] = useTransition();

  const slot = findSlot(draft.slotId);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const problems = validateAd({
    ...draft,
    startsAt: draft.startsAt || undefined,
    endsAt: draft.endsAt || undefined,
  });

  /*
    What the list under the preview actually says.

    The half-typed link is dropped from it, and from it only — `problems.ok`
    is untouched, so Save stays disabled until the address is one we will
    render. Hiding the complaint is not the same as accepting the value, and
    this is deliberately the former.
  */
  const listed = typingLink
    ? problems.errors.filter((error) => error !== HREF_PROBLEM)
    : problems.errors;

  async function upload(file: File) {
    setUploading(true);
    try {
      const ask = await fetch("/api/ads/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type, bytes: file.size }),
      });
      if (!ask.ok) {
        const { error } = await ask.json().catch(() => ({ error: "Upload refused." }));
        toast.error(error);
        return;
      }

      const { url, path } = (await ask.json()) as { url: string; path: string };

      // Straight to the bucket. See app/api/ads/uploads/route.ts for why the
      // bytes do not come through the server.
      const put = await fetch(url, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!put.ok) {
        toast.error("The image did not upload.");
        return;
      }

      // A local preview: the stored object is not public, and its signed read
      // URL only exists after a save. This is the same bytes either way.
      setDraft((d) => ({ ...d, imagePath: path, imagePreview: URL.createObjectURL(file) }));
    } catch {
      /*
        A blocked or dropped request, not a refusal.

        The PUT goes to the bucket rather than to this origin, so a bucket with
        no CORS entry for wherever this is running rejects the preflight and
        `fetch` *rejects* — it does not come back with `ok: false`. Without
        this branch that TypeError left the dialog by way of an unhandled
        rejection: the spinner cleared and nothing was said, which reads as the
        upload silently doing nothing.

        See scripts/set-storage-cors.ts for the allow-list. A dev server on a
        port that is not on it lands here every time.
      */
      toast.error(
        "Could not reach storage. If this is a dev server, check the bucket's CORS origins.",
      );
    } finally {
      setUploading(false);
    }
  }

  function save() {
    start(async () => {
      const payload = {
        ...draft,
        startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
        endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
      };

      const res = await fetch(draft.id ? `/api/ads/${draft.id}` : "/api/ads", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "That did not save." }));
        toast.error(error);
        return;
      }

      toast.success(
        draft.id ? "Placement saved." : "Placement booked — paused until you switch it on.",
      );
      onSaved();
    });
  }

  /* What the preview renders. A draft is not an Ad, so it is shaped into one. */
  const preview: Ad = {
    id: draft.id ?? "preview",
    name: draft.name,
    advertiser: draft.advertiser || "Advertiser",
    slotId: draft.slotId,
    creative: {
      headline: draft.headline || "Your headline here",
      body: draft.body || undefined,
      imagePath: draft.imagePath || undefined,
      imageAlt: draft.imageAlt || undefined,
      ctaLabel: draft.ctaLabel || undefined,
      href: draft.href || undefined,
    },
    locales: draft.locales,
    roles: draft.roles,
    weight: draft.weight,
    active: false,
    createdAt: new Date(0),
    // The local object URL while composing; the signed one when editing
    // something already saved. Either way it is what the browser can load.
    signedImage: draft.imagePreview || undefined,
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* `sm:` and not a bare `max-w-4xl`: the base DialogContent ends with
          `sm:max-w-sm`, and tailwind-merge keeps a responsive variant and an
          unprefixed utility side by side rather than treating one as an
          override — so above 640px the base won and this dialog rendered at
          24rem with its two columns crushed into it. Every other dialog in the
          codebase prefixes it for the same reason. */}
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
        /*
          A stray click on the page behind must not discard this.

          By the time somebody is in here they may have typed a headline, a body
          and an advertiser, and uploaded a creative — and the upload is already
          in the bucket, so closing does not merely lose keystrokes. Escape and
          the X still close it, which is what keeps this from being a trap; only
          the accidental dismissal goes.

          `onInteractOutside` rather than `onPointerDownOutside`: it covers the
          focus-leaving case too, so a tab out of the last field cannot do what
          the click no longer does.
        */
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit placement" : "New placement"}</DialogTitle>
          <DialogDescription>{slot?.label}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Field label="Name" hint="Yours, for this list. The reader never sees it.">
              <Input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Kaveri Seeds — June"
              />
            </Field>

            <Field label="Advertiser" hint="Shown to the reader beside the word Sponsored.">
              <Input
                value={draft.advertiser}
                onChange={(e) => set("advertiser", e.target.value)}
                placeholder="Kaveri Seeds"
              />
            </Field>

            <Field label="Headline">
              <Input
                value={draft.headline}
                onChange={(e) => set("headline", e.target.value)}
                placeholder="Certified seed, delivered to your village"
              />
            </Field>

            <Field label="Body" hint="Optional. One or two sentences.">
              <Textarea
                rows={3}
                value={draft.body}
                onChange={(e) => set("body", e.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Button" hint="Optional.">
                <Input
                  value={draft.ctaLabel}
                  onChange={(e) => set("ctaLabel", e.target.value)}
                  placeholder="See the range"
                />
              </Field>
              <Field label="Link">
                <Input
                  value={draft.href}
                  onChange={(e) => set("href", e.target.value)}
                  onFocus={() => setTypingLink(true)}
                  onBlur={() => setTypingLink(false)}
                  placeholder="https://…"
                />
              </Field>
            </div>

            <Field
              label="Image"
              hint={
                slot?.format === "section"
                  ? "Required for a section band. Landscape, about 16:9."
                  : "Optional."
              }
            >
              <div className="flex flex-col gap-2">
                <label
                  className={cn(
                    "border-border hover:bg-secondary/60 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors",
                    uploading && "pointer-events-none opacity-60",
                  )}
                >
                  {uploading ? (
                    <UploadIcon className="size-4 animate-pulse" />
                  ) : (
                    <ImageIcon className="size-4" />
                  )}
                  <span className="text-muted-foreground">
                    {uploading
                      ? "Uploading…"
                      : draft.imagePath
                        ? "Replace image"
                        : "Choose an image"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void upload(file);
                    }}
                  />
                </label>

                {draft.imagePath ? (
                  <Input
                    value={draft.imageAlt}
                    onChange={(e) => set("imageAlt", e.target.value)}
                    placeholder="Describe the image"
                  />
                ) : null}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts" hint="Leave empty to start now.">
                <Input
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(e) => set("startsAt", e.target.value)}
                />
              </Field>
              <Field label="Ends" hint="Leave empty to run until paused.">
                <Input
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(e) => set("endsAt", e.target.value)}
                />
              </Field>
            </div>

            <Field
              label={`Share — ${draft.weight}`}
              hint="Against other live placements in the same slot."
            >
              <input
                type="range"
                min={MIN_WEIGHT}
                max={MAX_WEIGHT}
                value={draft.weight}
                onChange={(e) => set("weight", Number(e.target.value))}
                className="accent-primary w-full"
              />
            </Field>

            <Field label="Languages" hint="None selected means every language.">
              <Chips
                options={LOCALES.map((l) => ({ value: l, label: l.toUpperCase() }))}
                selected={draft.locales}
                onToggle={(value) =>
                  set(
                    "locales",
                    draft.locales.includes(value)
                      ? draft.locales.filter((l) => l !== value)
                      : [...draft.locales, value],
                  )
                }
              />
            </Field>

            {slot && slot.surface !== "landing" ? (
              <Field label="Roles" hint="None selected means everyone who sees this console.">
                <Chips
                  options={ROLES.filter((r) => r !== "admin").map((r) => ({
                    value: r,
                    label: r,
                  }))}
                  selected={draft.roles}
                  onToggle={(value) =>
                    set(
                      "roles",
                      draft.roles.includes(value)
                        ? draft.roles.filter((r) => r !== value)
                        : [...draft.roles, value],
                    )
                  }
                />
              </Field>
            ) : null}
          </div>

          {/*
            The real component, not a mock-up of it. See the note on this file.
          */}
          <div className="flex flex-col gap-3">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Preview
            </span>
            <div className="bg-secondary/30 overflow-hidden rounded-xl border p-3">
              {slot ? (
                <Placement ad={preview} format={slot.format} />
              ) : (
                <EmptyState
                  icon={ImageIcon}
                  title="No placement chosen"
                  description="Pick where this goes and the preview appears here."
                />
              )}
            </div>

            {listed.length > 0 ? (
              <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-xs">
                {listed.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || uploading || !problems.ok}>
            {pending ? "Saving…" : draft.id ? "Save" : "Book it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
    </div>
  );
}

/** Multi-select where a native one would be four times the height. */
function Chips<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(({ value, label }) => {
        const on = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            aria-pressed={on}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              on
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
