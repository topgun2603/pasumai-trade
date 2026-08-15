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
  validateDriver,
  type DriverForm,
  type FieldErrors,
} from "@/lib/domain/registration";

interface DriverAttachments {
  portrait: UploadedFile | null;
  licenceFront: UploadedFile | null;
  licenceBack: UploadedFile | null;
  aadhaar: UploadedFile | null;
}

const NO_FILES: DriverAttachments = {
  portrait: null,
  licenceFront: null,
  licenceBack: null,
  aadhaar: null,
};

/**
 * Commercial licence classes. LMV-NT does not cover a goods vehicle, so the
 * list is restricted to classes that legally may.
 */
const LICENCE_CLASSES = [
  { value: "LMV-TR", label: "LMV-TR — light goods" },
  { value: "HGMV", label: "HGMV — heavy goods" },
  { value: "HTV", label: "HTV — heavy transport" },
  { value: "TRANS", label: "TRANS — transport endorsement" },
];

const EMPTY: DriverForm = {
  name: "",
  mobile: "",
  addressLine: "",
  district: "",
  pincode: "",
  aadhaar: "",
  licenceNumber: "",
  licenceClass: "",
  licenceExpiry: "",
  assignedVehicle: "",
};

export function DriverRegistrationForm({
  districts,
  vehicles,
}: {
  districts: string[];
  vehicles: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<DriverForm>(EMPTY);
  const [files, setFiles] = useState<DriverAttachments>(NO_FILES);
  const [errors, setErrors] = useState<FieldErrors<DriverForm>>({});
  const [fileErrors, setFileErrors] = useState<
    Partial<Record<keyof DriverAttachments, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof DriverForm>(key: K, value: DriverForm[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function setFile(key: keyof DriverAttachments, file: UploadedFile | null) {
    setFiles((f) => ({ ...f, [key]: file }));
    setFileErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateDriver(values);
    setErrors(found);

    const missing: Partial<Record<keyof DriverAttachments, string>> = {
      portrait: files.portrait ? undefined : "A photo of the driver is required",
      // Both sides: the class endorsements and validity are printed on the
      // reverse, and those are what decide whether a load can be carried.
      licenceFront: files.licenceFront ? undefined : "Licence front is required",
      licenceBack: files.licenceBack ? undefined : "Licence reverse is required",
      aadhaar: files.aadhaar ? undefined : "Masked Aadhaar is required",
    };
    setFileErrors(missing);

    if (hasErrors(found) || Object.values(missing).some(Boolean)) return;

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success(`${values.name} registered`, {
        description: "Cannot be dispatched until the licence is verified.",
      });
      router.push("/admin/transport/drivers");
    }, 500);
  }

  const messages = [
    ...Object.values(errors),
    ...Object.values(fileErrors),
  ].filter(Boolean) as string[];

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-6" noValidate>
      <ErrorSummary errors={messages} />

      <FormSection title="Driver">
        <Field label="Full name" htmlFor="name" required error={errors.name}>
          <Input
            {...fieldProps("name", errors.name)}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="S. Mani"
          />
        </Field>

        <Field
          label="Mobile"
          htmlFor="mobile"
          required
          error={errors.mobile}
          hint="Reached through a masked line — never shown to the farmer"
        >
          <Input
            {...fieldProps("mobile", errors.mobile, "Masked line")}
            value={values.mobile}
            onChange={(e) => set("mobile", e.target.value)}
            inputMode="tel"
            placeholder="98404 22190"
          />
        </Field>

        <Field
          label="Address"
          htmlFor="addressLine"
          required
          error={errors.addressLine}
          wide
        >
          <Input
            {...fieldProps("addressLine", errors.addressLine)}
            value={values.addressLine}
            onChange={(e) => set("addressLine", e.target.value)}
            placeholder="22, Kamarajar Street"
          />
        </Field>

        <Field label="District" htmlFor="district" required error={errors.district}>
          <Select value={values.district} onValueChange={(v) => set("district", v)}>
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
            placeholder="635001"
          />
        </Field>

        <Field
          label="Aadhaar"
          htmlFor="aadhaar"
          required
          error={errors.aadhaar}
          hint="12 digits, stored masked"
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
      </FormSection>

      <FormSection
        title="Driving licence"
        description="A lapsed licence is not a paperwork problem — the load it carries is uninsured. Expiry is checked before every dispatch."
      >
        <Field
          label="Licence number"
          htmlFor="licenceNumber"
          required
          error={errors.licenceNumber}
        >
          <Input
            {...fieldProps("licenceNumber", errors.licenceNumber)}
            value={values.licenceNumber}
            onChange={(e) => set("licenceNumber", e.target.value.toUpperCase())}
            placeholder="TN20 20180004471"
            className="font-mono"
          />
        </Field>

        <Field
          label="Class"
          htmlFor="licenceClass"
          required
          error={errors.licenceClass}
        >
          <Select
            value={values.licenceClass}
            onValueChange={(v) => set("licenceClass", v)}
          >
            <SelectTrigger
              id="licenceClass"
              aria-invalid={Boolean(errors.licenceClass)}
            >
              <SelectValue placeholder="Select class">
                {
                  LICENCE_CLASSES.find((c) => c.value === values.licenceClass)
                    ?.label
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LICENCE_CLASSES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Expires"
          htmlFor="licenceExpiry"
          required
          error={errors.licenceExpiry}
        >
          <Input
            {...fieldProps("licenceExpiry", errors.licenceExpiry)}
            type="date"
            value={values.licenceExpiry}
            onChange={(e) => set("licenceExpiry", e.target.value)}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Photographs and documents"
        description="Both sides of the licence are needed — the class endorsements and validity are printed on the reverse, and those decide what may be carried."
      >
        <AadhaarNotice />

        <PhotoUpload
          id="driver-portrait"
          label="Photo of the driver"
          hint="Shown to the farmer at pickup so the right person is handed the produce"
          required
          value={files.portrait}
          onChange={(f) => setFile("portrait", f)}
          error={fileErrors.portrait}
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
          id="licence-front"
          label="Licence — front"
          required
          value={files.licenceFront}
          onChange={(f) => setFile("licenceFront", f)}
          error={fileErrors.licenceFront}
        />

        <DocumentUpload
          id="licence-back"
          label="Licence — reverse"
          required
          value={files.licenceBack}
          onChange={(f) => setFile("licenceBack", f)}
          error={fileErrors.licenceBack}
        />
      </FormSection>

      <FormSection title="Assignment" columns={1}>
        <Field
          label="Assign a vehicle"
          htmlFor="assignedVehicle"
          error={errors.assignedVehicle}
          hint="Can be left unassigned and set later from the fleet"
        >
          <Select
            value={values.assignedVehicle}
            onValueChange={(v) => set("assignedVehicle", v)}
          >
            <SelectTrigger id="assignedVehicle" className="w-full sm:w-80">
              <SelectValue placeholder="Unassigned">
                {values.assignedVehicle}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
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
          {submitting ? "Registering…" : "Register driver"}
        </Button>
      </div>
    </form>
  );
}
