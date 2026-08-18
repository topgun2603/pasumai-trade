import "server-only";

import type { Channel } from "@/lib/domain/subscription-reminder";

/**
 * Getting a message to somebody, by whatever roads exist.
 *
 * ## What is actually wired, and what is not
 *
 * Two channels work today because the platform already owns them: **in-app**,
 * which is a Firestore write, and **push**, which is FCM. Both are used
 * elsewhere in this codebase and need no account with anybody.
 *
 * **SMS, WhatsApp and email do not work**, and this module is deliberate about
 * saying so rather than pretending. Each needs a provider, a contract and
 * credentials — an Indian SMS sender needs DLT registration with a template
 * approved per message, WhatsApp needs a Business API account with the same,
 * and email needs a domain with SPF and DKIM set up. None of those exist yet,
 * and none can be invented here.
 *
 * So each is an adapter that reports `unconfigured` until its environment
 * variables are set. That matters more than it sounds: a job that silently
 * "succeeds" at sending nothing is how a platform believes it warned two
 * hundred farmers who were never told. `unconfigured` is a result the caller
 * must record, and the admin page shows it.
 *
 * When a provider is chosen, one function per channel is the whole change.
 */

export type Delivery =
  | { channel: Channel; state: "sent"; detail?: string }
  | { channel: Channel; state: "skipped"; reason: string }
  | { channel: Channel; state: "unconfigured"; reason: string }
  | { channel: Channel; state: "failed"; reason: string };

export interface Message {
  readonly accountId: string;
  readonly name: string;
  readonly mobile?: string;
  readonly email?: string;
  /** One line, already in the reader's language. */
  readonly text: string;
  /** Where tapping it should land. */
  readonly href: string;
}

/** Whether a channel could run at all on this deployment. */
export function configured(channel: Channel): boolean {
  switch (channel) {
    case "inApp":
    case "push":
      return true;
    case "sms":
      return Boolean(process.env.SMS_PROVIDER_KEY && process.env.SMS_SENDER_ID);
    case "whatsapp":
      return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
    case "email":
      return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
  }
}

/**
 * Why a channel cannot run, in words an operator can act on.
 *
 * Named environment variables rather than "not configured": the person reading
 * this on the admin page is the person who would set them, and telling them
 * which is the difference between a fix and a support ticket.
 */
export function whyUnconfigured(channel: Channel): string {
  switch (channel) {
    case "inApp":
    case "push":
      return "";
    case "sms":
      return "Set SMS_PROVIDER_KEY and SMS_SENDER_ID. An Indian sender also needs the template registered on DLT.";
    case "whatsapp":
      return "Set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID, and get the template approved in the WhatsApp Business account.";
    case "email":
      return "Set EMAIL_API_KEY and EMAIL_FROM, and add SPF and DKIM records for the sending domain.";
  }
}

/**
 * Sends on one channel.
 *
 * In-app and push are handled by the caller, which already holds the
 * notification writer and the push sender — routing them through here would
 * mean this module importing half the platform for no gain. What is here is
 * the three that do not exist yet, each failing honestly.
 */
export async function sendOn(channel: Channel, message: Message): Promise<Delivery> {
  if (!configured(channel)) {
    return { channel, state: "unconfigured", reason: whyUnconfigured(channel) };
  }

  switch (channel) {
    case "sms":
    case "whatsapp":
      if (!message.mobile) {
        return { channel, state: "skipped", reason: "No mobile number on the account." };
      }
      break;
    case "email":
      if (!message.email) {
        return { channel, state: "skipped", reason: "No email address on the account." };
      }
      break;
    default:
      break;
  }

  /*
    Deliberately not implemented.

    Writing a plausible-looking fetch against a provider nobody has chosen would
    be worse than this: it would compile, it would be reviewed, and it would be
    believed — right up to the first live send, when the shape of the request
    turns out to be wrong and two hundred reminders are lost. The credentials
    check above is real; this is where the provider call goes, once there is a
    provider.
  */
  return {
    channel,
    state: "unconfigured",
    reason: `${channel} has credentials but no provider implementation yet.`,
  };
}
