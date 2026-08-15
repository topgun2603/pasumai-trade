import "server-only";

import type { CheckKind } from "@/lib/domain/kyc";

/**
 * Where an eKYC answer actually comes from.
 *
 * Nothing in this codebase can verify an identity by itself, and it is
 * important to be blunt about why. Verifying that an Aadhaar belongs to the
 * person holding it means asking UIDAI, and a private company may only do that
 * through DigiLocker, through offline eKYC XML the person downloads
 * themselves, or through a licensed aggregator. There is no fourth way, and no
 * amount of code here substitutes for one.
 *
 * So this is an interface with a `configured` flag, and the honest behaviour
 * when nothing is configured is to say eKYC is unavailable and send the person
 * down the manual road — not to invent a pass.
 *
 * What the platform *can* do alone is reject impossible input: a number whose
 * checksum fails is wrong no matter what any authority says, and catching it
 * here saves a round trip and a rejection. That is validation, not
 * verification, and `lib/domain/kyc.ts` keeps the two apart.
 */

export interface EkycResult {
  readonly verified: boolean;
  /** Safe to store: masked Aadhaar, a PAN, a GSTIN. Never a raw Aadhaar. */
  readonly reference?: string;
  /** The name as the authority holds it, for comparison against what they typed. */
  readonly verifiedName?: string;
  readonly reason?: string;
}

export interface EkycProvider {
  readonly id: string;
  readonly label: string;
  /** Which checks this provider can answer. */
  readonly handles: readonly CheckKind[];
  /** False when its credentials are absent. The flow reads this, not an env var. */
  readonly configured: boolean;
  /**
   * A consent URL to send the person to, for providers that work by redirect.
   * DigiLocker does; a server-to-server PAN lookup does not.
   */
  readonly consentUrl?: (state: string) => string;
}

/* -------------------------------------------------------------------------
   DigiLocker
   ------------------------------------------------------------------------- */

/**
 * The one to have.
 *
 * DigiLocker is the government's own document wallet: the person signs in with
 * their own Aadhaar and consents, and the platform receives issued documents —
 * Aadhaar, PAN, driving licence, vehicle RC — signed by the issuer. No Aadhaar
 * number is handled by the platform at any point, which removes an entire
 * category of legal exposure rather than managing it.
 *
 * It needs a partner registration at partners.digitallocker.gov.in. Until
 * `DIGILOCKER_CLIENT_ID` and `DIGILOCKER_CLIENT_SECRET` exist, this reports
 * itself unconfigured and the onboarding flow says so.
 */
const DIGILOCKER_AUTHORIZE = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize";

export function digilocker(): EkycProvider {
  const clientId = process.env.DIGILOCKER_CLIENT_ID;
  const secret = process.env.DIGILOCKER_CLIENT_SECRET;
  const redirect = process.env.DIGILOCKER_REDIRECT_URI;

  return {
    id: "digilocker",
    label: "DigiLocker",
    handles: ["identity", "pan"],
    configured: Boolean(clientId && secret && redirect),
    consentUrl: (state) => {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId ?? "",
        redirect_uri: redirect ?? "",
        // `state` is the CSRF defence on the round trip: it is minted per
        // attempt, stored against the session, and compared when they come
        // back. Without it, anyone can hand a victim a callback URL carrying
        // their own authorisation code.
        state,
        scope: "avs_parent",
      });
      return `${DIGILOCKER_AUTHORIZE}?${params.toString()}`;
    },
  };
}

/* -------------------------------------------------------------------------
   Business checks
   ------------------------------------------------------------------------- */

/**
 * PAN, GSTIN and bank verification through a KYC aggregator.
 *
 * These are ordinary REST lookups and every Indian aggregator exposes them —
 * Signzy, IDfy, Surepass, Karza, Cashfree. Deliberately one provider entry
 * rather than five: the platform needs one contract, and which vendor sits
 * behind it is a procurement decision, not an architectural one.
 *
 * The base URL and key are read from the environment so switching vendor is a
 * redeploy rather than a rewrite.
 */
export function businessChecks(): EkycProvider {
  const base = process.env.KYC_API_BASE;
  const key = process.env.KYC_API_KEY;

  return {
    id: "business",
    label: "PAN, GST and bank verification",
    handles: ["pan", "gst", "bank"],
    configured: Boolean(base && key),
  };
}

export function providers(): EkycProvider[] {
  return [digilocker(), businessChecks()];
}

/** The provider that would answer this check, if any is configured for it. */
export function providerFor(kind: CheckKind): EkycProvider | undefined {
  return providers().find((p) => p.configured && p.handles.includes(kind));
}

/**
 * Can this check be done instantly, right now, on this deployment?
 *
 * The onboarding screen asks this per check rather than once overall, because
 * a deployment can perfectly well verify a GSTIN in seconds and still have no
 * way to verify an identity — and telling a farmer "eKYC unavailable" when it
 * is only their bank check that needs a person would be wrong.
 */
export function ekycAvailable(kind: CheckKind): boolean {
  return providerFor(kind) !== undefined;
}
