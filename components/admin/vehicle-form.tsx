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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DocumentUpload,
  PhotoUpload,
  type UploadedFile,
} from "@/components/admin/upload-kit";
import { VEHICLE_TYPE_LABELS, type VehicleType } from "@/lib/domain/admin";
import {
  hasErrors,
  validateVehicle,
  type FieldErrors,
  type VehicleForm,
} from "@/lib/domain/registration";

const TYPES = Object.entries(VEHICLE_TYPE_LABELS) as [VehicleType, string][];

interface VehicleAttachments {
  vehiclePhoto: UploadedFile | null;
  numberPlate: UploadedFile | null;
  rc: UploadedFile | null;
  insurance: UploadedFile | null;
  fitness: UploadedFile | null;
  permit: UploadedFile | null;
}

const NO_FILES: VehicleAttachments = {
  vehiclePhoto: null,
  numberPlate: null,
  rc: null,
  insurance: null,
  fitness: null,
  permit: null,
};

const EMPTY: VehicleForm = {
  registration: "",
  type: "",
  capacityKg: "",
  refrigerated: false,
  owner: "",
  district: "",
  rcNumber: "",
  insurer: "",
  insurancePolicy: "",
  insuranceExpiry: "",
  fitnessNumber: "",
  fitnessExpiry: "",
  permitNumber: "",
  permitExpiry: "",
  assignedDriver: "",
};

