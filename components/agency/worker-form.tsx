"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  RosterSubmitError,
  submitRoster,
} from "@/components/agency/submit-roster";

import {
  ErrorSummary,
  Field,
  fieldProps,
  FormSection,
} from "@/components/admin/form-kit";
import {
  AadhaarNotice,
  DocumentUpload,
  PhotoUpload,
  type UploadedFile,
} from "@/components/admin/upload-kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENGAGEMENT_LABELS,
  MANPOWER_SKILLS,
  MANPOWER_SKILL_LABELS,
  type EngagementBasis,
  type ManpowerSkill,
} from "@/lib/domain/admin";
import {
  hasErrors,
  validateManpower,
  type FieldErrors,
  type ManpowerForm,
} from "@/lib/domain/registration";

/* A type rather than an interface, so it can be handed to `submitRoster`,
   which takes any slot map. */
type ManpowerAttachments = {
  portrait: UploadedFile | null;
  aadhaar: UploadedFile | null;
  bankProof: UploadedFile | null;
};

const NO_FILES: ManpowerAttachments = {
  portrait: null,
  aadhaar: null,
  bankProof: null,
};

const EMPTY: ManpowerForm = {
  name: "",
  mobile: "",
  district: "",
  place: "",
  skills: [],
  basis: "perTrip",
  rate: "",
  aadhaar: "",
  bankAccountName: "",
  bankAccountNumber: "",
  ifsc: "",
};

/**
 * An agency adding one of its own workers.
 *
 * The agency owns this data — it knows who turned up this season, and
 * operations does not. What operations owns is the verification that follows.
 *
 * The same three things every account on this platform needs: who they are,
 * where they work, and how they are paid. Plus the one thing specific to crew:
 * what they can actually do, because a dispatch is assembled by skill and a
 * record with no skills is a record nobody can use.
 */
