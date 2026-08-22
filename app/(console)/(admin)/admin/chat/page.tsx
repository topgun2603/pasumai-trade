import type { Metadata } from "next";
import { connection } from "next/server";

import { ChatInbox, type InboxThread } from "@/components/admin/chat-inbox";
import { AdminPageHeader } from "@/components/admin/page-header";
import { hourLabel, isOpen } from "@/lib/domain/chat";
import { readThreads } from "@/lib/firebase/chat-store";
import { readPlatformPolicy } from "@/lib/firebase/controls-read";

export const metadata: Metadata = { title: "Chat · Admin" };

/**
 * Questions from the public site.
 *
 * Where the enquiry queue used to be, doing the job it was meant to do. The
 * difference is that nobody is waiting by a telephone: the person has already
 * been told whether somebody is reading, so an unanswered thread out of hours
 * is a queue rather than a broken promise.
 */
export default async function AdminChatPage() {
  await connection();

  const [threads, policy] = await Promise.all([
    readThreads(),
    readPlatformPolicy(),
  ]);
  const now = new Date();
  const open = isOpen(policy, now);
  const waiting = threads.filter((thread) => !thread.answeredAt).length;

  const rows: InboxThread[] = threads.map((thread) => ({
    id: thread.id,
    name: thread.name,
    mobile: thread.mobile,
    accountId: thread.accountId,
    lastAt: thread.lastAt.toISOString(),
    answeredAt: thread.answeredAt?.toISOString(),
    messages: thread.messages.map((message) => ({
      id: message.id,
      author: message.author,
      body: message.body,
      at: message.at.toISOString(),
    })),
  }));

  return (
    <>
      <AdminPageHeader
        title="Chat"
        description={`Questions from the public site. ${waiting} waiting on a reply.`}
        aside={
          /*
            Says whether the platform is currently telling people somebody is
            reading. An operator answering at nine at night should know the
            person was promised a reply in the morning, not in a minute.
          */
          <span className="flex flex-col items-end gap-0.5 text-xs">
            <span
              className={
                open
                  ? "text-success font-medium"
                  : "text-muted-foreground font-medium"
              }
            >
              {open ? "Answering now" : "Out of hours"}
            </span>
            <span className="text-faint">
              {hourLabel(policy.chatOpensHour)} to{" "}
              {hourLabel(policy.chatClosesHour)} · set in Controls
            </span>
          </span>
        }
      />
      <ChatInbox threads={rows} />
    </>
  );
}
