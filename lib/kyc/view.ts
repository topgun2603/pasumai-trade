import "server-only";

import { randomUUID } from "node:crypto";

import type { Role } from "@/lib/auth/claims";
import { kycProgress, kycState, REQUIRED_CHECKS, type Check } from "@/lib/domain/kyc";
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
  const provider = digilocker();

  return {
    state: kycState(checks, role),
    checks,
    required,
    progress: kycProgress(checks, role),
    instant: Object.fromEntries(required.map((kind) => [kind, ekycAvailable(kind)])),
    // Only when it would actually work. A consent link on a deployment with no
    // DigiLocker registration is a link to an error page.
    consentUrl: provider.configured ? provider.consentUrl?.(randomUUID()) : undefined,
  };
}
