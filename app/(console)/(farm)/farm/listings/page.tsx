import { LockIcon, SproutIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ListingsBrowser } from "@/components/farm/listings-browser";
import { PostProduceDialog } from "@/components/farm/post-produce-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireFarmer } from "@/lib/auth/farm";
import { produceName } from "@/lib/domain/models";
import { isReady, nextStep } from "@/lib/domain/readiness";
import { farmTotals, readFarmerListings } from "@/lib/firebase/listings-read";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { CATALOGUE } from "@/lib/mock/catalogue";
import { negotiations } from "@/lib/mock/negotiations";

export const metadata: Metadata = { title: "My produce · Farmer" };

export default async function FarmListingsPage() {
  await connection();

  const { farmer, flags, journey } = await requireFarmer();

  // From Firestore, which is where posting writes. This page used to read the
  // mock catalogue, so a farmer could post, get a 201, and watch nothing
  // appear.
  const clock = new Date().getTime();
  const [listings, { threads }] = await Promise.all([
    readFarmerListings(farmer.id),
    readNegotiations(negotiations(clock)),
  ]);
  const totals = farmTotals(listings);

  /*
    Only *open* bargains hang off a listing. A settled one is a record, not a
    decision, and it lives on the history page — mixing them would mean
    scrolling past last month's sales to answer today's offer.
  */
  const threadsByListing: Record<string, typeof threads> = {};
  for (const thread of threads) {
    if (thread.farmerId !== farmer.id || thread.status !== "open") continue;
    (threadsByListing[thread.listingId] ??= []).push(thread);
  }

  // Both flags. The lock names whichever step is actually in the way, because
  // "Subscribe to post" shown to somebody whose verification is pending sends
  // them to pay for something they still cannot use.
  const ready = isReady(flags);
  const blocking = nextStep(journey);
  const lockLabel = flags.awaitingReview
    ? "Verification pending"
    : blocking?.id === "verify"
      ? "Verify to post"
      : "Subscribe to post";
  const lockHref = blocking?.href ?? "/farm/verification";

  // The whole catalogue, in a shape the dialog can use offline. Small enough to
  // send whole — a farmer on a village connection should not wait on a second
  // request to find out what "tomato" is called.
  const crops = Object.values(CATALOGUE).map((produce) => ({
    id: produce.id,
    en: produceName(produce, "en"),
    ta: produceName(produce, "ta", farmer.district),
    unit: produce.defaultUnit,
  }));

  return (
    <>
      <PageHeader
        title="My produce"
        description="What you have listed, and what buyers have offered on it."
        aside={
          /*
            Shown to everyone, locked for those not yet through the steps. The
            point of a paywall on a marketplace is that people can see what
            they are missing — hiding the button would just look like the
            feature does not exist.
          */
          ready ? (
            <PostProduceDialog crops={crops} />
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href={lockHref}>
                <LockIcon className="size-4" />
                {lockLabel}
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-4 p-5">
        {/* The running total, which is the number a farmer actually tracks:
            not how many listings they have, but how much is on the platform
            and in what grade. */}
        {listings.length > 0 ? (
          <div className="border-border bg-card flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-3">
            <span className="text-sm">
              <span className="font-medium tabular-nums">{totals.open}</span>{" "}
              <span className="text-muted-foreground">open</span>
            </span>
            <span className="text-sm">
              <span className="font-medium tabular-nums">
                {totals.quantity} {totals.unit}
              </span>{" "}
              <span className="text-muted-foreground">on offer</span>
            </span>
            {totals.byGrade.map((g) => (
              <span key={g.grade} className="text-muted-foreground text-sm">
                Grade {g.grade.toUpperCase()}{" "}
                <span className="text-foreground font-medium tabular-nums">
                  {g.quantity} {totals.unit}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        {listings.length === 0 ? (
          <div className="border-border text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
            <SproutIcon className="size-7" />
            <p className="max-w-sm text-sm">
              Nothing listed. Post what is ready to cut and buyers across your district will see
              it — you decide the price by bargaining, not by taking a rate off a board.
            </p>
            {ready ? (
              <PostProduceDialog crops={crops} />
            ) : (
              <Button asChild size="sm">
                <Link href={lockHref}>{lockLabel}</Link>
              </Button>
            )}
          </div>
        ) : (
          <ListingsBrowser
            listings={listings}
            threadsByListing={threadsByListing}
            crops={crops}
          />
        )}
      </div>
    </>
  );
}
