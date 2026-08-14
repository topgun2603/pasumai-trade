import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

const TONE_ICON_BG: Record<Tone, string> = {
  default: "bg-secondary text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
};

/**
 * A counter on the console header strip.
 *
 * Tone encodes urgency, not decoration — a zero in the danger slot is a quiet
 * tile, and a non-zero one should pull the eye before anything else on the
 * page. The value is deliberately larger than anything around it: this row is
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
    <div className="bg-card flex items-start gap-3 px-5 py-4">
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
          quiet ? TONE_ICON_BG.default : TONE_ICON_BG[tone],
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "tabular text-2xl leading-none font-semibold",
            quiet ? "text-muted-foreground" : TONE_TEXT[tone],
          )}
        >
          {value}
        </span>
        <span className="text-foreground text-sm leading-tight font-medium">
          {label}
        </span>
        {hint ? (
          <span className="text-faint text-xs leading-tight">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}
