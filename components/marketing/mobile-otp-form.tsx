"use client";

import { ArrowRightIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmPhoneCode,
  resetPhoneVerifier,
  startPhoneSignIn,
  type SignInResult,
} from "@/lib/auth/sign-in";
import { checkMobile, toE164 } from "@/lib/domain/registration";

/**
 * A mobile number and the code sent to it.
 *
 * Shared by sign-in and registration because they are the same operation:
 * Firebase creates the user when the number is unknown and returns the existing
 * one when it is not, so what separates "signing in" from "registering" is only
 * whether an account already sits behind the number — which the caller decides
 * from the result, not this form.
 *
 * Two copies of this would drift, and the parts that must not drift are the
 * awkward ones: a verifier that is single-use once a send has been attempted, a
 * reCAPTCHA container that must exist in the document before Firebase will send
 * anything, and a resend that has to throw the old verifier away first.
 */
export function MobileOtpForm({
  containerId,
  onDone,
  labels,
}: {
  /**
   * The element Firebase mounts the invisible reCAPTCHA into.
   *
   * Passed in because two of these on one page would fight over it — a second
   * `RecaptchaVerifier` on the same container throws.
   */
  containerId: string;
  onDone: (result: SignInResult) => void;
  labels: {
    mobile: string;
    code: string;
    send: string;
    sending: string;
    submit: string;
    submitting: string;
  };
}) {
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [confirmer, setConfirmer] =
    useState<Awaited<ReturnType<typeof startPhoneSignIn>>["confirmer"]>(
      undefined,
    );
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();

    const problem = checkMobile(mobile);
    if (problem) {
      setError(problem);
      return;
    }

    // Validated above, so this cannot be null — the branch stays rather than a
    // non-null assertion, because the two checks could drift.
    const e164 = toE164(mobile);
    if (!e164) {
      setError("That is not a valid mobile number.");
      return;
    }

    setBusy(true);
    const result = await startPhoneSignIn(e164, containerId);
    setBusy(false);

    if (!result.ok || !result.confirmer) {
      setError(result.error);
      toast.error(result.error ?? "Could not send a code.");
      return;
    }

    setConfirmer(result.confirmer);
    setError(undefined);
    toast.success(`Code sent to ${mobile}`);
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();

    if (code.trim().length < 6) {
      setError("Enter the six-digit code.");
      return;
    }
    if (!confirmer) return;

    setBusy(true);
    const result = await confirmPhoneCode(confirmer, code.trim());

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      toast.error(result.error ?? "Could not sign in.");
      return;
    }

    // Left busy: the caller navigates, and re-enabling the button only invites
    // a second submission of a code that has already been spent.
    onDone(result);
  }

  return (
    <form
      onSubmit={confirmer ? verify : send}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${containerId}-mobile`}>{labels.mobile}</Label>
        <Input
          id={`${containerId}-mobile`}
          inputMode="numeric"
          autoComplete="tel"
          maxLength={10}
          placeholder="98430 11204"
          value={mobile}
          onChange={(e) => {
            setMobile(e.target.value);
            setError(undefined);
          }}
          // Locked once a code is out: changing it here would verify one number
          // against a code sent to another.
          disabled={Boolean(confirmer)}
          aria-invalid={Boolean(error) && !confirmer}
        />
      </div>

      {confirmer ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${containerId}-code`}>{labels.code}</Label>
          <Input
            id={`${containerId}-code`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(undefined);
            }}
            aria-invalid={Boolean(error)}
          />
          <button
            type="button"
            onClick={() => {
              // The verifier is single-use once a send has been attempted;
              // keeping it makes every retry fail for the wrong reason.
              resetPhoneVerifier();
              setConfirmer(undefined);
              setCode("");
              setError(undefined);
            }}
            className="text-muted-foreground hover:text-foreground self-start text-xs underline-offset-2 hover:underline"
          >
            Use a different number
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-destructive flex items-center gap-1 text-xs">
          <TriangleAlertIcon className="size-3 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={busy} className="mt-1">
        {busy
          ? confirmer
            ? labels.submitting
            : labels.sending
          : confirmer
            ? labels.submit
            : labels.send}
        {!busy ? <ArrowRightIcon className="size-4" /> : null}
      </Button>

      {/* Firebase will not send an SMS without a real element to mount into. */}
      <div id={containerId} />
    </form>
  );
}