export function VehicleRegistrationForm({
  districts,
  owners,
  drivers,
}: {
  districts: string[];
  owners: string[];
  drivers: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<VehicleForm>(EMPTY);
  const [files, setFiles] = useState<VehicleAttachments>(NO_FILES);
  const [errors, setErrors] = useState<FieldErrors<VehicleForm>>({});
  const [fileErrors, setFileErrors] = useState<
    Partial<Record<keyof VehicleAttachments, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function setFile(key: keyof VehicleAttachments, file: UploadedFile | null) {
    setFiles((f) => ({ ...f, [key]: file }));
    setFileErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateVehicle(values);
    setErrors(found);

    const missing: Partial<Record<keyof VehicleAttachments, string>> = {
      vehiclePhoto: files.vehiclePhoto ? undefined : "A photo of the vehicle is required",
      numberPlate: files.numberPlate
        ? undefined
        : "A photo of the number plate is required",
      rc: files.rc ? undefined : "RC copy is required",
      insurance: files.insurance ? undefined : "Insurance certificate is required",
      fitness: files.fitness ? undefined : "Fitness certificate is required",
      permit: files.permit ? undefined : "Permit is required",
    };
    setFileErrors(missing);

    if (hasErrors(found) || Object.values(missing).some(Boolean)) return;

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success(`${values.registration.toUpperCase()} registered`, {
        description: "Cannot be dispatched until documents are verified.",
      });
      router.push("/admin/transport/vehicles");
    }, 500);
  }

  const messages = [
    ...Object.values(errors),
    ...Object.values(fileErrors),
  ].filter(Boolean) as string[];

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-6" noValidate>
      <ErrorSummary errors={messages} />

      <FormSection title="Vehicle">
        <Field
          label="Registration number"
          htmlFor="registration"
          required
          error={errors.registration}
        >
          <Input
            {...fieldProps("registration", errors.registration)}
            value={values.registration}
            onChange={(e) => set("registration", e.target.value.toUpperCase())}
            placeholder="TN 20 BA 4471"
            className="font-mono"
          />
        </Field>

        <Field label="Type" htmlFor="type" required error={errors.type}>
          <Select value={values.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger id="type" aria-invalid={Boolean(errors.type)}>
              <SelectValue placeholder="Select type">
                {VEHICLE_TYPE_LABELS[values.type as VehicleType]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TYPES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Capacity"
          htmlFor="capacityKg"
          required
          error={errors.capacityKg}
          hint="In kilograms, as per the RC"
        >
          <Input
            {...fieldProps("capacityKg", errors.capacityKg, "In kilograms")}
            value={values.capacityKg}
            onChange={(e) => set("capacityKg", e.target.value)}
            inputMode="numeric"
            placeholder="1500"
          />
        </Field>

        <Field
          label="Operating district"
          htmlFor="district"
          required
          error={errors.district}
        >
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

        <div className="border-border sm:col-span-2 flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
          <div className="flex flex-col">
            <Label htmlFor="refrigerated" className="text-sm">
              Refrigerated
            </Label>
            <span className="text-faint text-xs">
              Only reefers may carry stock with under 24 hours of shelf life
            </span>
          </div>
          <Switch
            id="refrigerated"
            checked={values.refrigerated}
            onCheckedChange={(checked) => set("refrigerated", checked)}
          />
        </div>
      </FormSection>

      <FormSection title="Ownership">
        <Field label="Owner" htmlFor="owner" required error={errors.owner} wide>
          <Select value={values.owner} onValueChange={(v) => set("owner", v)}>
            <SelectTrigger id="owner" aria-invalid={Boolean(errors.owner)}>
              <SelectValue placeholder="Select owning account or driver">
                {values.owner}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {owners.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Assign a driver"
          htmlFor="assignedDriver"
          error={errors.assignedDriver}
          hint="Can be left unassigned and set later"
          wide
        >
          <Select
            value={values.assignedDriver}
            onValueChange={(v) => set("assignedDriver", v)}
          >
            <SelectTrigger id="assignedDriver">
              <SelectValue placeholder="Unassigned">
                {values.assignedDriver}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {drivers.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormSection>

      <FormSection
        title="Registration certificate"
        description="The RC does not expire, so only the number is captured."
      >
        <Field label="RC number" htmlFor="rcNumber" required error={errors.rcNumber} wide>
          <Input
            {...fieldProps("rcNumber", errors.rcNumber)}
            value={values.rcNumber}
            onChange={(e) => set("rcNumber", e.target.value.toUpperCase())}
            placeholder="TN20BA4471"
            className="font-mono"
          />
        </Field>
      </FormSection>

      <FormSection
        title="Insurance"
        description="Checked before every dispatch. A lapsed policy takes the vehicle off the road immediately."
      >
        <Field label="Insurer" htmlFor="insurer" required error={errors.insurer}>
          <Input
            {...fieldProps("insurer", errors.insurer)}
            value={values.insurer}
            onChange={(e) => set("insurer", e.target.value)}
            placeholder="Oriental Insurance"
          />
        </Field>

        <Field
          label="Policy number"
          htmlFor="insurancePolicy"
          required
          error={errors.insurancePolicy}
        >
          <Input
            {...fieldProps("insurancePolicy", errors.insurancePolicy)}
            value={values.insurancePolicy}
            onChange={(e) => set("insurancePolicy", e.target.value)}
            placeholder="OIC/2025/884210"
            className="font-mono"
          />
        </Field>

        <Field
          label="Expires"
          htmlFor="insuranceExpiry"
          required
          error={errors.insuranceExpiry}
        >
          <Input
            {...fieldProps("insuranceExpiry", errors.insuranceExpiry)}
            type="date"
            value={values.insuranceExpiry}
            onChange={(e) => set("insuranceExpiry", e.target.value)}
          />
        </Field>
      </FormSection>

      <FormSection title="Fitness and permit">
        <Field
          label="Fitness certificate"
          htmlFor="fitnessNumber"
          required
          error={errors.fitnessNumber}
        >
          <Input
            {...fieldProps("fitnessNumber", errors.fitnessNumber)}
            value={values.fitnessNumber}
            onChange={(e) => set("fitnessNumber", e.target.value.toUpperCase())}
            placeholder="FC-TN20-88421"
            className="font-mono"
          />
        </Field>

        <Field
          label="Fitness expires"
          htmlFor="fitnessExpiry"
          required
          error={errors.fitnessExpiry}
        >
          <Input
            {...fieldProps("fitnessExpiry", errors.fitnessExpiry)}
            type="date"
            value={values.fitnessExpiry}
            onChange={(e) => set("fitnessExpiry", e.target.value)}
          />
        </Field>

        <Field
          label="Permit number"
          htmlFor="permitNumber"
          required
          error={errors.permitNumber}
        >
          <Input
            {...fieldProps("permitNumber", errors.permitNumber)}
            value={values.permitNumber}
            onChange={(e) => set("permitNumber", e.target.value.toUpperCase())}
            placeholder="NP-TN20-11204"
            className="font-mono"
          />
        </Field>

        <Field
          label="Permit expires"
          htmlFor="permitExpiry"
          required
          error={errors.permitExpiry}
        >
          <Input
            {...fieldProps("permitExpiry", errors.permitExpiry)}
            type="date"
            value={values.permitExpiry}
            onChange={(e) => set("permitExpiry", e.target.value)}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Photographs and documents"
        description="One attachment per certificate, so a renewal replaces a single file rather than a combined scan."
      >
        <PhotoUpload
          id="vehicle-photo"
          label="Photo of the vehicle"
          hint="Side view showing the body and load bed"
          required
          value={files.vehiclePhoto}
          onChange={(f) => setFile("vehiclePhoto", f)}
          error={fileErrors.vehiclePhoto}
        />

        <PhotoUpload
          id="plate-photo"
          label="Number plate"
          hint="Checked against the registration entered above"
          required
          value={files.numberPlate}
          onChange={(f) => setFile("numberPlate", f)}
          error={fileErrors.numberPlate}
        />

        <DocumentUpload
          id="rc-doc"
          label="RC copy"
          required
          value={files.rc}
          onChange={(f) => setFile("rc", f)}
          error={fileErrors.rc}
        />

        <DocumentUpload
          id="insurance-doc"
          label="Insurance certificate"
          required
          value={files.insurance}
          onChange={(f) => setFile("insurance", f)}
          error={fileErrors.insurance}
        />

        <DocumentUpload
          id="fitness-doc"
          label="Fitness certificate"
          required
          value={files.fitness}
          onChange={(f) => setFile("fitness", f)}
          error={fileErrors.fitness}
        />

        <DocumentUpload
          id="permit-doc"
          label="Permit"
          required
          value={files.permit}
          onChange={(f) => setFile("permit", f)}
          error={fileErrors.permit}
        />
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Registering…" : "Register vehicle"}
        </Button>
      </div>
    </form>
  );
}
