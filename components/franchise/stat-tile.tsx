import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-primary",
};

/**
 * The disc behind the icon.
 *
 * Tinted a good deal more strongly than the text, because this is the part
 * doing the identifying — four grey tiles in a row are four tiles nobody can
 * tell apart at a glance, which is the whole job of a counter strip.
 */
const TONE_ICON: Record<Tone, string> = {
  default: "bg-secondary text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
  info: "bg-accent text-primary",
};

/**
 * A counter on a console header strip.
 *
 * Tone encodes urgency, and it used to encode it twice: a tile whose value was
 * zero lost its icon colour as well as its number colour, so a row with nothing
 * urgent in it was four identical grey boxes. That reads as a page that failed
 * to load rather than a platform with nothing wrong, and it is why the console
 * looked lifeless.
 *
 * So the disc always carries its tone — it is what makes "expired documents"
 * findable without reading the label — and only the **number** goes quiet at
 * zero. A count of nothing should not shout; the tile it sits in still needs to
 * be identifiable.
 *
 * The value is deliberately larger than anything around it: this row is
 * scanned, not read.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
}) {
  const quiet = value === 0;

  return (
    <div className="bg-card border-border flex items-start gap-3.5 rounded-xl border p-4 transition-colors">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          // Never dimmed by a zero. See the note above.
          TONE_ICON[tone],
        )}
      >
        <Icon className="size-5" />
      </span>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "tabular text-3xl leading-none font-semibold",
            quiet ? "text-foreground" : TONE_TEXT[tone],
          )}
        >
          {value}
        </span>
        <span className="text-foreground text-sm leading-tight font-medium">{label}</span>
        {hint ? <span className="text-faint text-xs leading-tight">{hint}</span> : null}
      </div>
    </div>
  );
}
