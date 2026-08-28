import { ArrowDownIcon, CheckIcon } from "lucide-react";

import { MediaFrame } from "@/components/marketing/media-frame";
import { SectionHead } from "@/components/marketing/section-head";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/motion-primitives";
import type { Dictionary } from "@/lib/i18n";
import { resolveMedia, type MediaKey } from "@/lib/marketing/media";

/**
 * The Farmer Direct Market brief, as a section of the landing page.
 *
 * ## The copy is the document's, not ours
 *
 * Every string here comes from `t.direct`, which carries the source brief's own
 * wording translated into the six languages rather than a rewrite of it. That
 * is why the paragraphs are longer and more formal than the rest of this page:
 * it is a statement of terms, and terms are the one thing on a marketing page
 * that should not be improved in the retelling.
 *
 * ## Why each step has its own photograph
 *
 * A four-step section used to sit above this one, telling the same story in
 * photographs, and these seven were given their own `dm*` media slots so the
 * page would not show the same picture twice. That section is gone — this one
 * replaced it — and the slots stay, because the mapping from step to picture
 * is now the only one there is.
 *
 * Alternating sides down the page rather than a grid of seven. Seven cards wrap
 * to 4 + 3 at every column count that fits a photograph, leaving a ragged last
 * row; and these steps have bullet lists of five and six items, which a card
 * cannot hold at that width without becoming a wall.
 */
const STEP_MEDIA: readonly MediaKey[] = [
  "dmList",
  "dmNegotiate",
  "dmSecure",
  "dmTransport",
  "dmCheck",
  "dmApprove",
  "dmPayout",
];

export function DirectMarket({ t }: { t: Dictionary }) {
  return (
    <>
      <SectionHead
        index="03"
        eyebrow={t.direct.eyebrow}
        title={t.direct.title}
        body={t.direct.intro1}
        align="center"
      />

      <Reveal className="text-muted-foreground mx-auto mt-5 max-w-2xl text-center leading-relaxed">
        {t.direct.intro2}
      </Reveal>

      <Reveal className="mt-16">
        <h3 className="font-heading text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          {t.direct.worksTitle}
        </h3>
      </Reveal>

      <div className="mt-12 flex flex-col gap-16">
        {t.direct.steps.map((step, index) => {
          const media = resolveMedia(STEP_MEDIA[index]);
          /*
            Odd steps put the photograph second. `lg:order-*` rather than two
            markup branches, so the reading order stays 1..7 for a screen
            reader and for anybody on a phone, where it is one column anyway.
          */
          const flipped = index % 2 === 1;

          return (
            <Reveal
              key={step.title}
              className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12"
            >
              <div className={flipped ? "lg:order-2" : undefined}>
                <MediaFrame
                  src={media.src}
                  alt={step.alt}
                  aspect={media.aspect}
                  isPhotograph={media.isPhotograph}
                  sizes="(min-width: 1024px) 32rem, 100vw"
                />
              </div>

              <div
                className={`flex flex-col gap-4 ${flipped ? "lg:order-1" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="bg-primary text-primary-foreground tabular flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {index + 1}
                  </span>
                  <h4 className="font-heading text-xl font-semibold tracking-tight">
                    {step.title}
                  </h4>
                </div>

                <p className="text-muted-foreground leading-relaxed">
                  {step.lead}
                </p>

                {/* The document runs a second lead-in before some of the
                  lists — "Both parties can mutually agree on:" — and none
                  before others. Empty string where it has none. */}
                {step.lead2 ? (
                  <p className="text-muted-foreground leading-relaxed">
                    {step.lead2}
                  </p>
                ) : null}

                {step.bullets.length > 0 ? (
                  <Stagger className="flex flex-col gap-2">
                    {step.bullets.map((bullet) => (
                      <StaggerItem
                        key={bullet}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
                        <span>{bullet}</span>
                      </StaggerItem>
                    ))}
                  </Stagger>
                ) : null}

                {step.note ? (
                  <p className="border-primary/30 text-muted-foreground border-l-2 pl-4 text-sm leading-relaxed">
                    {step.note}
                  </p>
                ) : null}
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* The transaction flow, as the document sets it out. */}
      <Reveal className="bg-secondary/60 mt-20 flex flex-col items-center gap-5 rounded-xl px-6 py-10">
        <h3 className="font-heading text-2xl font-semibold tracking-tight">
          {t.direct.flowTitle}
        </h3>

        <ol className="flex flex-col items-center gap-1 text-center">
          {t.direct.flow.map((line, index) => (
            <li key={line} className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium text-balance">{line}</span>
              {/* The arrow belongs between the lines, not after the last —
                the document draws it that way and it is the difference
                between a sequence and a list with a stray mark on the end. */}
              {index < t.direct.flow.length - 1 ? (
                <ArrowDownIcon aria-hidden className="text-primary size-4" />
              ) : null}
            </li>
          ))}
        </ol>
      </Reveal>

      {/* Both benefit lists, side by side. */}
      <div className="mt-16 grid gap-10 lg:grid-cols-2">
        {[
          { title: t.direct.farmersTitle, items: t.direct.farmerBenefits },
          { title: t.direct.buyersTitle, items: t.direct.buyerBenefits },
        ].map((list) => (
          <Reveal key={list.title} className="flex flex-col gap-4">
            <h3 className="font-heading text-xl font-semibold tracking-tight">
              {list.title}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {list.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>

      {/* Mission, promise and the tagline, which close the document. */}
      <Reveal className="mt-16 flex flex-col gap-8 text-center">
        <div className="flex flex-col gap-3">
          <span className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            {t.direct.missionTitle}
          </span>
          <p className="mx-auto max-w-3xl leading-relaxed font-medium text-balance">
            {t.direct.mission}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            {t.direct.promiseTitle}
          </span>
          {/*
            One translated string with the arrows inside it, not six joined
            here: the arrows sit differently around a Tamil clause than an
            English one, and assembling it in the component would fix English
            word order onto the other five languages.
          */}
          <p className="text-muted-foreground mx-auto max-w-3xl leading-relaxed text-balance">
            {t.direct.promise}
          </p>
        </div>

        <div className="border-primary/25 bg-accent mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border px-6 py-8">
          <span className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            {t.direct.taglineTitle}
          </span>
          <p className="text-primary font-heading text-xl font-semibold text-balance">
            {t.direct.tagline1}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed text-balance">
            {t.direct.tagline2}
          </p>
        </div>
      </Reveal>
    </>
  );
}
