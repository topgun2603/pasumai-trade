"use client";

import {
  BadgeCheckIcon,
  ClockIcon,
  FileTextIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CHECK_LABELS,
  KYC_LABELS,
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
    default:
      return <Badge variant="outline">In progress</Badge>;
  }
}

export function KycOnboarding({ view, roleLabel }: { view: OnboardingView; roleLabel: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);

  const byKind = (kind: CheckKind) => view.checks.find((c) => c.kind === kind);

  async function submit(kind: CheckKind) {
    const value = values[kind] ?? "";
    setPending(kind);

    let response: Response;
    try {
      response = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, value }),
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

              {check?.state === "failed" && check.reason ? (
                <p className="text-destructive text-sm">{check.reason}</p>
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
                      disabled={pending !== null || !(values[kind] ?? "").trim()}
                      onClick={() => submit(kind)}
                    >
                      {pending === kind ? "Sending…" : "Submit"}
                    </Button>
                  </div>
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
