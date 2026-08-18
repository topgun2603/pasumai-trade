"use client";

import {
  BadgeCheckIcon,
  ClockIcon,
  FileTextIcon,
  PaperclipIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { DocumentStrip, type ViewableDocument } from "@/components/kyc/documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CHECK_LABELS,
  KYC_LABELS,
  MAX_DOCUMENTS,
  MAX_DOCUMENT_BYTES,
  isDocumentType,
  type Check,
  type CheckKind,
  type KycState,
} from "@/lib/domain/kyc";

/** Everything the server worked out, so the client re-derives none of it. */
export interface OnboardingView {
  readonly state: KycState;
  readonly checks: readonly Check[];
  readonly required: readonly CheckKind[];
  /** Worth having, never in the way. */
  readonly optional: readonly CheckKind[];
  readonly progress: { done: number; total: number };
  /** Per check, whether this deployment can verify it instantly. */
  readonly instant: Record<string, boolean>;
  /** A DigiLocker consent URL, when one is configured. */
  readonly consentUrl?: string;
  /**
   * What has already been uploaded, per check, signed for viewing.
   *
   * Shown back deliberately. Somebody told their photograph was unreadable can
   * look at the one operations saw, rather than being asked to take it on faith
   * and guess at what to change.
   */
  readonly documents: Record<string, ViewableDocument[]>;
  /**
   * Per check, how many recorded documents storage could not produce.
   *
   * Almost always zero. When it is not, the file behind an upload is gone —
   * deleted, or a half-finished upload — and the applicant needs telling,
   * because their screen would otherwise show a check with no evidence and no
   * explanation for where it went.
   */
  readonly missingDocuments: Record<string, number>;
}

/** A file chosen but not yet sent. */
interface Chosen {
  readonly file: File;
  /** Object URL for the thumbnail; revoked when the file is dropped. */
  readonly preview: string;
}

const HELP: Record<CheckKind, { placeholder: string; hint: string }> = {
  identity: {
    placeholder: "9999 4105 7058",
    hint: "Only the last four digits are stored. The full number is never saved.",
  },
  pan: { placeholder: "AAECK4521M", hint: "Ten characters, as printed on the card." },
  gst: { placeholder: "33AAECK4521M1ZP", hint: "Fifteen characters from your GST certificate." },
  bank: {
    placeholder: "HDFC0001234:50100123456789",
    hint: "IFSC, then a colon, then the account number. Only the last four digits are stored.",
  },
  fssai: { placeholder: "12345678901234", hint: "Fourteen digits from the licence." },
};

function StateBadge({ check }: { check?: Check }) {
  if (!check) return <Badge variant="outline">Not started</Badge>;

  switch (check.state) {
    case "verified":
      return (
        <Badge variant="outline" className="border-success/40 text-success">
          <BadgeCheckIcon className="size-3" />
          {check.method === "ekyc" ? "Verified instantly" : "Approved"}
        </Badge>
      );
    case "review":
      return (
        <Badge variant="outline" className="border-warning/40 bg-warning-soft text-warning">
          <ClockIcon className="size-3" />
          Waiting for approval
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          <TriangleAlertIcon className="size-3" />
          Refused
        </Badge>
      );
    /*
      These two used to fall through to "In progress", which reads as though the
      platform is working on it — the opposite of the truth. Both mean the
      applicant has been asked for something and nothing moves until they act.
    */
    case "moreInfo":
      return (
        <Badge variant="outline" className="border-warning/40 bg-warning-soft text-warning">
          <TriangleAlertIcon className="size-3" />
          Waiting on you
        </Badge>
      );
    case "reupload":
      return (
        <Badge variant="outline" className="border-warning/40 bg-warning-soft text-warning">
          <PaperclipIcon className="size-3" />
          Send it again
        </Badge>
      );
    default:
      return <Badge variant="outline">In progress</Badge>;
  }
}

