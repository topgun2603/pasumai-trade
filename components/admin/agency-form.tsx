"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  ErrorSummary,
  Field,
  fieldProps,
  FormSection,
} from "@/components/admin/form-kit";
import { DocumentUpload, PhotoUpload, type UploadedFile } from "@/components/admin/upload-kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AGENCY_SERVICES,
  AGENCY_SERVICE_LABELS,
  type AgencyService,
} from "@/lib/domain/admin";
import {
  hasErrors,
  validateAgency,
  type AgencyForm,
  type FieldErrors,
} from "@/lib/domain/registration";

interface AgencyAttachments {
  premises: UploadedFile | null;
  gst: UploadedFile | null;
  pan: UploadedFile | null;
  bankProof: UploadedFile | null;
}

const NO_FILES: AgencyAttachments = {
  premises: null,
  gst: null,
  pan: null,
  bankProof: null,
};

const EMPTY: AgencyForm = {
  name: "",
  services: [],
  contactName: "",
  mobile: "",
  email: "",
  addressLine: "",
  town: "",
  district: "",
  pincode: "",
  serviceDistricts: [],
  gstin: "",
  pan: "",
  bankAccountName: "",
  bankAccountNumber: "",
  ifsc: "",
};

/**
 * Registering a supplier company.
 *
 * The email matters more here than on any other form: it becomes the agency's
 * login, and their login is how their workers and vehicles get into the system
 * at all. Operations registers the company once; everything under it is the
 * agency's own data entry from then on.
 */
