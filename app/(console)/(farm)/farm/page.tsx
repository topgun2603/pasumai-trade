import {
  ArrowRightIcon,
  HandshakeIcon,
  PackageCheckIcon,
  SproutIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { StatTile } from "@/components/franchise/stat-tile";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireFarmer } from "@/lib/auth/farm";
import { formatMoney } from "@/lib/domain/money";
import { produceName } from "@/lib/domain/models";
import { lastProposalBy } from "@/lib/domain/negotiation";
import { effectiveStatus, isSubscribed } from "@/lib/domain/subscription";
import { openListings } from "@/lib/mock/listings";
import { negotiations } from "@/lib/mock/negotiations";

export const metadata: Metadata = { title: "Today · Farmer" };

/**
 * What the farmer needs to know standing in the field.
 *
 * Three numbers and the thing that is waiting on them. Not a dashboard: a
 * dashboard is what you build when you do not know which question the person
 * came to ask, and here the question is always "has anyone offered on my
 * produce".
 */
export default async function FarmTodayPage() {
  await connection();

  const { farmer, subscription } = await requireFarmer();
  const now = new Date();
  const clock = now.getTime();

  // Mock listing ids are lower case; account ids are upper. Compared without
  // case so seeded data lines up with a real session.
  const mine = openListings(now).filter(
    (l) => l.farmer.id.toLowerCase() === farmer.id.toLowerCase(),
  );

  const threads = negotiations(clock).filter((t) => t.farmerId === farmer.id);
  const open = threads.filter((t) => t.status === "open");
  const yourTurn = open.filter((t) => t.messages.at(-1)?.author === "buyer");
  const agreed = threads.filter((t) => t.status === "agreed");

  const subscribed = isSubscribed(subscription, now);
  const status = effectiveStatus(subscription, now);

  return (
    <>
      <PageHeader
        title={`Vanakkam, ${farmer.name.split(" ").at(-1) ?? farmer.name}`}
        description={`${farmer.village}, ${farmer.district}`}
        aside={
          <Button asChild size="sm">
            <Link href="/farm/listings">
              <SproutIcon className="size-4" />
              Post produce
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-6 p-5">
        {/*
          The subscription line comes first only when it is in the way. A
          farmer who is paid up should see their produce, not a receipt.
        */}
        {!subscribed ? (
          <div className="border-warning/30 bg-warning-soft flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {status === "requested"
                  ? "Your plan starts when your payment clears"
                  : status === "expired" || status === "pastDue"
                    ? "Your plan has run out"
                    : "You can look around, but not sell yet"}
              </span>
              <span className="text-muted-foreground text-sm">
                Posting produce and bargaining need an active plan. Looking stays free.
              </span>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/farm/subscription">
                See plans
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Produce listed"
            value={mine.length}
            icon={SproutIcon}
            hint="Open right now"
          />
          <StatTile
            label="Waiting on you"
            value={yourTurn.length}
            icon={HandshakeIcon}
            hint={yourTurn.length ? "A buyer has spoken last" : "Nothing to reply to"}
            tone="warning"
          />
          <StatTile
            label="Agreed"
            value={agreed.length}
            icon={PackageCheckIcon}
            hint="Price settled, binding"
            tone="success"
          />
        </div>

        {yourTurn.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Buyers waiting for your answer</h2>
            <ul className="flex flex-col gap-2">
              {yourTurn.map((thread) => {
                // The buyer's last price, shown so the farmer can decide
                // without opening the thread. The whole point of the reminder
                // is the number in it.
                const offer = lastProposalBy(thread, "buyer");
                const best = offer?.bands?.[0];

                return (
                  <li key={thread.id}>
                    <Link
                      href="/farm/bargains"
                      className="border-border hover:bg-secondary flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors"
                    >
                      <span className="flex flex-col leading-tight">
                        <span className="font-medium">{thread.produceName}</span>
                        <span className="text-muted-foreground text-sm">
                          {thread.buyerName} · {thread.quantity} {thread.unit}
                        </span>
                      </span>
                      {best ? (
                        <span className="flex flex-col items-end leading-tight">
                          <span className="font-medium tabular-nums">
                            {formatMoney({ minorUnits: best.ratePerUnit, currency: "INR" })}/
                            {thread.unit}
                          </span>
                          <span className="text-faint text-xs uppercase">
                            Grade {best.grade}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Message waiting</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Your produce</h2>
            <Link href="/farm/listings" className="text-primary text-sm hover:underline">
              See all
            </Link>
          </div>

          {mine.length === 0 ? (
            <div className="border-border text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
              <PackageCheckIcon className="size-6" />
              <p className="text-sm">
                Nothing listed yet. Post what you have ready and buyers will bargain for it.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/farm/listings">Post produce</Link>
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {mine.slice(0, 4).map((listing) => (
                <li
                  key={listing.id}
                  className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <span className="flex flex-col leading-tight">
                    <span className="flex flex-col leading-tight">
                      <span className="font-medium">
                        {produceName(listing.produce, "en")}
                      </span>
                      <span lang="ta" className="text-faint text-xs">
                        {produceName(listing.produce, "ta", listing.farmer.district)}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {listing.quantity} {listing.unit}
                    </span>
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <HandshakeIcon className="size-4" />
                    {listing.status === "awaitingOffer" ? "No offers yet" : "Offer on the table"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
