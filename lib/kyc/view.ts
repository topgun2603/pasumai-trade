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
import type { OnboardingView } from "@/components/kyc/onboarding";

import { digilocker, ekycAvailable } from "./provider";

/**
 * Everything the onboarding screen needs, worked out on the server.
 *
 * The client re-derives nothing — a progress count computed in two places is a
 * progress count that eventually disagrees with itself.
 */
export function onboardingView(checks: Check[], role: Role): OnboardingView {
  const required = REQUIRED_CHECKS[role];
  // Offered but not demanded. A GSTIN or an FSSAI licence makes an account
  // easier to trade with; not holding one is a fact about the business, not a
  // failure, and the progress count only ever measures what is required.
  const optional = OPTIONAL_CHECKS[role];
  const provider = digilocker();

  return {
    state: kycState(checks, role),
    checks,
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
