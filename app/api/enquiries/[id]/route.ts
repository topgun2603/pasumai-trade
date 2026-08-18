import { requireRole } from "@/lib/api/write-guard";
import {
  advance,
  ENQUIRY_STATUSES,
  EnquiryError,
  type EnquiryStatus,
} from "@/lib/domain/enquiry";
import { readEnquiry, updateEnquiry } from "@/lib/firebase/enquiries";

/**
 * An operator moving an enquiry along.
 *
 * Admin only, unlike the POST that creates them — anybody may ask to be called,
 * and only operations may say what happened next. The domain refuses the two
 * moves that would make the queue lie: closing without a reason, and putting
 * something back to `new` after it has been picked up, which would have the
 * badge counting work already done.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/enquiries/[id]">,
) {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  let body: { status?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const status = ENQUIRY_STATUSES.includes(body.status as EnquiryStatus)
    ? (body.status as EnquiryStatus)
    : undefined;
  if (!status) return Response.json({ error: "Unknown status." }, { status: 422 });

  const message = typeof body.message === "string" ? body.message : undefined;

  const enquiry = await readEnquiry(id);
  if (!enquiry) return Response.json({ error: "No such enquiry." }, { status: 404 });

  const operator = gate.session.email ?? gate.session.uid;

  try {
    const moved = advance(enquiry, status, operator, message, new Date());
    await updateEnquiry(moved);
    return Response.json({ id, status: moved.status });
  } catch (error) {
    if (error instanceof EnquiryError) {
      // Written to be read by the operator who tried it, so it goes back as-is.
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
