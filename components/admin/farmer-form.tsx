"use client";

import { InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  CheckboxGroup,
  ErrorSummary,
  Field,
  fieldProps,
  FormSection,
} from "@/components/admin/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AadhaarNotice,
  DocumentUpload,
  PhotoUpload,
  type UploadedFile,
} from "@/components/admin/upload-kit";
import {
  hasErrors,
  validateFarmer,
  type FarmerForm,
  type FieldErrors,
} from "@/lib/domain/registration";

interface FarmerAttachments {
  portrait: UploadedFile | null;
  farmPhoto: UploadedFile | null;
  aadhaar: UploadedFile | null;
  passbook: UploadedFile | null;
}

const NO_FILES: FarmerAttachments = {
  portrait: null,
  farmPhoto: null,
  aadhaar: null,
  passbook: null,
};

const EMPTY: FarmerForm = {
  name: "",
  mobile: "",
  village: "",
  district: "",
  pincode: "",
  landAcres: "",
  primaryCrops: [],
  aadhaar: "",
  bankAccountName: "",
  bankAccountNumber: "",
  ifsc: "",
  onboardedBy: "",
};

export function FarmerRegistrationForm({
  districts,
  crops,
  accounts,
}: {
  districts: string[];
  crops: string[];
  accounts: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<FarmerForm>({
    ...EMPTY,
    onboardedBy: accounts[0] ?? "",
  });
  const [files, setFiles] = useState<FarmerAttachments>(NO_FILES);
  const [errors, setErrors] = useState<FieldErrors<FarmerForm>>({});
  const [fileErrors, setFileErrors] = useState<
    Partial<Record<keyof FarmerAttachments, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FarmerForm>(key: K, value: FarmerForm[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function setFile(key: keyof FarmerAttachments, file: UploadedFile | null) {
    setFiles((f) => ({ ...f, [key]: file }));
    setFileErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateFarmer(values);
    setErrors(found);

    const missing: Partial<Record<keyof FarmerAttachments, string>> = {
      portrait: files.portrait ? undefined : "A photo of the farmer is required",
      aadhaar: files.aadhaar ? undefined : "Masked Aadhaar is required",
      passbook: files.passbook
        ? undefined
        : "Passbook page is required — it is what the account number is checked against",
    };
    setFileErrors(missing);

    if (hasErrors(found) || Object.values(missing).some(Boolean)) return;

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success(`${values.name} registered`, {
        description: "Pending verification before they can list produce.",
      });
      router.push("/admin/farmers");
    }, 500);
  }

  const messages = [
    ...Object.values(errors),
    ...Object.values(fileErrors),
  ].filter(Boolean) as string[];

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-6" noValidate>
      <ErrorSummary errors={messages} />

      <div className="border-border bg-secondary text-muted-foreground flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          Farmers never register themselves. A franchise fills this in during
          onboarding, and bank details are collected and verified{" "}
          <span className="text-foreground font-medium">offline</span> — they
          are the highest drop-off field in rural sign-up.
        </span>
      </div>

      <FormSection title="Farmer">
        <Field label="Full name" htmlFor="name" required error={errors.name}>
          <Input
            {...fieldProps("name", errors.name)}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="R. Murugan"
          />
        </Field>

        <Field
          label="Mobile"
          htmlFor="mobile"
          required
          error={errors.mobile}
          hint="Their sign-in identity — OTP goes here"
        >
          <Input
            {...fieldProps("mobile", errors.mobile, "OTP goes here")}
            value={values.mobile}
            onChange={(e) => set("mobile", e.target.value)}
            inputMode="tel"
            placeholder="90478 21134"
          />
        </Field>

        <Field label="Village" htmlFor="village" required error={errors.village}>
          <Input
            {...fieldProps("village", errors.village)}
            value={values.village}
            onChange={(e) => set("village", e.target.value)}
            placeholder="Kaveripattinam"
          />
        </Field>

        <Field label="District" htmlFor="district" required error={errors.district}>
          <Select
            value={values.district}
            onValueChange={(v) => set("district", v)}
          >
            {/* `placeholder` handles the empty case — Radix sets
                data-placeholder on the trigger, which the trigger styles
                already account for. */}
            <SelectTrigger id="district" aria-invalid={Boolean(errors.district)}>
              <SelectValue placeholder="Select district">
                {values.district}
              </SelectValue>
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

        <Field label="PIN code" htmlFor="pincode" required error={errors.pincode}>
          <Input
            {...fieldProps("pincode", errors.pincode)}
            value={values.pincode}
            onChange={(e) => set("pincode", e.target.value)}
            inputMode="numeric"
            placeholder="635112"
          />
        </Field>

        <Field
          label="Land under cultivation"
          htmlFor="landAcres"
          required
          error={errors.landAcres}
          hint="In acres. Used to sanity-check listed volumes."
        >
          <Input
            {...fieldProps("landAcres", errors.landAcres, "In acres")}
            value={values.landAcres}
            onChange={(e) => set("landAcres", e.target.value)}
            inputMode="decimal"
            placeholder="4.5"
          />
        </Field>

        <CheckboxGroup
          id="crops"
          legend="Crops grown"
          options={crops}
          selected={values.primaryCrops}
          onChange={(next) => set("primaryCrops", next)}
          error={errors.primaryCrops}
          hint="Puts their usual crops first in the listing picker — most listings become a single tap"
        />
      </FormSection>

      <FormSection title="Identity and photographs">
        <AadhaarNotice />

        <Field
          label="Aadhaar"
          htmlFor="aadhaar"
          required
          error={errors.aadhaar}
          hint="12 digits. Only the last four are retained or displayed."
          wide
        >
          <Input
            {...fieldProps("aadhaar", errors.aadhaar, "12 digits")}
            value={values.aadhaar}
            onChange={(e) => set("aadhaar", e.target.value)}
            inputMode="numeric"
            placeholder="1234 5678 9012"
            className="font-mono"
          />
        </Field>

        <PhotoUpload
          id="farmer-portrait"
          label="Photo of the farmer"
          hint="Taken at onboarding. Shown to the driver at pickup so the right person is met."
          required
          value={files.portrait}
          onChange={(f) => setFile("portrait", f)}
          error={fileErrors.portrait}
        />

        <PhotoUpload
          id="farm-photo"
          label="Photo of the land"
          hint="A sanity check against the acreage entered above"
          value={files.farmPhoto}
          onChange={(f) => setFile("farmPhoto", f)}
        />

        <DocumentUpload
          id="aadhaar-doc"
          label="Masked Aadhaar"
          hint="First eight digits blacked out, or the DigiLocker copy"
          required
          value={files.aadhaar}
          onChange={(f) => setFile("aadhaar", f)}
          error={fileErrors.aadhaar}
        />

        <DocumentUpload
          id="passbook-doc"
          label="Bank passbook page"
          hint="Must show the account number, IFSC and holder name"
          required
          value={files.passbook}
          onChange={(f) => setFile("passbook", f)}
          error={fileErrors.passbook}
        />
      </FormSection>

      <FormSection
        title="Bank account"
        description="Where escrow settles after delivery. Verify the passbook in person — a wrong digit here is the single most expensive data-entry error on the platform."
      >
        <Field
          label="Account holder name"
          htmlFor="bankAccountName"
          required
          error={errors.bankAccountName}
          wide
        >
          <Input
            {...fieldProps("bankAccountName", errors.bankAccountName)}
            value={values.bankAccountName}
            onChange={(e) => set("bankAccountName", e.target.value)}
            placeholder="As printed on the passbook"
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
            placeholder="IOBA0001234"
            className="font-mono"
          />
        </Field>
      </FormSection>

      <FormSection title="Onboarding" columns={1}>
        <Field
          label="Onboarded by"
          htmlFor="onboardedBy"
          required
          error={errors.onboardedBy}
          hint="The account answerable for this record, and who operations calls if something looks wrong"
        >
          <Select
            value={values.onboardedBy}
            onValueChange={(v) => set("onboardedBy", v)}
          >
            <SelectTrigger
              id="onboardedBy"
              aria-invalid={Boolean(errors.onboardedBy)}
              className="w-full sm:w-80"
            >
              <SelectValue placeholder="Select account">
                {values.onboardedBy}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Registering…" : "Register farmer"}
        </Button>
      </div>
    </form>
  );
}
