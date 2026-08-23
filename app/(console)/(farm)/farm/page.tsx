import { HandshakeIcon, PackageCheckIcon, SproutIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { JourneyChecklist } from "@/components/farm/journey-checklist";
import { ListingCard } from "@/components/farm/listing-card";
import { StatTile } from "@/components/franchise/stat-tile";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { formatQuantity } from "@/lib/domain/quantity";
import { consoleDictionary } from "@/lib/i18n/console";
import { requireFarmer } from "@/lib/auth/farm";
import { formatMoney } from "@/lib/domain/money";
import { lastProposalBy } from "@/lib/domain/negotiation";
import { isReady } from "@/lib/domain/readiness";
import { farmTotals, readFarmerListings } from "@/lib/firebase/listings-read";
import { negotiations } from "@/lib/mock/negotiations";

/*
  Not translated. A browser tab title is read by the person who chose the
  language *and* by anybody looking over their shoulder at a shared handset;
  the console's own heading below is the one that matters, and metadata is
  static here while the language is a per-request cookie.
*/
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

  const [{ farmer, flags, journey }, { t }] = await Promise.all([
    requireFarmer(),
    // The cookie the layout already read; `cache` means this costs nothing.
    consoleDictionary(),
  ]);
  const now = new Date();
  const clock = now.getTime();

  // From Firestore, which is where posting writes. Reading the mock catalogue
  // here meant a farmer posted produce and their own console never showed it.
  const mine = await readFarmerListings(farmer.id);
  const totals = farmTotals(mine);

  const threads = negotiations(clock).filter((t) => t.farmerId === farmer.id);
  const open = threads.filter((t) => t.status === "open");
  const yourTurn = open.filter((t) => t.messages.at(-1)?.author === "buyer");
  const agreed = threads.filter((t) => t.status === "agreed");

  // Both flags, from one place. Nothing on this page works either of them out
  // for itself.
  const ready = isReady(flags);

  return (
    <>
      <PageHeader
        title={`${t.farm.page.greeting}, ${farmer.name.split(" ").at(-1) ?? farmer.name}`}
        description={`${farmer.village}, ${farmer.district}`}
        aside={
          ready ? (
            <Button asChild size="sm">
              <Link href="/farm/listings">
                <SproutIcon className="size-4" />
                {t.farm.page.postProduce}
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-6 p-5">
        {/*
          The checklist replaces the page until it is finished.

          A farmer who cannot yet post has no use for a row of zeroes and an
          empty produce list — those answer questions they do not have. What
          they need is the one next thing, and it is the only thing on screen
          until it is done.
        */}
        {!ready ? <JourneyChecklist steps={journey} /> : null}

        {ready ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile
                label={t.farm.today.produceListed}
                value={totals.open}
                icon={SproutIcon}
                hint={
                  totals.quantity > 0
                    ? `${formatQuantity(totals.quantity, totals.unit)} on offer`
                    : t.farm.today.nothingListed
                }
              />
              <StatTile
                label={t.farm.today.waitingOnYou}
                value={yourTurn.length}
                icon={HandshakeIcon}
                hint={
                  yourTurn.length
                    ? t.farm.today.buyerSpokeLast
                    : t.farm.today.nothingToReply
                }
                tone="warning"
              />
              <StatTile
                label={t.farm.today.agreed}
                value={agreed.length}
                icon={PackageCheckIcon}
                hint={t.farm.today.priceSettled}
                tone="success"
              />
            </div>

            {yourTurn.length > 0 ? (
              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-medium">
                  Buyers waiting for your answer
                </h2>
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
                            <span className="font-medium">
                              {thread.produceName}
                            </span>
                            <span className="text-muted-foreground text-sm">
                              {thread.buyerName} · {thread.quantity}{" "}
                              {thread.unit}
                            </span>
                          </span>
                          {best ? (
                            <span className="flex flex-col items-end leading-tight">
                              <span className="font-medium tabular-nums">
                                {formatMoney({
                                  minorUnits: best.ratePerUnit,
                                  currency: "INR",
                                })}
                                /{thread.unit}
                              </span>
                              <span className="text-faint text-xs uppercase">
                                Grade {best.grade}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              Message waiting
                            </span>
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
                <h2 className="text-sm font-medium">
                  {t.farm.page.yourProduce}
                </h2>
                <Link
                  href="/farm/listings"
                  className="text-primary text-sm hover:underline"
                >
                  {t.farm.page.seeAll}
                </Link>
              </div>

              {mine.length === 0 ? (
                <div className="border-border text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
                  <PackageCheckIcon className="size-6" />
                  <p className="text-sm">
                    Nothing listed yet. Post what you have ready and buyers will
                    bargain for it.
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/farm/listings">{t.farm.page.postProduce}</Link>
                  </Button>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {mine.slice(0, 3).map((listing) => (
                    <ListingCard key={listing.id} listing={listing} t={t.farm.listing} />
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
