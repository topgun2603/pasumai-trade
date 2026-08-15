import Image from "next/image";

import { Stagger, StaggerItem } from "@/components/motion/motion-primitives";
import { SectionHead } from "@/components/marketing/section-head";
import type { Dictionary } from "@/lib/i18n";
import { resolveMedia, type MediaKey } from "@/lib/marketing/media";

/**
 * The four stages of a load, as photographs.
 *
 * Replaces a flow diagram. A diagram explains a system to someone already
 * willing to read one; a photograph of a vehicle on a real road is what
 * persuades a farmer the vehicle exists. The numbering carries the sequence
 * that the diagram used to.
 *
 * The connectors between cards are dashes drawn with borders rather than an
 * SVG, so they wrap and disappear naturally at narrow widths instead of
 * needing a second layout.
 */
export function Journey({ t }: { t: Dictionary }) {
  const steps: Array<{ media: MediaKey; title: string; body: string; alt: string }> = [
    {
      media: "stepList",
      title: t.how.step1Title,
      body: t.how.step1Body,
      alt: t.how.step1Alt,
    },
    {
      media: "stepBargain",
      title: t.how.step2Title,
      body: t.how.step2Body,
      alt: t.how.step2Alt,
    },
    {
      media: "stepDelivery",
      title: t.how.step3Title,
      body: t.how.step3Body,
      alt: t.how.step3Alt,
    },
    {
      media: "stepSettle",
      title: t.how.step4Title,
      body: t.how.step4Body,
      alt: t.how.step4Alt,
    },
  ];

  return (
    <>
      <SectionHead
        index="03"
        eyebrow={t.how.eyebrow}
        title={t.how.title}
        body={t.how.body}
        align="center"
      />

      <Stagger className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const media = resolveMedia(step.media);

          return (
            <StaggerItem key={step.title}>
              <div className="relative flex flex-col gap-4">
                {/* Dashes to the next card. Hidden on the last, and on any
                    layout where the next card is not beside this one. */}
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="border-primary/40 absolute top-[22%] -right-4 hidden w-4 border-t-2 border-dashed lg:block"
                  />
                ) : null}

                <div className="bg-secondary relative aspect-[4/3] overflow-hidden rounded-xl border">
                  <Image
                    src={media.src}
                    alt={step.alt}
                    fill
                    sizes="(min-width: 1024px) 18rem, (min-width: 640px) 45vw, 90vw"
                    className="object-cover"
                  />
                  {!media.isPhotograph ? (
                    // Says so rather than passing a drawing off as evidence.
                    <span className="bg-background/85 text-faint absolute right-2 bottom-2 rounded px-1.5 py-0.5 text-[10px]">
                      Illustration
                    </span>
                  ) : null}
                </div>

                <div className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground tabular flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-medium">{step.title}</span>
                    <span className="text-muted-foreground text-sm leading-snug">
                      {step.body}
                    </span>
                  </span>
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>
    </>
  );
}
