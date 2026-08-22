"use client";

import { ArrowRightIcon } from "lucide-react";
import { useState } from "react";

import { PhotoUpload, type UploadedFile } from "@/components/admin/upload-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HOME_FOR_ROLE } from "@/lib/auth/claims";
import { adoptToken } from "@/lib/auth/sign-in";
import { INDIAN_STATES, districtsOf } from "@/lib/domain/india";
import { SELF_SIGNUP_ROLES, type SignupRole } from "@/lib/domain/signup";
import { cn } from "@/lib/utils";

/**
 * The second half of registering: who you are, once the handset is proven.
 *
 * Reached only after an OTP has been confirmed, so the mobile number is not
 * asked for — it is shown, because a person who has just typed a code into a
 * box wants to see that the right number arrived, and because a number they
 * could edit here would not be the one they proved.
 *
 * The photograph is optional on purpose. It is the field most likely to fail on
 * a village connection, and refusing to open an account over it would lose the
 * registration entirely — operations can ask for one later, and verification
 * asks for documents regardless.
 */

const ROLE_LABEL: Record<
  SignupRole,
  { label: string; blurb: string; placeLabel: string }
> = {
  farmer: {
    label: "Farmer",
    blurb: "List what you grow, and bargain on your own price.",
    placeLabel: "Village",
  },
  buyer: {
    label: "Buyer",
    blurb: "Buy produce in bulk, direct from the farm.",
    placeLabel: "Town",
  },
  franchise: {
    label: "Franchise",
    blurb: "Buy, onboard farmers and dispatch vehicles.",
    placeLabel: "Town",
  },
  transport: {
    label: "Transport",
    blurb: "Supply vehicles and drivers for collection runs.",
    placeLabel: "Town",
  },
  manpower: {
    label: "Manpower",
    blurb: "Supply loading, grading and weighing crews.",
    placeLabel: "Town",
  },
};

interface Values {
  role: string;
  name: string;
  mobile: string;
  email: string;
  state: string;
  district: string;
  place: string;
  pincode: string;
}

