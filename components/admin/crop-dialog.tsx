"use client";

import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CropIcon, IconPicker } from "@/components/admin/crop-icon";
import { useControls } from "@/components/admin/use-controls";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  GRADES,
  GRADE_LABELS,
  QUANTITY_UNITS,
  type QuantityUnit,
} from "@/lib/domain/enums";
import type { District } from "@/lib/domain/location";
import type { Produce } from "@/lib/domain/models";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";

/**
 * Add or edit a crop.
 *
 * Mounted with `key={crop.id}` so opening a different crop remounts with its
 * own seeded state — no effect syncing props into state.
 *
 * Regional overrides are edited here rather than hidden in a submenu because
 * they are the reason names are data at all: a crop called one thing in Erode
 * and another in Thanjavur has to be fixable by whoever notices, in the same
 * place they noticed it.
 */
export function CropDialog({
  crop,
  districts,
  open,
  onOpenChange,
}: {
  crop?: Produce;
  districts: readonly District[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { create, update, pending } = useControls();
  const editing = Boolean(crop);

  const [names, setNames] = useState<Record<string, string>>(() => ({
    ...((crop?.names ?? { en: "" }) as Record<string, string>),
  }));
  const [emoji, setEmoji] = useState(crop?.emoji ?? "🌱");
  const [iconUrl, setIconUrl] = useState<string | null>(crop?.iconUrl ?? null);
  const [unit, setUnit] = useState<QuantityUnit>(crop?.defaultUnit ?? "kg");
  const [active, setActive] = useState(crop?.active ?? true);
  const [shelfLife, setShelfLife] = useState(
    crop?.shelfLifeHours ? String(crop.shelfLifeHours) : "",
  );
  // English only in this form. Translating a grading standard is worth doing,
  // but doing it badly is worse than not doing it: a farmer disputing a grade
  // against a mistranslated standard is in a worse position than one reading
  // the English with the inspector.
  const [grading, setGrading] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      GRADES.map((g) => [g, crop?.grading?.[g]?.en ?? ""]),
    ),
  );
  const [regional, setRegional] = useState<
    Array<{ district: string; locale: string; name: string }>
  >(() =>
    Object.entries(crop?.regional ?? {}).flatMap(([district, byLocale]) =>
      Object.entries(byLocale ?? {}).map(([locale, name]) => ({
        district,
        locale,
        name: name ?? "",
      })),
    ),
  );

  async function save() {
    if (!names.en?.trim()) {
      toast.error("An English name is required");
      return;
    }

    const regionalMap: Record<string, Record<string, string>> = {};
    for (const row of regional) {
      if (!row.district || !row.name.trim()) continue;
      regionalMap[row.district] = {
        ...regionalMap[row.district],
        [row.locale]: row.name.trim(),
      };
    }

    // Existing translations are preserved: the form edits English, so writing
    // back only English would silently wipe any other language already stored.
    const gradingMap: Record<string, Record<string, string>> = {};
    for (const grade of GRADES) {
      const existing = crop?.grading?.[grade] ?? {};
      const en = grading[grade]?.trim();
      const merged = { ...existing, ...(en ? { en } : {}) };
      if (Object.keys(merged).length > 0) gradingMap[grade] = merged;
    }

    const body = {
      names,
      emoji,
      iconUrl,
      defaultUnit: unit,
      regional: regionalMap,
      grading: gradingMap,
      shelfLifeHours: shelfLife.trim() === "" ? "" : Number(shelfLife),
      active,
    };

    const ok = crop
      ? await update("produce", crop.id, body)
      : await create("produce", body);

    if (ok) {
      toast.success(editing ? `${names.en} updated` : `${names.en} added`);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Flex column with the body scrolling, not the whole dialog: this form
          is taller than a laptop viewport, and scrolling the dialog itself
          pushes the Save button off the bottom where nobody finds it. */}
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon emoji={emoji} iconUrl={iconUrl} name={names.en || "crop"} size="sm" />
            {editing ? `Edit ${crop!.names.en}` : "Add a crop"}
          </DialogTitle>
          <DialogDescription>
            Names feed the farmer&rsquo;s crop picker and every market filter.
            English is required; the rest fall back to it, so a new crop is
            usable immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {LOCALES.map((locale) => (
              <div key={locale} className="flex flex-col gap-1.5">
                <Label htmlFor={`name-${locale}`} className="text-sm">
                  <span lang={LOCALE_META[locale].tag}>
                    {LOCALE_META[locale].nativeName}
                  </span>
                  {locale === "en" ? (
                    <span className="text-destructive" aria-hidden>
                      *
                    </span>
                  ) : (
                    <span className="text-faint text-xs font-normal">optional</span>
                  )}
                </Label>
                <Input
                  id={`name-${locale}`}
                  lang={LOCALE_META[locale].tag}
                  value={names[locale] ?? ""}
                  onChange={(e) =>
                    setNames((n) => ({ ...n, [locale]: e.target.value }))
                  }
                />
              </div>
            ))}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit" className="text-sm">
                Default unit
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as QuantityUnit)}>
                <SelectTrigger id="unit">
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
              <p className="text-faint text-xs">
                Money is priced per unit, so this decides how every rate reads.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shelf-life" className="text-sm">
                Shelf life
                <span className="text-faint text-xs font-normal">optional</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="shelf-life"
                  value={shelfLife}
                  onChange={(e) => setShelfLife(e.target.value)}
                  inputMode="numeric"
                  placeholder="96"
                  className="tabular max-w-28"
                />
                <span className="text-faint text-sm">hours</span>
              </div>
              <p className="text-faint text-xs">
                Hours from grading to unsaleable. Sets this crop&rsquo;s
                freshness bands, and decides which loads need a reefer. Blank
                uses the platform default.
              </p>
            </div>

            <IconPicker
              emoji={emoji}
              iconUrl={iconUrl}
              name={names.en}
              onChange={(next) => {
                setEmoji(next.emoji);
                setIconUrl(next.iconUrl);
              }}
            />

            {/* Crops are seasonal. Retiring one has to be possible without
                deleting it, because every past listing still names it. */}
            <div className="border-border flex items-center justify-between gap-4 rounded-md border px-3 py-2.5 sm:col-span-2">
              <div className="flex flex-col">
                <Label htmlFor="crop-active" className="text-sm">
                  Active
                </Label>
                <span className="text-faint text-xs">
                  Inactive crops disappear from the farmer&rsquo;s picker and the
                  market filters. Existing listings are untouched.
                </span>
              </div>
              <Switch id="crop-active" checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Grading standard</span>
              <span className="text-muted-foreground text-sm">
                What each grade physically means. Bargaining settles what grade
                A pays; this is what makes the inspection at the farm gate a
                measurement instead of an opinion.
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {GRADES.map((grade) => (
                <li key={grade} className="flex flex-col gap-1.5">
                  <Label htmlFor={`grading-${grade}`} className="text-sm">
                    Grade {GRADE_LABELS[grade]}
                  </Label>
                  <Textarea
                    id={`grading-${grade}`}
                    rows={2}
                    value={grading[grade] ?? ""}
                    onChange={(e) =>
                      setGrading((g) => ({ ...g, [grade]: e.target.value }))
                    }
                    placeholder={
                      grade === "a"
                        ? "Firm, even colour, 55mm+, no splits"
                        : "Measurable and checkable at the roadside"
                    }
                    className="resize-none"
                  />
                </li>
              ))}
            </ul>
            <p className="text-faint text-xs">
              Written in English and shown to whoever inspects. Keep it to
              things two people standing over a crate can both check.
            </p>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">District overrides</span>
                <span className="text-muted-foreground text-sm">
                  Where a district calls this crop something else. Overrides the
                  language name for farmers there.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setRegional((r) => [
                    ...r,
                    { district: districts[0]?.name ?? "", locale: "ta", name: "" },
                  ])
                }
              >
                <PlusIcon className="size-3.5" />
                Add
              </Button>
            </div>

            {regional.length === 0 ? (
              <p className="text-faint text-xs">None. The language name is used everywhere.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {regional.map((row, index) => (
                  <li key={index} className="flex flex-wrap items-end gap-2">
                    <Select
                      value={row.district}
                      onValueChange={(v) =>
                        setRegional((r) =>
                          r.map((x, i) => (i === index ? { ...x, district: v } : x)),
                        )
                      }
                    >
                      <SelectTrigger className="w-40" aria-label="District">
                        <SelectValue placeholder="District">{row.district}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {districts.map((d) => (
                          <SelectItem key={d.id} value={d.name}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={row.locale}
                      onValueChange={(v) =>
                        setRegional((r) =>
                          r.map((x, i) => (i === index ? { ...x, locale: v } : x)),
                        )
                      }
                    >
                      <SelectTrigger className="w-32" aria-label="Language">
                        <SelectValue>
                          {LOCALE_META[row.locale as keyof typeof LOCALE_META]?.nativeName}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {LOCALES.map((l) => (
                          <SelectItem key={l} value={l}>
                            {LOCALE_META[l].nativeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      value={row.name}
                      onChange={(e) =>
                        setRegional((r) =>
                          r.map((x, i) =>
                            i === index ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder="Local name"
                      className="min-w-40 flex-1"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove override"
                      onClick={() =>
                        setRegional((r) => r.filter((_, i) => i !== index))
                      }
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
