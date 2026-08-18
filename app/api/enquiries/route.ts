import { isLocale } from "@/lib/i18n";
import {
  MAX_MESSAGE,
  normaliseMobile,
  validate,
  type EnquiryDraft,
} from "@/lib/domain/enquiry";
import { writeEnquiry } from "@/lib/firebase/enquiries";

/**
 * Somebody on the landing page asking to be called.
 *
 * **Public and unauthenticated**, necessarily: the whole point is that the
 * person has no account. That makes it the only write on this platform anybody
 * on the internet can reach, so what it accepts is narrow and what it stores is
 * fixed. Nothing here is taken from the body except the seven fields below —
 * a spread of the request into Firestore would be a public endpoint for writing
 * arbitrary documents.
 *
 * The status is set here and cannot be sent. A caller who could post
 * `status: "closed"` could file their own enquiry straight into the archive,
 * and a caller who could post `notes` could forge an operator's words.
 */

function field(value: unknown, cap: number): string {
  return typeof value === "string" ? value.trim().slice(0, cap) : "";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const draft: EnquiryDraft = {
    interest: body.interest === "farmer" ? "farmer" : "buyer",
    name: field(body.name, 120),
    organisation: field(body.organisation, 120),
    mobile: field(body.mobile, 20),
    district: field(body.district, 120),
    message: field(body.message, MAX_MESSAGE),
    locale: typeof body.locale === "string" && isLocale(body.locale) ? body.locale : "en",
  };

  const errors = validate(draft);
  if (Object.keys(errors).length > 0) {
    return Response.json({ errors }, { status: 422 });
  }

  try {
    const id = await writeEnquiry({
      interest: draft.interest as "farmer" | "buyer",
      name: draft.name,
      organisation: draft.organisation || undefined,
      // One shape, so the number in the console can be dialled without
      // somebody first working out which of five formats it is in.
      mobile: normaliseMobile(draft.mobile),
      district: draft.district,
      message: draft.message || undefined,
      status: "new",
      createdAt: new Date(),
      locale: draft.locale,
    });

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    /*
      The failure that matters most on this route. Everywhere else a failed
      write means somebody retries; here it means a person was told they would
      be called and will not be. It is logged loudly for that reason, and the
      caller is told plainly rather than shown a success they did not get.
    */
    console.error("enquiry write failed", error);
    return Response.json(
      { error: "We could not record that. Please try again, or telephone us." },
      { status: 503 },
    );
  }
}
