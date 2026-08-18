import "server-only";

import { randomUUID } from "node:crypto";

import type { Role } from "@/lib/auth/claims";
import {
  kycProgress,
  kycState,
  OPTIONAL_CHECKS,
  REQUIRED_CHECKS,
  type Check,
} from "@/lib/domain/kyc";
import { signDocuments } from "@/lib/firebase/kyc-read";
import type { ViewableDocument } from "@/components/kyc/documents";
import type { OnboardingView } from "@/components/kyc/onboarding";

import { digilocker, ekycAvailable } from "./provider";

/**
 * Everything the onboarding screen needs, worked out on the server.
 *
 * The client re-derives nothing — a progress count computed in two places is a
 * progress count that eventually disagrees with itself.
 *
 * Async now that documents are signed here. The applicant sees what they sent
 * rather than a claim that something was received: somebody asked for a clearer
 * photograph has to be able to look at the one they uploaded, or "it was
 * blurred" is an assertion they cannot check.
 */
export async function onboardingView(checks: Check[], role: Role): Promise<OnboardingView> {
  const required = REQUIRED_CHECKS[role];
  // Offered but not demanded. A GSTIN or an FSSAI licence makes an account
  // easier to trade with; not holding one is a fact about the business, not a
  // failure, and the progress count only ever measures what is required.
  const optional = OPTIONAL_CHECKS[role];
  const provider = digilocker();
  const now = Date.now();

  const documents: Record<string, ViewableDocument[]> = {};
  await Promise.all(
    checks
      .filter((check) => (check.documents?.length ?? 0) > 0)
      .map(async (check) => {
        const signed = await signDocuments(check.documents);
        documents[check.kind] = signed.map((document) => ({
          url: document.url,
          contentType: document.contentType,
          uploadedLabel: relative(now - document.uploadedAt.getTime()),
          uploadedAt: document.uploadedAt.getTime(),
        }));
      }),
  );

  return {
    state: kycState(checks, role),
    checks,
    documents,
    required,
    optional,
    progress: kycProgress(checks, role),
    instant: Object.fromEntries(
      [...required, ...optional].map((kind) => [kind, ekycAvailable(kind)]),
    ),
    // Only when it would actually work. A consent link on a deployment with no
    // DigiLocker registration is a link to an error page.
    consentUrl: provider.configured ? provider.consentUrl?.(randomUUID()) : undefined,
  };
}

/** Same coarseness as the review queue, so both sides describe a wait alike. */
function relative(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