export function WorkerRegistrationForm({
  districts,
  places,
}: {
  districts: string[];
  places: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<ManpowerForm>(EMPTY);
  const [files, setFiles] = useState<ManpowerAttachments>(NO_FILES);
  const [errors, setErrors] = useState<FieldErrors<ManpowerForm>>({});
  const [fileErrors, setFileErrors] = useState<
    Partial<Record<keyof ManpowerAttachments, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ManpowerForm>(key: K, value: ManpowerForm[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function setFile(key: keyof ManpowerAttachments, file: UploadedFile | null) {
    setFiles((f) => ({ ...f, [key]: file }));
    setFileErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function toggleSkill(skill: ManpowerSkill) {
    set(
      "skills",
      values.skills.includes(skill)
        ? values.skills.filter((s) => s !== skill)
        : [...values.skills, skill],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateManpower(values);
    setErrors(found);

    const missing: Partial<Record<keyof ManpowerAttachments, string>> = {
      portrait: files.portrait
        ? undefined
        : "A photo is required — the farmer meets this person at their gate",
      aadhaar: files.aadhaar ? undefined : "Masked Aadhaar is required",
      // Not optional. Without it there is no way to pay except cash at the
      // roadside, which is the arrangement this platform exists to replace.
      bankProof: files.bankProof
        ? undefined
        : "Bank proof is required — nobody is paid in cash",
    };
    setFileErrors(missing);

    if (hasErrors(found) || Object.values(missing).some(Boolean)) return;

    setSubmitting(true);
    try {
      await submitRoster("workers", { ...values }, files);
      toast.success(`${values.name} registered`, {
        description:
          "Sent to operations for verification. Cannot be assigned to a job until then.",
      });
      router.push("/agency/workers");
      // Left submitting: the push is under way, and re-enabling the button only
      // invites the same person being filed twice.
      router.refresh();
    } catch (error) {
      setSubmitting(false);
      if (error instanceof RosterSubmitError && error.fields)
        setErrors(error.fields);
      toast.error(
        error instanceof Error ? error.message : "Could not save that.",
      );
    }
  }

  const messages = [
    ...Object.values(errors),
    ...Object.values(fileErrors),
  ].filter(Boolean) as string[];

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-6" noValidate>
      <ErrorSummary errors={messages} />

      <FormSection title="Person">
        <Field label="Full name" htmlFor="name" required error={errors.name}>
          <Input
            {...fieldProps("name", errors.name)}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="K. Ravi"
          />
        </Field>

        <Field
          label="Mobile"
          htmlFor="mobile"
          required
          error={errors.mobile}
          hint="How dispatch reaches them on the morning of a run"
        >
          <Input
            {...fieldProps("mobile", errors.mobile)}
            value={values.mobile}
            onChange={(e) => set("mobile", e.target.value)}
            inputMode="tel"
            placeholder="9876543210"
          />
        </Field>

        <Field
          label="District"
          htmlFor="district"
          required
          error={errors.district}
        >
          <Select
            value={values.district}
            onValueChange={(v) => set("district", v)}
          >
            <SelectTrigger {...fieldProps("district", errors.district)}>
              <SelectValue placeholder="Select">{values.district}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Village or town"
          htmlFor="place"
          required
          error={errors.place}
          hint="Dispatch sends the nearest available crew"
        >
          <Select value={values.place} onValueChange={(v) => set("place", v)}>
            <SelectTrigger {...fieldProps("place", errors.place)}>
              <SelectValue placeholder="Select">{values.place}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {places.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <PhotoUpload
          id="portrait"
          label="Photograph"
          value={files.portrait}
          onChange={(f) => setFile("portrait", f)}
          error={fileErrors.portrait}
          hint="Shown to the farmer so the right person is met at the gate"
        />
      </FormSection>

      <FormSection title="Work">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label className="text-sm">
            Skills
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <ul className="grid gap-2 sm:grid-cols-3">
            {MANPOWER_SKILLS.map((skill) => (
              <li key={skill} className="flex items-center gap-2">
                <Checkbox
                  id={`skill-${skill}`}
                  checked={values.skills.includes(skill)}
                  onCheckedChange={() => toggleSkill(skill)}
                />
                <Label
                  htmlFor={`skill-${skill}`}
                  className="text-sm font-normal"
                >
                  {MANPOWER_SKILL_LABELS[skill]}
                </Label>
              </li>
            ))}
          </ul>
          {errors.skills ? (
            <p className="text-destructive text-xs">{errors.skills}</p>
          ) : (
            <p className="text-faint text-xs">
              Grading decides what the farmer is paid, so it is the skill the
              platform is most careful about.
            </p>
          )}
        </div>

        <Field label="Paid" htmlFor="basis" required error={errors.basis}>
          <Select
            value={values.basis}
            onValueChange={(v) => set("basis", v as EngagementBasis)}
          >
            <SelectTrigger {...fieldProps("basis", errors.basis)}>
              <SelectValue>
                {ENGAGEMENT_LABELS[values.basis as EngagementBasis]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ENGAGEMENT_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Rate"
          htmlFor="rate"
          required
          error={errors.rate}
          hint="Agreed here, not at the roadside with a vehicle running"
        >
          <div className="flex items-center gap-2">
            <span className="text-faint">₹</span>
            <Input
              {...fieldProps("rate", errors.rate)}
              value={values.rate}
              onChange={(e) => set("rate", e.target.value)}
              inputMode="decimal"
              placeholder="450"
              className="tabular"
            />
          </div>
        </Field>
      </FormSection>

      <FormSection title="Identity">
        <Field
          label="Aadhaar"
          htmlFor="aadhaar"
          required
          error={errors.aadhaar}
          hint="Last four digits only are retained"
        >
          <Input
            {...fieldProps("aadhaar", errors.aadhaar)}
            value={values.aadhaar}
            onChange={(e) => set("aadhaar", e.target.value)}
            inputMode="numeric"
            placeholder="XXXX XXXX 4487"
          />
        </Field>

        <DocumentUpload
          id="aadhaar-file"
          label="Masked Aadhaar"
          value={files.aadhaar}
          onChange={(f) => setFile("aadhaar", f)}
          error={fileErrors.aadhaar}
        />

        <AadhaarNotice />
      </FormSection>

      <FormSection title="Payment">
        <Field
          label="Account holder"
          htmlFor="bankAccountName"
          required
          error={errors.bankAccountName}
          hint="As printed in the passbook — a mismatch fails the transfer"
        >
          <Input
            {...fieldProps("bankAccountName", errors.bankAccountName)}
            value={values.bankAccountName}
            onChange={(e) => set("bankAccountName", e.target.value)}
          />
        </Field>

        <Field
          label="Account number"
          htmlFor="bankAccountNumber"
          required
          error={errors.bankAccountNumber}
        >
          <Input
            {...fieldProps("bankAccountNumber", errors.bankAccountNumber)}
            value={values.bankAccountNumber}
            onChange={(e) => set("bankAccountNumber", e.target.value)}
            inputMode="numeric"
            className="font-mono"
          />
        </Field>

        <Field label="IFSC" htmlFor="ifsc" required error={errors.ifsc}>
          <Input
            {...fieldProps("ifsc", errors.ifsc)}
            value={values.ifsc}
            onChange={(e) => set("ifsc", e.target.value.toUpperCase())}
            placeholder="KVBL0001234"
            className="font-mono"
          />
        </Field>

        <DocumentUpload
          id="bank-proof"
          label="Bank proof"
          value={files.bankProof}
          onChange={(f) => setFile("bankProof", f)}
          error={fileErrors.bankProof}
          hint="Passbook first page or a cancelled cheque"
        />
      </FormSection>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Registering…" : "Register crew"}
        </Button>
      </div>
    </form>
  );
}
