import { HandshakeIcon, ImageOffIcon, VideoIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FarmListing } from "@/lib/firebase/listings-read";

/**
 * One listing, as the farmer sees it back.
 *
 * The photograph leads, because that is what the farmer just took and it is
 * how they recognise which lot this is — a row of text all reading "Tomato ·
 * 420 kg" is unreadable once there are four of them.
 *
 * Grades are shown broken out. A farmer who listed 300 A and 120 C needs to see
 * that split reflected, or they cannot tell whether the platform understood
 * what they posted.
 */
export function ListingCard({ listing }: { listing: FarmListing }) {
  const cover = listing.imageUrls[0];

  return (
    <li className="border-border bg-card flex gap-4 rounded-lg border p-3">
      <div className="bg-secondary relative size-24 shrink-0 overflow-hidden rounded-md">
        {cover ? (
          /* A signed, short-lived storage URL. next/image would need the host
             allow-listed and would cache a URL that expires within the hour. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={listing.produceName} className="size-full object-cover" />
        ) : (
          <span className="text-muted-foreground flex size-full items-center justify-center">
            <ImageOffIcon className="size-5" />
          </span>
        )}

        {listing.imageUrls.length > 1 ? (
          <span className="bg-background/85 absolute right-1 bottom-1 rounded px-1.5 text-[11px] tabular-nums">
            +{listing.imageUrls.length - 1}
          </span>
        ) : null}

        {listing.videoUrl ? (
          <span className="bg-background/85 absolute top-1 left-1 rounded p-1">
            <VideoIcon className="size-3" />
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-medium">{listing.produceName}</span>
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
        </div>

        {listing.grades.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {listing.grades.map((g) => (
              <span
                key={g.grade}
                className="bg-secondary flex items-center gap-1.5 rounded px-2 py-0.5 text-xs"
              >
                <span className="font-medium">{g.grade.toUpperCase()}</span>
                <span className="tabular-nums">
                  {g.quantity} {listing.unit}
                </span>
              </span>
            ))}
            <span className="text-muted-foreground px-1 text-xs tabular-nums">
              = {listing.quantity} {listing.unit}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm tabular-nums">
            {listing.quantity} {listing.unit}
            {/* Posted before grades were split out. Said, not hidden. */}
            <span className="text-faint ml-2 text-xs">grade not stated</span>
          </span>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="text-faint text-xs">
            {listing.photoCount || listing.imageUrls.length} photo
            {(listing.photoCount || listing.imageUrls.length) === 1 ? "" : "s"}
            {listing.videoUrl ? " · video" : ""}
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href="/farm/bargains">
              <HandshakeIcon className="size-3.5" />
              Bargains
            </Link>
          </Button>
        </div>
      </div>
    </li>
  );
}
