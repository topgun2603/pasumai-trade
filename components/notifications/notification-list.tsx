"use client";

import { BadgeCheckIcon, BanknoteIcon, BellIcon, CheckCheckIcon, FileQuestionIcon, HandshakeIcon, MessageSquareIcon, PackageIcon, SproutIcon, TruckIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  describe,
  inReadingOrder,
  isUnread,
  NOTIFICATION_GROUPS,
  unreadCount,
  type Notification,
  type NotificationGroup,
  type NotificationKind,
} from "@/lib/domain/notification";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A list of what has happened, in the reader's language.
 *
 * The text is not stored — the row carries a kind and a few facts, and the
 * sentence is built here from whichever language the reader uses. Same decision
 * as the bargain vocabulary, and for the same reason: the farmer console is
 * read in Tamil and the buyer console in English, off identical records.
 *
 * Marking read goes to the server and then refreshes, rather than being
 * flipped locally. A grey row that is still bold on the next device is worse
 * than a row that takes a moment to go grey.
 */

const ICONS: Record<NotificationKind, typeof BellIcon> = {
  subscriptionEnding: BanknoteIcon,
  produceListed: SproutIcon,
  bargainOpened: HandshakeIcon,
  bargainCountered: HandshakeIcon,
  bargainMessage: MessageSquareIcon,
  bargainAgreed: CheckCheckIcon,
  bargainClosed: HandshakeIcon,
  orderPlaced: PackageIcon,
  transportArranged: TruckIcon,
  checkApproved: BadgeCheckIcon,
  checkRejected: BadgeCheckIcon,
  checkNeedsInfo: FileQuestionIcon,
  checkNeedsReupload: UploadIcon,
  accountVerified: BadgeCheckIcon,
};

const TONES: Partial<Record<NotificationKind, string>> = {
  checkApproved: "text-success",
  accountVerified: "text-success",
  checkRejected: "text-destructive",
  checkNeedsInfo: "text-warning",
  checkNeedsReupload: "text-warning",
  bargainAgreed: "text-success",
  orderPlaced: "text-success",
  transportArranged: "text-primary",
  // Amber, not red: a plan ending is a deadline rather than a failure.
  subscriptionEnding: "text-warning",
};

const GROUP_LABELS: Record<NotificationGroup | "all", string> = {
  all: "All",
  verification: "Verification",
  bargaining: "Bargaining",
  settled: "Sold",
  produce: "New produce",
  transport: "Transport",
  billing: "Plan",
};

export function NotificationList({
  notifications,
  locale,
  /** Dropdown mode: fewer rows, no filters, no bulk action. */
  compact = false,
  onNavigate,
}: {
  notifications: Notification[];
  locale: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [group, setGroup] = useState<NotificationGroup | "all">("all");
  const [busy, setBusy] = useState(false);

  const unread = unreadCount(notifications);

  const shown = inReadingOrder(
    group === "all"
      ? notifications
      : notifications.filter((n) =>
          (NOTIFICATION_GROUPS[group] as readonly string[]).includes(n.kind),
        ),
  ).slice(0, compact ? 8 : undefined);

  async function mark(body: { ids?: string[]; all?: boolean }) {
    setBusy(true);
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);

    if (!response?.ok) {
      const detail = (await response?.json().catch(() => ({}))) as { error?: string };
      toast.error(detail?.error ?? "Could not mark those read.");
      return;
    }
    router.refresh();
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={BellIcon}
        tone="waiting"
        title="No notifications yet"
        description="New produce in your districts, offers on your lots, settled bargains and arranged transport all appear here. Nothing is ever only sent by push — it lands here too, so a missed alert is not a missed message."
        className="border-0"
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {(["all", ...(Object.keys(NOTIFICATION_GROUPS) as NotificationGroup[])] as const).map(
              (id) => {
                const inGroup =
                  id === "all"
                    ? notifications
                    : notifications.filter((n) =>
                        (NOTIFICATION_GROUPS[id] as readonly string[]).includes(n.kind),
                      );
                const fresh = unreadCount(inGroup);

                return (
                  <Button
                    key={id}
                    size="sm"
                    variant={group === id ? "secondary" : "ghost"}
                    onClick={() => setGroup(id)}
                  >
                    {GROUP_LABELS[id]}
                    {/*
                      The unread count where there is one, the total where there
                      is not. A section counting everything it holds disagrees
                      with the rail beside it — which counts only what is
                      unread — and two numbers for the same thing is worse than
                      either. Where nothing is unread the total is still worth
                      showing, so an empty-looking section can be told from a
                      section that is merely all read.
                    */}
                    <Badge
                      variant="outline"
                      // Colour is the only thing separating "1 unread" from "1,
                      // all read", and colour alone is not a distinction
                      // everybody can see. The label says which it is.
                      aria-label={
                        fresh > 0
                          ? `${fresh} unread`
                          : `${inGroup.length}, all read`
                      }
                      className={cn(
                        "tabular ml-1",
                        fresh > 0
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {fresh > 0 ? fresh : inGroup.length}
                    </Badge>
                  </Button>
                );
              },
            )}
          </div>

          {unread > 0 ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => mark({ all: true })}>
              <CheckCheckIcon className="size-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>
      ) : null}

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {shown.map((notification) => {
          const Icon = ICONS[notification.kind];
          const fresh = isUnread(notification);

          return (
            <li key={notification.id}>
              <Link
                href={notification.href}
                onClick={() => {
                  // Opening it is having seen it. Marking read on click rather
                  // than on render means a bell glanced at and dismissed does
                  // not quietly clear things nobody read.
                  if (fresh) void mark({ ids: [notification.id] });
                  onNavigate?.();
                }}
                className={cn(
                  "hover:bg-muted/60 flex gap-3 border-b border-l-2 px-4 py-3 transition-colors",
                  fresh ? "border-l-primary bg-primary/[0.03]" : "border-l-transparent",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    TONES[notification.kind] ?? "text-muted-foreground",
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    lang={locale === "ta" ? "ta-IN" : "en-IN"}
                    className={cn("text-sm", fresh ? "font-medium" : "text-muted-foreground")}
                  >
                    {describe(notification, locale)}
                  </span>
                  {/* What operations actually asked, quoted rather than folded
                      into the translated sentence above it. */}
                  {notification.subject.note ? (
                    <span className="border-primary/40 text-foreground mt-1 border-l-2 pl-2 text-sm">
                      {notification.subject.note}
                    </span>
                  ) : null}
                  <span className="text-faint text-xs">
                    {relativeTime(notification.createdAt, new Date().getTime())}
                  </span>
                </span>
                {fresh ? (
                  <span
                    className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
                    aria-label="Unread"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
