"use client";

import {
  BadgeCheckIcon,
  CheckCircle2Icon,
  LandmarkIcon,
  PlusIcon,
  TrashIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import {
  BANK_VERIFICATION_LABELS,
  MAX_BANK_ACCOUNTS,
  type BankVerificationState,
  type PublicBankAccount,
} from "@/lib/domain/bank-accounts";
import { cn } from "@/lib/utils";

/**
 * The bank accounts on an account, and which one gets paid.
 *
 * Two ideas on one screen, kept visibly apart because collapsing them is how
 * money goes astray:
 *
 *   **Verified** is a fact — a penny drop reached the account and the bank
 *   returned a name that agreed with ours.
 *
 *   **Primary** is a choice — the one a payout uses. It can only be made on a
 *   verified account, which is why the button to choose is simply absent on
 *   the others rather than present and failing.
 *
 * The account number is never held in full on this side. The server sends four
 * digits, which is what somebody needs to recognise their own account and all a
 * screen open on a shared handset should ever show.
 */

const TONE: Record<BankVerificationState, string> = {
  verified: "border-success/40 bg-success-soft text-success",
  pending: "border-border text-muted-foreground",
  mismatch: "border-warning/40 bg-warning-soft text-warning",
  failed: "border-destructive/40 bg-destructive-soft text-destructive",
  unverified: "border-border text-muted-foreground",
};

const STATE_ICON: Record<BankVerificationState, typeof CheckCircle2Icon | null> = {
  verified: CheckCircle2Icon,
  pending: null,
  mismatch: TriangleAlertIcon,
  failed: XCircleIcon,
  unverified: null,
};

/** How often a check still running is asked about, and for how long. */
const POLL_MS = 5000;
const POLL_CEILING_MS = 3 * 60 * 1000;

interface FormValues {
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
}

const BLANK: FormValues = {
  accountName: "",
  bankName: "",
  accountNumber: "",
  ifsc: "",
};

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-destructive flex items-center gap-1 text-xs">
          <TriangleAlertIcon className="size-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * What this account's state means, said in the reader's terms.
 *
 * `mismatch` gets the longest line because it is the one nobody can act on
 * without being told what happened: the account is real, the money would
 * arrive, and the only question is whose name is on it.
 */
function explain(account: PublicBankAccount, pennyDrop: boolean): string {
  switch (account.state) {
    case "verified":
      return "Checked against the bank. The name on the account matched.";
    case "pending":
      return "We have sent a one rupee check to this account. The bank usually answers within a minute.";
    case "mismatch":
      return account.registeredName
        ? `The account is real, but the bank holds it as "${account.registeredName}". Operations will check this against your name — nothing more is needed from you unless they ask.`
        : "The account is real, but the name on it needs checking by operations.";
    case "failed":
      return (
        account.reason ??
        "The bank did not recognise this account. Check the number and the IFSC."
      );
    default:
      return pennyDrop
        ? "Not checked yet. Verifying sends one rupee to the account and reads back the name the bank holds."
        : "Not checked yet. Operations will verify this account by hand.";
  }
}

export function BankAccounts({
  initialAccounts,
  pennyDrop,
}: {
  initialAccounts: PublicBankAccount[];
  /** Whether instant verification is switched on for this deployment. */
  pennyDrop: boolean;
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [adding, setAdding] = useState(initialAccounts.length === 0);
  const [values, setValues] = useState<FormValues>(BLANK);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PublicBankAccount | null>(null);

  const hasPending = accounts.some((account) => account.state === "pending");

  /*
    Polling, for the deployment where the webhook is not wired up yet.

    The webhook is the authority — a validation can settle after the tab is
    closed, and the record has to be right either way. This only stops a person
    who *is* watching from being left on "Checking…" with no way to find out.

    It stops on its own after three minutes. A check still running then is one
    the webhook will land or an operator will chase, and a page left open
    overnight should not sit polling a paid API.
  */
  const startedAt = useRef<number>(0);
  /*
    The list, in a ref, so the interval below does not depend on it.

    Depending on `accounts` directly would tear the timer down and build a new
    one on every poll — and on every unrelated re-render — which quietly resets
    the five seconds each time. A page re-rendering often enough would then
    never poll at all.
  */
  const latest = useRef(accounts);
  useEffect(() => {
    latest.current = accounts;
  }, [accounts]);

  useEffect(() => {
    if (!hasPending) {
      startedAt.current = 0;
      return;
    }
    if (startedAt.current === 0) startedAt.current = Date.now();

    const timer = setInterval(async () => {
      if (Date.now() - startedAt.current > POLL_CEILING_MS) {
        clearInterval(timer);
        return;
      }
      const waiting = latest.current.find(
        (account) => account.state === "pending",
      );
      if (!waiting) return;

      try {
        const response = await fetch(`/api/account/bank/${waiting.id}/verify`);
        if (!response.ok) return;
        const data = (await response.json()) as { accounts?: PublicBankAccount[] };
        if (data.accounts) setAccounts(data.accounts);
      } catch {
        // A poll that fails is not worth telling anybody about. The next one
        // will do, and the webhook is what actually settles the record.
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [hasPending]);

  const set = useCallback(<K extends keyof FormValues>(key: K, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy("add");

    let response: Response;
    try {
      response = await fetch("/api/account/bank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setBusy(null);
      toast.error("Could not reach the server. Check your connection.");
      return;
    }

    const data = (await response.json().catch(() => ({}))) as {
      accounts?: PublicBankAccount[];
      error?: string;
      fields?: Partial<Record<keyof FormValues, string>>;
    };
    setBusy(null);

    if (!response.ok) {
      if (data.fields) setErrors(data.fields);
      toast.error(data.error ?? "Could not add that account.");
      return;
    }

    if (data.accounts) setAccounts(data.accounts);
    setValues(BLANK);
    setAdding(false);
    toast.success("Bank account added. Verify it to be paid into it.");
  }

  async function verify(account: PublicBankAccount) {
    setBusy(account.id);

    let response: Response;
    try {
      response = await fetch(`/api/account/bank/${account.id}/verify`, {
        method: "POST",
      });
    } catch {
      setBusy(null);
      toast.error("Could not reach the server. Check your connection.");
      return;
    }

    const data = (await response.json().catch(() => ({}))) as {
      accounts?: PublicBankAccount[];
      settled?: boolean;
      error?: string;
    };
    setBusy(null);

    // The list comes back even on a failure, because a failed attempt is
    // recorded and the screen should show it rather than the state before.
    if (data.accounts) setAccounts(data.accounts);

    if (!response.ok) {
      toast.error(data.error ?? "Could not start the check.");
      return;
    }
    toast.success(
      data.settled ? "The bank has answered." : "Checking with the bank…",
    );
  }

  async function choose(account: PublicBankAccount) {
    setBusy(account.id);

    let response: Response;
    try {
      response = await fetch(`/api/account/bank/${account.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ primary: true }),
      });
    } catch {
      setBusy(null);
      toast.error("Could not reach the server. Check your connection.");
      return;
    }

    const data = (await response.json().catch(() => ({}))) as {
      accounts?: PublicBankAccount[];
      error?: string;
    };
    setBusy(null);

    if (!response.ok) {
      toast.error(data.error ?? "Could not change where you are paid.");
      return;
    }
    if (data.accounts) setAccounts(data.accounts);
    toast.success("Payments will go to this account.");
  }

  async function remove(account: PublicBankAccount) {
    setBusy(account.id);

    let response: Response;
    try {
      response = await fetch(`/api/account/bank/${account.id}`, {
        method: "DELETE",
      });
    } catch {
      setBusy(null);
      toast.error("Could not reach the server. Check your connection.");
      return;
    }

    const data = (await response.json().catch(() => ({}))) as {
      accounts?: PublicBankAccount[];
      error?: string;
    };
    setBusy(null);
    setRemoving(null);

    if (!response.ok) {
      toast.error(data.error ?? "Could not remove that account.");
      return;
    }
    if (data.accounts) setAccounts(data.accounts);
    toast.success("Bank account removed.");
  }

  const full = accounts.length >= MAX_BANK_ACCOUNTS;
  const anyPrimary = accounts.some((account) => account.primary);

  return (
    <div className="flex flex-col gap-5">
      {/*
        Said once, at the top, where somebody with no verified account will
        read it. A farmer whose payouts are not going anywhere should not have
        to infer that from the absence of a green tick further down.
      */}
      {accounts.length > 0 && !anyPrimary ? (
        <div className="border-warning/40 bg-warning-soft flex items-start gap-3 rounded-lg border px-4 py-3">
          <TriangleAlertIcon className="text-warning mt-0.5 size-4 shrink-0" />
          <p className="text-sm">
            No account is verified yet, so there is nowhere to send a payment.
            Verify one below.
          </p>
        </div>
      ) : null}

      {accounts.length === 0 && !adding ? (
        <EmptyState
          icon={LandmarkIcon}
          title="No bank account on file"
          description="Add the account you want to be paid into. It has to be verified before a payment can be sent to it."
          action={
            <Button onClick={() => setAdding(true)}>
              <PlusIcon className="size-4" />
              Add bank account
            </Button>
          }
        />
      ) : null}

      <ul className="flex flex-col gap-3">
        {accounts.map((account) => {
          const Icon = STATE_ICON[account.state];
          const working = busy === account.id;

          return (
            <li
              key={account.id}
              className={cn(
                "bg-card flex flex-col gap-3 rounded-lg border px-4 py-3.5",
                account.primary && "border-success/40",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    <LandmarkIcon className="text-muted-foreground size-4 shrink-0" />
                    {account.bankName}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {account.accountName}
                  </span>
                  <span className="tabular text-muted-foreground text-sm">
                    •••• {account.tail} · {account.ifsc}
                  </span>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {account.primary ? (
                    <Badge
                      variant="outline"
                      className="border-success/40 bg-success-soft text-success"
                    >
                      <BadgeCheckIcon className="size-3" />
                      Paid into this
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className={cn(TONE[account.state])}>
                    {account.state === "pending" ? (
                      <Loader size="sm" />
                    ) : Icon ? (
                      <Icon className="size-3" />
                    ) : null}
                    {BANK_VERIFICATION_LABELS[account.state]}
                  </Badge>
                </div>
              </div>

              <p className="text-muted-foreground max-w-prose text-sm">
                {explain(account, pennyDrop)}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {/*
                  Only ever offered on a verified account. The rule is enforced
                  on the server, and showing a button that is guaranteed to be
                  refused would be a worse way to teach it.
                */}
                {account.state === "verified" && !account.primary ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={working}
                    onClick={() => choose(account)}
                  >
                    {working ? <Loader size="sm" /> : null}
                    Pay into this account
                  </Button>
                ) : null}

                {pennyDrop && account.canVerify ? (
                  <Button size="sm" disabled={working} onClick={() => verify(account)}>
                    {working ? <Loader size="sm" /> : null}
                    {account.state === "unverified" ? "Verify" : "Try again"}
                  </Button>
                ) : null}

                {/*
                  Said out loud rather than left as a disabled button nobody can
                  explain. Each attempt moves real money, so running out is a
                  thing that happens and needs a reason attached.
                */}
                {pennyDrop &&
                !account.canVerify &&
                account.state !== "verified" &&
                account.state !== "pending" ? (
                  <span className="text-muted-foreground text-xs">
                    {account.attemptsLeft === 0
                      ? "Checked as many times as we can. Operations will look at it."
                      : "Waiting on operations."}
                  </span>
                ) : null}

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground ml-auto"
                  disabled={working}
                  onClick={() => setRemoving(account)}
                >
                  <TrashIcon className="size-4" />
                  Remove
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <form
          onSubmit={add}
          noValidate
          className="bg-card flex flex-col gap-4 rounded-lg border px-4 py-4"
        >
          <span className="font-medium">Add a bank account</span>

          <Field
            id="bank-accountName"
            label="Name on the account"
            error={errors.accountName}
            hint="Exactly as the bank holds it. This is what the check compares against."
          >
            <Input
              id="bank-accountName"
              autoComplete="name"
              value={values.accountName}
              onChange={(e) => set("accountName", e.target.value)}
              aria-invalid={Boolean(errors.accountName)}
            />
          </Field>

          <Field id="bank-bankName" label="Bank" error={errors.bankName}>
            <Input
              id="bank-bankName"
              placeholder="Indian Bank"
              value={values.bankName}
              onChange={(e) => set("bankName", e.target.value)}
              aria-invalid={Boolean(errors.bankName)}
            />
          </Field>

          <Field
            id="bank-accountNumber"
            label="Account number"
            error={errors.accountNumber}
          >
            <Input
              id="bank-accountNumber"
              inputMode="numeric"
              autoComplete="off"
              value={values.accountNumber}
              onChange={(e) => set("accountNumber", e.target.value)}
              aria-invalid={Boolean(errors.accountNumber)}
            />
          </Field>

          <Field
            id="bank-ifsc"
            label="IFSC"
            error={errors.ifsc}
            hint="Eleven characters, printed on your passbook and cheque book."
          >
            <Input
              id="bank-ifsc"
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="IDIB000E501"
              value={values.ifsc}
              onChange={(e) => set("ifsc", e.target.value)}
              aria-invalid={Boolean(errors.ifsc)}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy === "add"}>
              {busy === "add" ? <Loader size="sm" /> : null}
              {busy === "add" ? "Adding…" : "Add account"}
            </Button>
            {accounts.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setErrors({});
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : accounts.length > 0 ? (
        <div>
          <Button variant="outline" disabled={full} onClick={() => setAdding(true)}>
            <PlusIcon className="size-4" />
            Add another account
          </Button>
          {full ? (
            <p className="text-muted-foreground mt-2 text-xs">
              {MAX_BANK_ACCOUNTS} accounts is the most we hold. Remove one you no
              longer use.
            </p>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title="Remove this bank account?"
        description={
          removing ? (
            <>
              {removing.bankName} ending {removing.tail} will be taken off your
              account.
              {removing.primary
                ? " It is the account you are currently paid into — another verified account will take over, and if there is none, payments will have nowhere to go until you verify one."
                : ""}
            </>
          ) : null
        }
        confirmLabel="Remove"
        pending={busy === removing?.id}
        onConfirm={() => removing && remove(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
      />
    </div>
  );
}
