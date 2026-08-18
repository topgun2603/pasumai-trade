import type { UploadedFile } from "@/components/admin/upload-kit";
import type { RosterKind } from "@/lib/domain/roster-write";

/**
 * Sending a vehicle, driver or worker — documents first, then the record.
 *
 * Two steps, because the bytes do not pass through the application server: it
 * signs a URL per file, the browser PUTs to it, and only the paths come back.
 * A photograph from a phone camera is comfortably past what a serverless
 * function will take as a request body.
 *
 * Order matters. The files go first and the record second, so a record is never
 * written pointing at a document that failed to arrive — operations would sign
 * a path with no object behind it and see a blank where a permit should be. The
 * cost of that order is an orphaned object in storage when the second step
 * fails, which is a cleanup job rather than a person staring at nothing.
 */

export interface RosterFailure {
  readonly message: string;
  /** Field-level messages from the server, keyed as the form keys them. */
  readonly fields?: Record<string, string>;
}

export class RosterSubmitError extends Error implements RosterFailure {
  constructor(
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "RosterSubmitError";
  }
}

async function readError(response: Response, fallback: string): Promise<never> {
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    fields?: Record<string, string>;
  };
  throw new RosterSubmitError(data.error ?? fallback, data.fields);
}

/** Uploads the chosen files and returns the stored path for each slot. */
async function sendFiles(
  kind: RosterKind,
  chosen: Record<string, UploadedFile | null>,
): Promise<Record<string, { path: string; contentType: string }>> {
  const entries = Object.entries(chosen).filter(
    (entry): entry is [string, UploadedFile] => Boolean(entry[1]),
  );
  if (entries.length === 0) return {};

  const response = await fetch("/api/roster/uploads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind,
      files: entries.map(([slot, file]) => ({
        slot,
        contentType: file.type,
        bytes: file.size,
      })),
    }),
  });

  if (!response.ok) await readError(response, "Could not prepare the upload.");

  const data = (await response.json()) as {
    uploads: Array<{
      slot: string;
      path: string;
      url: string;
      contentType: string;
    }>;
  };

  await Promise.all(
    data.uploads.map(async (upload, at) => {
      const put = await fetch(upload.url, {
        method: "PUT",
        headers: { "content-type": upload.contentType },
        body: entries[at][1].blob,
      });
      // A failed PUT would otherwise be recorded as a document that is not
      // there, which is worse than refusing the whole submission.
      if (!put.ok)
        throw new RosterSubmitError(
          "An upload did not finish. Check the connection.",
        );
    }),
  );

  return Object.fromEntries(
    data.uploads.map(({ slot, path, contentType }) => [
      slot,
      { path, contentType },
    ]),
  );
}

export async function submitRoster(
  kind: RosterKind,
  values: Record<string, unknown>,
  chosen: Record<string, UploadedFile | null>,
): Promise<{ id: string }> {
  const files = await sendFiles(kind, chosen);

  const response = await fetch(`/api/roster/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ values, files }),
  });

  if (!response.ok) await readError(response, "Could not save that.");

  return (await response.json()) as { id: string };
}
