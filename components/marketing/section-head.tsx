import { Reveal } from "@/components/motion/motion-primitives";
import { cn } from "@/lib/utils";

/**
 * A numbered section heading.
 *
 * The index and the hairline rule are doing real work, not decoration: this
 * page argues that a load moves through a fixed sequence and that every step
 * is written down. A numbered, ruled heading says that about the page itself
 * before a word is read.
 *
 * `index` is presentational, so it is hidden from assistive technology — a
 * screen reader announcing "zero three" before every heading is noise, and the
 * heading text already carries the meaning.
 */
export function SectionHead({
  index,
  eyebrow,
  title,
  body,
  align = "start",
  className,
}: {
  index: string;
  eyebrow: string;
  title: string;
  body?: string;
  align?: "start" | "center";
  className?: string;
}) {
  const centred = align === "center";

  return (
    <Reveal
      className={cn(
        "flex flex-col gap-4",
        centred && "mx-auto max-w-2xl items-center text-center",
        className,
      )}
    >
      <div
        className={cn(
          "text-muted-foreground flex items-center gap-3 text-xs font-medium tracking-[0.18em] uppercase",
          centred && "justify-center",
        )}
      >
        <span aria-hidden className="tabular text-primary">
          {index}
        </span>
        <span aria-hidden className="bg-border h-px w-8" />
        <span>{eyebrow}</span>
      </div>

      <h2 className="font-heading max-w-3xl text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>

      {body ? (
        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed text-pretty">
          {body}
        </p>
      ) : null}
    </Reveal>
  );
}
