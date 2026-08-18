import { requireSession } from "@/lib/api/write-guard";
import {
  MAX_DOCUMENTS,
  isDocumentType,
  isWellFormedAadhaar,
  isWellFormedGstin,
  kycState,
  maskAadhaar,
  recordManual,
  respond,
  withDocuments,
  type Check,
  type CheckKind,
  type KycDocument,
} from "@/lib/domain/kyc";
import { checkIfsc, checkPan, normalise } from "@/lib/domain/registration";
import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";
import { adminDb } from "@/lib/firebase/admin";
import { readChecks, serialiseChecks } from "@/lib/firebase/kyc-read";
import { ekycAvailable } from "@/lib/kyc/provider";

/**
 * Submit a KYC check manually.
 *
 * Everything that lands here goes to `review`. There is no branch, no flag and
 * no request body that produces a verified account — `recordManual` cannot
 * return anything else, and only operations calling `approve` can move it on.
 *
 * What this *does* refuse outright is input that cannot be right: an Aadhaar
 * whose Verhoeff checksum fails, a GSTIN whose check digit is wrong, a
 * malformed PAN or IFSC. Sending those to a queue would waste an operator's
 * afternoon on something the person can fix in ten seconds — and the rejection
 * arrives now rather than in two days.
 *
 * Validation is not verification, and the difference is the whole feature. A
 * well-formed Aadhaar is not a verified identity; it is a number that could
 * exist. Only an authority says whose it is.
 */

const KINDS: CheckKind[] = ["identity", "pan", "gst", "bank", "fssai"];

/** Returns the value to store, or the reason it cannot be stored. */
function validate(kind: CheckKind, raw: string): { reference: string } | { error: string } {
  const value = raw.trim();
  if (!value) return { error: "Enter the number from your document." };

  switch (kind) {
    case "identity": {
      if (!isWellFormedAadhaar(value)) {
        return {
          error:
            "That Aadhaar number is not valid. Check the twelve digits — one is mistyped.",
        };
      }
      // The masked form is what is stored, computed here and immediately
      // afterwards the full number is out of scope. It is never written, never
      // logged, and never returned.
      return { reference: maskAadhaar(value) };
    }

    case "pan": {
      const problem = checkPan(value);
      return problem ? { error: problem } : { reference: normalise(value).replace(/\s/g, "") };
    }

    case "gst": {
      if (!isWellFormedGstin(value)) {
        // Shape only, and the message says what the shape is rather than
        // asserting the number is wrong — the register decides that, not us.
        return {
          error:
            "A GSTIN is 15 characters, like 27AAPFU0939F1ZV. Check it against your certificate.",
        };
      }
      return { reference: normalise(value).replace(/\s/g, "") };
    }

    case "bank": {
      // `IFSC:account` — the IFSC is checkable, the account number is not
      // beyond its length, which is why a bank check really wants a penny drop.
      const [ifsc, account] = value.split(":").map((p) => p?.trim() ?? "");
      const problem = checkIfsc(ifsc ?? "");
      if (problem) return { error: problem };
      if (!/^[0-9]{9,18}$/.test(account ?? "")) {
        return { error: "Account numbers are 9 to 18 digits." };
      }
      // Only the tail is stored. A full account number on a screen is a full
      // account number over somebody's shoulder, and the platform pays out
      // through a fund account rather than by reading this back.
      return { reference: `${normalise(ifsc)} ••••${account.slice(-4)}` };
    }

    case "fssai": {
      if (!/^[0-9]{14}$/.test(value.replace(/\s/g, ""))) {
        return { error: "FSSAI licence numbers are 14 digits." };
      }
      return { reference: value.replace(/\s/g, "") };
    }
  }
}

/**
 * The files the browser has just uploaded, taken only if they are this
 * account's own.
 *
 * The path is checked against the caller rather than trusted, even though this
 * server composed it a moment ago in `/api/kyc/uploads`. The two requests are
 * separate and nothing carries between them but the body — so without this,
 * anybody could attach `kyc/<someone else>/identity/…` to their own check and
 * have operations sign and open another person's Aadhaar photograph on their
 * behalf.
 */
function readDocuments(
  raw: unknown,
  accountId: string,
  kind: CheckKind,
  now: Date,
): KycDocument[] {
  if (!Array.isArray(raw)) return [];
  const prefix = `kyc/${accountId}/${kind}/`;

  return raw
    .flatMap((entry): KycDocument[] => {
      if (!entry || typeof entry !== "object") return [];
      const d = entry as Record<string, unknown>;
      const path = typeof d.path === "string" ? d.path : "";
      const contentType = typeof d.contentType === "string" ? d.contentType.toLowerCase() : "";
      if (!path.startsWith(prefix) || path.includes("..")) return [];
      if (!isDocumentType(contentType)) return [];
      return [{ path, contentType, uploadedAt: now }];
    })
    .slice(0, MAX_DOCUMENTS);
}

export async function POST(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { role, accountId } = gate.session.claims;
  if (!canSelfSignup(role) || !accountId) {
    return Response.json({ error: "This account does not need KYC." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const kind = body.kind as CheckKind;
  if (!KINDS.includes(kind)) {
    return Response.json({ error: "Unknown check." }, { status: 422 });
  }

  const value = typeof body.value === "string" ? body.value : "";
  const outcome = validate(kind, value);
  if ("error" in outcome) {
    return Response.json({ error: outcome.error, field: kind }, { status: 422 });
  }

  const now = new Date();
  const existing = await readChecks(role, accountId);

  const already = existing.find((c) => c.kind === kind);
  if (already?.state === "verified") {
    // Re-submitting something already cleared would send a verified check back
    // into the queue and take away access the person already has.
    return Response.json(
      { error: "That check is already verified.", state: "verified" },
      { status: 409 },
    );
  }

  /*
    A re-submission is an answer, not a fresh start.

    Somebody sent back for a clearer photograph, or asked whose name the account
    is in, is replying to a question — and `recordManual` would drop a brand new
    check on top, taking the whole conversation with it. Operations would then
    see a first-time submission and have no idea they had already asked twice.

    `respond` keeps the trail and puts it back in front of them; a message may
    ride along with it, which is how an applicant answers a question rather than
    only re-uploading a file.
  */
  const answering = already?.state === "moreInfo" || already?.state === "reupload";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const documents = readDocuments(body.documents, accountId, kind, now);

  /*
    Evidence accumulates across passes rather than replacing what was there.
    Operations who asked for a clearer photograph need to see both, or there is
    no record that the first one was unreadable — and no way to tell somebody
    who genuinely fixed it from somebody sending the same page again.
  */
  const base = answering
    ? { ...respond(already, message || undefined, now), reference: outcome.reference }
    : recordManual(kind, outcome.reference, now);

  // `recordManual` starts a clean check, so what was already uploaded is put
  // back before the new files go on top of it. Otherwise somebody resubmitting
  // a refused check erases the photograph it was refused for.
  const check = withDocuments({ ...base, documents: already?.documents }, documents);

  const checks: Check[] = [...existing.filter((c) => c.kind !== kind), check];
  const state = kycState(checks, role);

  await adminDb()
    .collection(COLLECTION_FOR_SIGNUP[role])
    .doc(accountId)
    .set({ kyc: serialiseChecks(checks) }, { merge: true });

  return Response.json(
    {
      kind,
      state: check.state,
      reference: check.reference,
      kycState: state,
      // Said back so the interface can be honest about the wait rather than
      // guessing at it.
      ekycWasAvailable: ekycAvailable(kind),
    },
    { status: 201 },
  );
}