export function ProfileForm({
  mobile,
}: {
  /**
   * The proven handset, or empty.
   *
   * An OTP sign-in arrives with one and it is shown rather than asked for. A
   * Google sign-in proves an email and no handset at all, so the field appears
   * and what they type is recorded as unverified — see the note in
   * `app/api/auth/profile/route.ts`.
   */
  mobile: string;
}) {
  const [values, setValues] = useState<Values>({
    role: "",
    name: "",
    mobile: "",
    email: "",
    state: "",
    district: "",
    place: "",
    pincode: "",
  });
  const [photo, setPhoto] = useState<UploadedFile | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>(
    {},
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  // Same rule as the signup form: a district only means anything under a state,
  // so changing the state drops a selection that no longer belongs.
  function setStateId(stateId: string) {
    setValues((v) => ({ ...v, state: stateId, district: "" }));
    setErrors((e) => ({ ...e, state: undefined, district: undefined }));
  }

  const districts = districtsOf(values.state);
  const door = values.role ? ROLE_LABEL[values.role as SignupRole] : null;

  /** Sends the photograph, if there is one, and returns where it landed. */
  async function sendPhoto(): Promise<{ path: string } | null> {
    if (!photo) return null;

    const signed = await fetch("/api/auth/profile/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: photo.type, bytes: photo.size }),
    });
    if (!signed.ok) {
      const detail = (await signed.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(detail.error ?? "Could not prepare the photograph.");
    }

    const { path, url, contentType } = (await signed.json()) as {
      path: string;
      url: string;
      contentType: string;
    };

    const put = await fetch(url, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: photo.blob,
    });
    if (!put.ok) throw new Error("The photograph did not finish uploading.");

    return { path };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setProblem(null);
    setSubmitting(true);

    try {
      const uploaded = await sendPhoto();

      const response = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, photo: uploaded }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        fields?: Record<string, string>;
        role?: string;
        token?: string;
      };

      if (!response.ok) {
        if (data.fields)
          setErrors(data.fields as Partial<Record<keyof Values, string>>);
        setProblem(data.error ?? "Could not create the account.");
        setSubmitting(false);
        return;
      }

      /*
        The cookie was minted before the role existed, so it still says nothing.
        The endpoint hands back a token carrying the claims it just set, and
        adopting it exchanges for a cookie that finally does.

        A token rather than a refresh of the current user: this page is reached
        by a full document load, so there may be no Firebase user in memory to
        refresh.
      */
      const adopted = data.token ? await adoptToken(data.token) : { ok: false };
      if (!adopted.ok) {
        setProblem("Account created. Sign in to finish.");
        setSubmitting(false);
        return;
      }

      /*
        A full navigation, not a push. The console reads the session on the
        server and a client-side push would render the new console against the
        cache from before there was an account.
      */
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(
        adopted.role && adopted.role in HOME_FOR_ROLE
          ? HOME_FOR_ROLE[adopted.role as keyof typeof HOME_FOR_ROLE]
          : "/",
      );
    } catch (error) {
      setProblem(
        error instanceof Error
          ? error.message
          : "Could not create the account.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">
          What are you registering as?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SELF_SIGNUP_ROLES.map((role) => {
            const chosen = values.role === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => set("role", role)}
                aria-pressed={chosen}
                className={cn(
                  "flex flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors",
                  chosen ? "border-primary bg-accent" : "hover:bg-accent/50",
                )}
              >
                <span className="text-sm font-medium">
                  {ROLE_LABEL[role].label}
                </span>
                <span className="text-muted-foreground text-xs">
                  {ROLE_LABEL[role].blurb}
                </span>
              </button>
            );
          })}
        </div>
        {errors.role ? (
          <p className="text-destructive text-sm">{errors.role}</p>
        ) : null}
      </fieldset>

      <Field
        id="name"
        label={values.role === "farmer" ? "Your name" : "Business name"}
        error={errors.name}
      >
        <Input
          id="name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>

      {/*
        Shown when it is proven, asked for when it is not.

        An OTP sign-in arrives holding the number, so it is displayed rather
        than asked for — a field they could edit would not be the one they
        proved. Google proves an email and no handset, so the field appears and
        what they type is recorded as unverified. Being a field rather than a
        confirmation is itself the honest signal.
      */}
      {mobile ? (
        <div className="flex flex-col gap-1.5">
          <Label>Mobile number</Label>
          <div className="bg-muted text-muted-foreground flex h-9 items-center rounded-md border px-3 text-sm">
            {mobile}
            <span className="text-success ml-auto text-xs font-medium">
              Verified
            </span>
          </div>
        </div>
      ) : (
        <Field id="mobile" label="Mobile number" error={errors.mobile}>
          <Input
            id="mobile"
            inputMode="numeric"
            maxLength={10}
            placeholder="98430 11204"
            value={values.mobile}
            onChange={(e) => set("mobile", e.target.value)}
            aria-invalid={Boolean(errors.mobile)}
          />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="state" label="State" error={errors.state}>
          <Select value={values.state} onValueChange={setStateId}>
            <SelectTrigger id="state">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_STATES.map((state) => (
                <SelectItem key={state.id} value={state.id}>
                  {state.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="district" label="District" error={errors.district}>
          <Select
            value={values.district}
            onValueChange={(v) => set("district", v)}
            disabled={districts.length === 0}
          >
            <SelectTrigger id="district">
              <SelectValue
                placeholder={values.state ? "Choose" : "Pick a state first"}
              />
            </SelectTrigger>
            <SelectContent>
              {districts.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="place"
          label={door?.placeLabel ?? "Village or town"}
          error={errors.place}
        >
          <Input
            id="place"
            value={values.place}
            onChange={(e) => set("place", e.target.value)}
          />
        </Field>
        <Field id="pincode" label="PIN code" error={errors.pincode}>
          <Input
            id="pincode"
            inputMode="numeric"
            maxLength={6}
            placeholder="641001"
            value={values.pincode}
            onChange={(e) => set("pincode", e.target.value)}
          />
        </Field>
      </div>

      <Field id="email" label="Email (optional)" error={errors.email}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          placeholder="you@company.in"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </Field>

      {/* `PhotoUpload` opens the rear camera on a phone rather than a file
          browser, which is the whole reason this is worth asking for here. */}
      <PhotoUpload
        id="profile-photo"
        label="Your photograph (optional)"
        hint="Tap to take one now, or choose a picture."
        value={photo}
        onChange={setPhoto}
      />

      {problem ? (
        <p role="alert" className="text-destructive text-sm">
          {problem}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Creating your account…" : "Create account"}
        {submitting ? null : <ArrowRightIcon className="size-4" />}
      </Button>

      <p className="text-muted-foreground text-xs">
        You can sign in and look around straight away. Trading starts once
        operations has checked your documents.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
