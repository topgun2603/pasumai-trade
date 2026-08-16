import { LockIcon, SproutIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { PostProduceDialog } from "@/components/farm/post-produce-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireFarmer } from "@/lib/auth/farm";
import { produceName } from "@/lib/domain/models";
import { isReady, nextStep } from "@/lib/domain/readiness";
import { CATALOGUE } from "@/lib/mock/catalogue";
import { openListings } from "@/lib/mock/listings";

export const metadata: Metadata = { title: "My produce · Farmer" };

export default async function FarmListingsPage() {
  await connection();

  const { farmer, flags, journey } = await requireFarmer();
  const now = new Date();

  const mine = openListings(now).filter(
    (l) => l.farmer.id.toLowerCase() === farmer.id.toLowerCase(),
  );

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
            Shown to everyone, locked for those who have not subscribed. The
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
        {mine.length === 0 ? (
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
          <ul className="flex flex-col gap-3">
            {mine.map((listing) => (
              <li
                key={listing.id}
                className="border-border bg-card flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-3.5"
              >
                <div className="flex flex-col leading-tight">
                  <span className="font-medium">{produceName(listing.produce, "en")}</span>
                  <span lang="ta" className="text-faint text-xs">
                    {produceName(listing.produce, "ta", listing.farmer.district)}
                  </span>
                </div>

                <span className="text-muted-foreground text-sm tabular-nums">
                  {listing.quantity} {listing.unit}
                </span>

                <Badge
                  variant="outline"
                  className={
                    listing.status === "awaitingOffer"
                      ? "text-muted-foreground"
                      : "border-success/40 text-success"
                  }
                >
                  {listing.status === "awaitingOffer" ? "No offers yet" : "Offer received"}
                </Badge>

                <Button asChild size="sm" variant="outline">
                  <Link href="/farm/bargains">Open bargain</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