export function KycOnboarding({ view, roleLabel }: { view: OnboardingView; roleLabel: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, Chosen[]>>({});
  const pickers = useRef<Record<string, HTMLInputElement | null>>({});

  const byKind = (kind: CheckKind) => view.checks.find((c) => c.kind === kind);

  /** A file attached now, or one already on the check from an earlier pass. */
  const hasEvidence = (kind: CheckKind) =>
    (chosen[kind]?.length ?? 0) > 0 || (view.documents[kind]?.length ?? 0) > 0;

  /** Adds files to the pile for one check, refusing what the server would. */
  function pick(kind: CheckKind, list: FileList | null) {
    if (!list) return;
    const files = Array.from(list);

    const bad = files.find((file) => !isDocumentType(file.type));
    if (bad) {
      setErrors((e) => ({ ...e, [kind]: "Upload a photograph or a PDF." }));
      return;
    }
    const heavy = files.find((file) => file.size > MAX_DOCUMENT_BYTES);
    if (heavy) {
      setErrors((e) => ({
        ...e,
        [kind]: "That file is too large. A photograph from a phone camera is well under the limit.",
      }));
      return;
    }

    setChosen((current) => {
      const existing = current[kind] ?? [];
      const room = MAX_DOCUMENTS - existing.length;
      if (room <= 0) return current;
      const added = files.slice(0, room).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      return { ...current, [kind]: [...existing, ...added] };
    });
    setErrors((e) => ({ ...e, [kind]: "" }));
  }

  function drop(kind: CheckKind, index: number) {
    setChosen((current) => {
      const existing = current[kind] ?? [];
      // The object URL is a live handle to the file; not revoking it keeps the
      // whole photograph in memory for the life of the tab.
      URL.revokeObjectURL(existing[index]?.preview ?? "");
      return { ...current, [kind]: existing.filter((_, i) => i !== index) };
    });
  }

  /**
   * Sends the chosen files straight to storage and returns what to record.
   *
   * Two steps because the bytes do not pass through the application server: it
   * signs a URL per file, the browser PUTs to it, and only the paths come back
   * here. A phone photograph is comfortably past what a serverless function
   * will accept as a request body.
   */
  async function sendFiles(kind: CheckKind): Promise<Array<{ path: string; contentType: string }>> {
    const files = chosen[kind] ?? [];
    if (files.length === 0) return [];

    const response = await fetch("/api/kyc/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        files: files.map(({ file }) => ({ contentType: file.type, bytes: file.size })),
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      uploads?: Array<{ path: string; url: string; contentType: string }>;
    };
    if (!response.ok || !data.uploads) {
      throw new Error(data.error ?? "Could not prepare the upload.");
    }

    await Promise.all(
      data.uploads.map(async (upload, i) => {
        const put = await fetch(upload.url, {
          method: "PUT",
          headers: { "content-type": upload.contentType },
          body: files[i].file,
        });
        // A failed PUT would otherwise be recorded as a document that is not
        // there, and operations would sign a path with no object behind it.
        if (!put.ok) throw new Error("An upload did not finish. Check the connection.");
      }),
    );

    return data.uploads.map(({ path, contentType }) => ({ path, contentType }));
  }

  async function submit(kind: CheckKind) {
    const value = values[kind] ?? "";
    setPending(kind);

    let documents: Array<{ path: string; contentType: string }>;
    try {
      documents = await sendFiles(kind);
    } catch (error) {
      setPending(null);
      setErrors((e) => ({
        ...e,
        [kind]: error instanceof Error ? error.message : "Could not upload that.",
      }));
      return;
    }

    let response: Response;
    try {
      response = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, value, documents }),
      });
    } catch {
      setPending(null);
      toast.error("Could not reach the server. Try again.");
      return;
    }

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(null);

    if (!response.ok) {
      // On the field, because that is where the fix is.
      setErrors((e) => ({ ...e, [kind]: data.error ?? "Could not submit that." }));
      return;
    }

    setErrors((e) => ({ ...e, [kind]: "" }));
    setValues((v) => ({ ...v, [kind]: "" }));
    for (const file of chosen[kind] ?? []) URL.revokeObjectURL(file.preview);
    setChosen((c) => ({ ...c, [kind]: [] }));
    toast.success(`${CHECK_LABELS[kind]} submitted`, {
      description: "Operations will check it. You will not be asked again.",
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
          view.state === "verified"
            ? "border-success/40 bg-success-soft text-success"
            : view.state === "rejected"
              ? "border-destructive/40 text-destructive"
              : view.state === "awaitingApproval"
                ? "border-warning/40 bg-warning-soft text-warning"
                : "border-border"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <ShieldCheckIcon className="size-4 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-medium">{KYC_LABELS[view.state]}</span>
            <span className="text-xs opacity-80">
              {view.state === "verified"
                ? "Your account is fully verified."
                : view.state === "awaitingApproval"
                  ? "Everything is submitted. Operations usually reply within two working days."
                  : `${roleLabel} accounts need ${view.required.length} checks.`}
            </span>
          </span>
        </span>
        <Badge variant="outline" className="tabular-nums">
          {view.progress.done} of {view.progress.total}
        </Badge>
      </div>

      {/*
        The instant path, offered first and only when it is genuinely available.
        A DigiLocker button on a deployment with no DigiLocker credentials would
        be a button that fails — worse than not offering it.
      */}
      {view.consentUrl ? (
        <div className="border-primary/25 bg-accent flex flex-col gap-3 rounded-lg border p-5">
          <span className="flex items-center gap-2 font-medium">
            <ZapIcon className="size-4" />
            Verify instantly with DigiLocker
          </span>
          <p className="text-muted-foreground text-sm">
            Sign in with your own Aadhaar and approve sharing. Your documents come straight from
            the issuer, you are verified in seconds, and nobody has to approve anything. The
            platform never sees your Aadhaar number.
          </p>
          <Button asChild className="self-start">
            <a href={view.consentUrl}>Continue to DigiLocker</a>
          </Button>
        </div>
      ) : (
        <div className="bg-secondary flex items-start gap-2.5 rounded-lg px-4 py-3.5">
          <FileTextIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">Instant verification is not switched
            on yet.</span>{" "}
            Enter your details below and operations will check them by hand — usually within two
            working days. You can use the platform and look around meanwhile.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {[...view.required, ...view.optional].map((kind) => {
          const isOptional = view.optional.includes(kind);
          const check = byKind(kind);
          const done = check?.state === "verified" || check?.state === "review";

          return (
            <div key={kind} className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  {CHECK_LABELS[kind]}
                  {isOptional ? (
                    <span className="text-muted-foreground text-xs font-normal">— optional</span>
                  ) : null}
                  {view.instant[kind] ? (
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      <ZapIcon className="size-3" />
                      Instant
                    </Badge>
                  ) : null}
                </span>
                {check || !isOptional ? (
                  <StateBadge check={check} />
                ) : (
                  <span className="text-faint text-xs">Not provided</span>
                )}
              </div>

              {check?.reference ? (
                <p className="text-muted-foreground font-mono text-sm">{check.reference}</p>
              ) : null}

              {/*
                Shown for every state that carries one, not only refusals. A
                question asked and a document sent back both put words on the
                check, and both used to be invisible here — the applicant saw
                "waiting on you" with nothing to act on.
              */}
              {check?.reason && check.state !== "verified" ? (
                <p
                  className={
                    check.state === "failed"
                      ? "text-destructive text-sm"
                      : "border-warning/50 text-foreground border-l-2 pl-2.5 text-sm"
                  }
                >
                  {check.reason}
                </p>
              ) : null}

              {/* Everything sent so far, newest first. A person asked to send a
                  clearer photograph can see the one that was refused. */}
              <DocumentStrip
                documents={view.documents[kind] ?? []}
                label={CHECK_LABELS[kind]}
              />

              {(view.missingDocuments[kind] ?? 0) > 0 ? (
                <p className="text-warning flex items-start gap-1.5 text-xs">
                  <TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />
                  {view.missingDocuments[kind] === 1
                    ? "A document you sent is no longer stored. Please attach it again."
                    : `${view.missingDocuments[kind]} documents you sent are no longer stored. Please attach them again.`}
                </p>
              ) : null}

              {!done ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`kyc-${kind}`} className="sr-only">
                    {CHECK_LABELS[kind]}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id={`kyc-${kind}`}
                      className="min-w-48 flex-1"
                      placeholder={HELP[kind].placeholder}
                      value={values[kind] ?? ""}
                      onChange={(e) => {
                        setValues((v) => ({ ...v, [kind]: e.target.value }));
                        setErrors((x) => ({ ...x, [kind]: "" }));
                      }}
                      aria-invalid={Boolean(errors[kind])}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      /*
                        A number with no document cannot be checked, so the
                        button does not pretend otherwise. Files already on the
                        check count: answering a question about a photograph
                        operations have seen should not mean taking it again.
                      */
                      disabled={
                        pending !== null ||
                        // A number is needed, but one already on the check
                        // counts: a masked Aadhaar cannot be retyped from what
                        // is on screen, and a re-upload should not demand it.
                        (!(values[kind] ?? "").trim() && !check?.reference) ||
                        !hasEvidence(kind)
                      }
                      onClick={() => submit(kind)}
                    >
                      {pending === kind ? (
                        <>
                          <Loader size="xs" />
                          Sending…
                        </>
                      ) : (
                        "Submit"
                      )}
                    </Button>
                  </div>

                  {/*
                    The photograph, next to the number rather than instead of
                    it. The number is what gets checked against a register; the
                    photograph is what an operator looks at when there is no
                    register to check against — which is every manual check on
                    this platform today.

                    `capture` is deliberately absent: on a phone the file picker
                    already offers the camera, and forcing it would stop
                    somebody attaching a certificate they were emailed.
                  */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={(el) => {
                        pickers.current[kind] = el;
                      }}
                      id={`kyc-file-${kind}`}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      className="sr-only"
                      onChange={(e) => {
                        pick(kind, e.target.files);
                        // Cleared so choosing the same file twice still fires.
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={(chosen[kind]?.length ?? 0) >= MAX_DOCUMENTS}
                      onClick={() => pickers.current[kind]?.click()}
                    >
                      <PaperclipIcon className="size-3.5" />
                      Attach photo
                    </Button>
                    <span
                      className={
                        hasEvidence(kind) ? "text-faint text-xs" : "text-warning text-xs"
                      }
                    >
                      {(chosen[kind]?.length ?? 0) > 0
                        ? `${chosen[kind].length} of ${MAX_DOCUMENTS} attached`
                        : hasEvidence(kind)
                          ? "Already sent. Attach another only if it has changed."
                          : "A photo or PDF is required — the number alone cannot be checked."}
                    </span>
                  </div>

                  {(chosen[kind]?.length ?? 0) > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {chosen[kind].map((file, i) => (
                        <li key={file.preview} className="relative">
                          <span className="border-border bg-secondary flex size-20 items-center justify-center overflow-hidden rounded-md border">
                            {file.file.type === "application/pdf" ? (
                              <FileTextIcon className="text-muted-foreground size-6" />
                            ) : (
                              /* A local object URL, not a remote one — next/image
                                 has nothing to optimise here. */
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={file.preview}
                                alt={file.file.name}
                                className="size-full object-cover"
                              />
                            )}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${file.file.name}`}
                            onClick={() => drop(kind, i)}
                            className="bg-background border-border hover:bg-secondary absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {errors[kind] ? (
                    <p className="text-destructive flex items-center gap-1 text-xs">
                      <TriangleAlertIcon className="size-3 shrink-0" />
                      {errors[kind]}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">{HELP[kind].hint}</p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