export function AgencyRegistrationForm({ districts }: { districts: string[] }) {
  const router = useRouter();
  const [values, setValues] = useState<AgencyForm>(EMPTY);
  const [files, setFiles] = useState<AgencyAttachments>(NO_FILES);
  const [errors, setErrors] = useState<FieldErrors<AgencyForm>>({});
  const [fileErrors, setFileErrors] = useState<
    Partial<Record<keyof AgencyAttachments, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof AgencyForm>(key: K, value: AgencyForm[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function setFile(key: keyof AgencyAttachments, file: UploadedFile | null) {
    setFiles((f) => ({ ...f, [key]: file }));
    setFileErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function toggle<K extends "services" | "serviceDistricts">(key: K, item: string) {
    const current = values[key] as string[];
    set(
      key,
      current.includes(item)
        ? (current.filter((x) => x !== item) as AgencyForm[K])
        : ([...current, item] as AgencyForm[K]),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateAgency(values);
    setErrors(found);

    const missing: Partial<Record<keyof AgencyAttachments, string>> = {
      gst: files.gst ? undefined : "GST certificate is required",
      pan: files.pan ? undefined : "PAN card is required",
      bankProof: files.bankProof ? undefined : "Bank proof is required",
    };
    setFileErrors(missing);

    if (hasErrors(found) || Object.values(missing).some(Boolean)) return;

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success(`${values.name} registered`, {
        description:
          "Issue their login with: npm run grant -- agency " + values.email,
      });
      router.push("/admin/transport/agencies");
    }, 500);
  }

  const messages = [
    ...Object.values(errors),
    ...Object.values(fileErrors),
  ].filter(Boolean) as string[];

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-6" noValidate>
      <ErrorSummary errors={messages} />

      <FormSection title="Company">
        <Field label="Agency name" htmlFor="name" required error={errors.name}>
          <Input
            {...fieldProps("name", errors.name)}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Kaveri Labour Services"
          />
        </Field>

        <div className="flex flex-col gap-2">
          <Label className="text-sm">
            Contracted for
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <div className="flex gap-4">
            {AGENCY_SERVICES.map((service) => (
              <span key={service} className="flex items-center gap-2">
                <Checkbox
                  id={`service-${service}`}
                  checked={values.services.includes(service)}
                  onCheckedChange={() => toggle("services", service)}
                />
                <Label htmlFor={`service-${service}`} className="text-sm font-normal">
                  {AGENCY_SERVICE_LABELS[service as AgencyService]}
                </Label>
              </span>
            ))}
          </div>
          {errors.services ? (
            <p className="text-destructive text-xs">{errors.services}</p>
          ) : (
            <p className="text-faint text-xs">
              Decides which sections appear in their console. Both is common.
            </p>
          )}
        </div>

        <Field label="Address" htmlFor="addressLine" required error={errors.addressLine} wide>
          <Input
            {...fieldProps("addressLine", errors.addressLine)}
            value={values.addressLine}
            onChange={(e) => set("addressLine", e.target.value)}
          />
        </Field>

        <Field label="Town" htmlFor="town" required error={errors.town}>
          <Input
            {...fieldProps("town", errors.town)}
            value={values.town}
            onChange={(e) => set("town", e.target.value)}
          />
        </Field>

        <Field label="District" htmlFor="district" required error={errors.district}>
          <Input
            {...fieldProps("district", errors.district)}
            value={values.district}
            onChange={(e) => set("district", e.target.value)}
          />
        </Field>

        <Field label="PIN code" htmlFor="pincode" required error={errors.pincode}>
          <Input
            {...fieldProps("pincode", errors.pincode)}
            value={values.pincode}
            onChange={(e) => set("pincode", e.target.value)}
            inputMode="numeric"
            maxLength={6}
            className="font-mono"
          />
        </Field>

        <PhotoUpload
          id="premises"
          label="Premises"
          value={files.premises}
          onChange={(f) => setFile("premises", f)}
          error={fileErrors.premises}
          hint="Optional, but it is what an operator recognises the agency by"
        />
      </FormSection>

      <FormSection title="Contact and login">
        <Field label="Contact name" htmlFor="contactName" required error={errors.contactName}>
          <Input
            {...fieldProps("contactName", errors.contactName)}
            value={values.contactName}
            onChange={(e) => set("contactName", e.target.value)}
          />
        </Field>

        <Field label="Mobile" htmlFor="mobile" required error={errors.mobile}>
          <Input
            {...fieldProps("mobile", errors.mobile)}
            value={values.mobile}
            onChange={(e) => set("mobile", e.target.value)}
            inputMode="tel"
          />
        </Field>

        <Field
          label="Email"
          htmlFor="email"
          required
          error={errors.email}
          hint="Becomes their sign-in. Their workers and vehicles reach the platform through this account."
          wide
        >
          <Input
            {...fieldProps("email", errors.email)}
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            inputMode="email"
            placeholder="ops@agency.in"
          />
        </Field>
      </FormSection>

      <FormSection title="Coverage">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label className="text-sm">
            Districts served
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <ul className="grid gap-2 sm:grid-cols-3">
            {districts.map((d) => (
              <li key={d} className="flex items-center gap-2">
                <Checkbox
                  id={`district-${d}`}
                  checked={values.serviceDistricts.includes(d)}
                  onCheckedChange={() => toggle("serviceDistricts", d)}
                />
                <Label htmlFor={`district-${d}`} className="text-sm font-normal">
                  {d}
                </Label>
              </li>
            ))}
          </ul>
          {errors.serviceDistricts ? (
            <p className="text-destructive text-xs">{errors.serviceDistricts}</p>
          ) : (
            <p className="text-faint text-xs">
              Where they will actually send crew or vehicles. Their own console
              only offers these when they add a worker.
            </p>
          )}
        </div>
      </FormSection>

      <FormSection title="Compliance">
        <Field label="GSTIN" htmlFor="gstin" required error={errors.gstin}>
          <Input
            {...fieldProps("gstin", errors.gstin)}
            value={values.gstin}
            onChange={(e) => set("gstin", e.target.value.toUpperCase())}
            placeholder="33AAFCK4471K1ZP"
            className="font-mono"
          />
        </Field>

        <Field label="PAN" htmlFor="pan" required error={errors.pan}>
          <Input
            {...fieldProps("pan", errors.pan)}
            value={values.pan}
            onChange={(e) => set("pan", e.target.value.toUpperCase())}
            placeholder="AAFCK4471K"
            className="font-mono"
          />
        </Field>

        <DocumentUpload
          id="gst-file"
          label="GST certificate"
          value={files.gst}
          onChange={(f) => setFile("gst", f)}
          error={fileErrors.gst}
        />

        <DocumentUpload
          id="pan-file"
          label="PAN card"
          value={files.pan}
          onChange={(f) => setFile("pan", f)}
          error={fileErrors.pan}
        />
      </FormSection>

      <FormSection title="Payment">
        <Field
          label="Account holder"
          htmlFor="bankAccountName"
          required
          error={errors.bankAccountName}
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
            className="font-mono"
          />
        </Field>

        <DocumentUpload
          id="bank-file"
          label="Bank proof"
          value={files.bankProof}
          onChange={(f) => setFile("bankProof", f)}
          error={fileErrors.bankProof}
        />
      </FormSection>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Registering…" : "Register agency"}
        </Button>
      </div>
    </form>
  );
}
