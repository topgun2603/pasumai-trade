"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRADES, QUANTITY_UNITS, type QuantityUnit } from "@/lib/domain/enums";
import { rupeesToPaise } from "@/lib/domain/listing-draft";

/**
 * Quantity and asking price, per grade, with the unit above them.
 *
 * Shared by posting and editing so the two cannot drift — the same three rows
 * with the same rules, and one place to change when a fourth grade or a sixth
 * unit appears.
 *
 * The price is optional and labelled as an asking price, because that is what
 * it is: a buyer still has to offer and the farmer still has to accept. What it
 * removes is negotiating from nowhere. A farmer with no number in front of them
 * is anchored by whatever the first buyer says, which is the thing this
 * platform exists to stop.
 */

const UNITS = Object.keys(QUANTITY_UNITS) as QuantityUnit[];

export interface GradeRow {
  quantity: string;
  rate: string;
}

export type GradeRowState = Record<string, GradeRow>;

export const emptyRows: GradeRowState = Object.fromEntries(
  GRADES.map((g) => [g, { quantity: "", rate: "" }]),
);

const HELP: Record<string, string> = {
  a: "Best — even size, no marks",
  b: "Good — small blemishes",
  c: "Fair — misshapen, still sound",
};

/** Total quantity across the grades that have one. */
export function rowsTotal(rows: GradeRowState): number {
  return GRADES.reduce((sum, g) => sum + Math.max(0, Number(rows[g]?.quantity ?? "") || 0), 0);
}

/** The shape the API takes: `{ a: { quantity, rate } }`, priced grades only. */
export function rowsToPayload(rows: GradeRowState): Record<string, { quantity: number; rate?: number }> {
  const out: Record<string, { quantity: number; rate?: number }> = {};
  for (const grade of GRADES) {
    const quantity = Number(rows[grade]?.quantity ?? "") || 0;
    if (quantity <= 0) continue;
    out[grade] = { quantity, rate: rupeesToPaise(rows[grade]?.rate ?? "") };
  }
  return out;
}

export function GradeRows({
  rows,
  unit,
  onRows,
  onUnit,
  disabled,
}: {
  rows: GradeRowState;
  unit: QuantityUnit;
  onRows: (next: GradeRowState) => void;
  onUnit: (next: QuantityUnit) => void;
  disabled?: boolean;
}) {
  const total = rowsTotal(rows);

  function set(grade: string, field: keyof GradeRow, value: string) {
    onRows({ ...rows, [grade]: { ...rows[grade], [field]: value } });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unit">Sold by</Label>
          <Select value={unit} onValueChange={(v) => onUnit(v as QuantityUnit)} disabled={disabled}>
            <SelectTrigger id="unit" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {QUANTITY_UNITS[u].en}
                  <span lang="ta" className="text-muted-foreground ml-2">
                    {QUANTITY_UNITS[u].ta}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {total > 0 ? (
          <span className="text-muted-foreground pb-2 text-xs tabular-nums">
            {total} {unit} in total
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {/* Column headings, so the two number boxes are not a guess. */}
        <div className="text-faint flex items-center gap-2 pl-11 text-[11px]">
          <span className="flex-1">Quantity</span>
          <span className="w-28 text-right">Asking price</span>
        </div>

        {GRADES.map((grade) => (
          <div key={grade} className="flex items-start gap-2">
            <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-md font-medium">
              {grade.toUpperCase()}
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Grade ${grade.toUpperCase()} quantity`}
                  inputMode="decimal"
                  placeholder="0"
                  disabled={disabled}
                  className="flex-1 text-right"
                  value={rows[grade]?.quantity ?? ""}
                  onChange={(e) => set(grade, "quantity", e.target.value)}
                />
                <span className="text-muted-foreground w-14 shrink-0 text-xs">{unit}</span>

                <div className="relative w-28 shrink-0">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm">
                    ₹
                  </span>
                  <Input
                    aria-label={`Grade ${grade.toUpperCase()} asking price per ${unit}`}
                    inputMode="decimal"
                    placeholder="—"
                    disabled={disabled}
                    className="pl-6 text-right"
                    value={rows[grade]?.rate ?? ""}
                    onChange={(e) => set(grade, "rate", e.target.value)}
                  />
                </div>
              </div>

              <span className="text-faint text-[11px]">{HELP[grade]}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Fill in only the grades you have. The price is what you are asking — buyers can still
        offer less, and you decide. Leave it blank to invite offers.
      </p>
    </div>
  );
}
