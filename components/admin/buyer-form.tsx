"use client";

import { InfoIcon } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DocumentUpload,
  PhotoUpload,
  type UploadedFile,
} from "@/components/admin/upload-kit";
import {
  hasErrors,
  validateBuyer,
  type BuyerForm,
  type FieldErrors,
} from "@/lib/domain/registration";

interface BuyerAttachments {
  premises: UploadedFile | null;
  gstCertificate: UploadedFile | null;
  panCard: UploadedFile | null;
  fssaiCertificate: UploadedFile | null;
  bankProof: UploadedFile | null;
}

const NO_FILES: BuyerAttachments = {
  premises: null,
  gstCertificate: null,
  panCard: null,
  fssaiCertificate: null,
  bankProof: null,
};

const EMPTY: BuyerForm = {
  businessName: "",
  kind: "independent",
  contactName: "",
  mobile: "",
  email: "",
  addressLine: "",
  town: "",
  district: "",
  pincode: "",
  gstin: "",
  pan: "",
  fssai: "",
  fssaiExpiry: "",
  bankAccountName: "",
  bankAccountNumber: "",
  ifsc: "",
};

// No `districts` prop any more: a buyer sources from anywhere in India, so
// there is nothing to pick from.
export function BuyerRegistrationForm() {
  const router = useRouter();
  const [values, setValues] = useState<BuyerForm>(EMPTY);
  const [files, setFiles] = useState<BuyerAttachments>(NO_FILES);
  const [errors, setErrors] = useState<FieldErrors<BuyerForm>>({});
  const [fileErrors, setFileErrors] = useState<Partial<Record<keyof BuyerAttachments, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  function setFile(key: keyof BuyerAttachments, file: UploadedFile | null) {
    setFiles((f) => ({ ...f, [key]: file }));
    setFileErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function set<K extends keyof BuyerForm>(key: K, value: BuyerForm[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    // Clear the error as soon as the field is touched — leaving it visible
    // while someone is fixing it reads as though the fix did not register.
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateBuyer(values);
    setErrors(found);

    // Documents are what operations actually reviews — an account submitted
    // without them simply sits in the queue until someone chases it.
    const missing: Partial<Record<keyof BuyerAttachments, string>> = {
      gstCertificate: files.gstCertificate ? undefined : "GST certificate is required",
      panCard: files.panCard ? undefined : "PAN card is required",
      fssaiCertificate: files.fssaiCertificate
        ? undefined
        : "FSSAI certificate is required",
      bankProof: files.bankProof
        ? undefined
        : "Cancelled cheque or passbook page is required",
    };
    setFileErrors(missing);

    if (hasErrors(found) || Object.values(missing).some(Boolean)) return;

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success(`${values.businessName} submitted for review`, {
        description:
          "The account cannot place orders until operations approves it.",
      });
      router.push("/admin/buyers");
    }, 500);
  }

  const messages = [
    ...Object.values(errors),
    ...Object.values(fileErrors),
  ].filter(Boolean) as string[];

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-6" noValidate>
      <ErrorSummary errors={messages} />

      <FormSection
        title="Business"
        description="A contracted franchise and an independent bulk buyer have identical capabilities. The type affects commercial terms only."
      >
        <Field
          label="Business name"
          htmlFor="businessName"
          required
          error={errors.businessName}
          wide
        >
          <Input
            {...fieldProps("businessName", errors.businessName)}
            value={values.businessName}
            onChange={(e) => set("businessName", e.target.value)}
            placeholder="Kongu Agri Traders"
          />
        </Field>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label className="text-sm">
            Account type
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <RadioGroup
            value={values.kind}
            onValueChange={(v) => set("kind", v as BuyerForm["kind"])}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="franchise" id="kind-franchise" />
              <Label htmlFor="kind-franchise" className="text-sm font-normal">
                Franchise
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="independent" id="kind-independent" />
              <Label htmlFor="kind-independent" className="text-sm font-normal">
                Independent bulk buyer
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Field
          label="Contact person"
          htmlFor="contactName"
          required
          error={errors.contactName}
        >
          <Input
            {...fieldProps("contactName", errors.contactName)}
            value={values.contactName}
            onChange={(e) => set("contactName", e.target.value)}
            placeholder="V. Senthil"
          />
        </Field>

        <Field
          label="Mobile"
          htmlFor="mobile"
          required
          error={errors.mobile}
          hint="10 digits, used for order notifications"
        >
          <Input
            {...fieldProps("mobile", errors.mobile, "10 digits")}
            value={values.mobile}
            onChange={(e) => set("mobile", e.target.value)}
            inputMode="tel"
            placeholder="98430 11204"
          />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email} wide>
          <Input
            {...fieldProps("email", errors.email)}
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="orders@konguagri.in"
          />
        </Field>
      </FormSection>

      <FormSection title="Address">
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
            placeholder="14, Bagalur Main Road"
          />
        </Field>

        <Field label="Town or city" htmlFor="town" required error={errors.town}>
          <Input
            {...fieldProps("town", errors.town)}
            value={values.town}
            onChange={(e) => set("town", e.target.value)}
            placeholder="Hosur"
          />
        </Field>

        <Field label="District" htmlFor="district" required error={errors.district}>
          <Input
            {...fieldProps("district", errors.district)}
            value={values.district}
            onChange={(e) => set("district", e.target.value)}
            placeholder="Krishnagiri"
          />
        </Field>

        <Field
          label="PIN code"
          htmlFor="pincode"
          required
          error={errors.pincode}
        >
          <Input
            {...fieldProps("pincode", errors.pincode)}
            value={values.pincode}
            onChange={(e) => set("pincode", e.target.value)}
            inputMode="numeric"
            placeholder="635109"
          />
        </Field>

      </FormSection>

      <FormSection
        title="Statutory registration"
        description="A produce buyer is a food business, so an FSSAI licence is required alongside GST."
      >
        <Field label="GSTIN" htmlFor="gstin" required error={errors.gstin}>
          <Input
            {...fieldProps("gstin", errors.gstin)}
            value={values.gstin}
            onChange={(e) => set("gstin", e.target.value.toUpperCase())}
            placeholder="33AAECK4521M1ZP"
            className="font-mono"
          />
        </Field>

        <Field label="PAN" htmlFor="pan" required error={errors.pan}>
          <Input
            {...fieldProps("pan", errors.pan)}
            value={values.pan}
            onChange={(e) => set("pan", e.target.value.toUpperCase())}
            placeholder="AAECK4521M"
            className="font-mono"
          />
        </Field>

        <Field
          label="FSSAI licence"
          htmlFor="fssai"
          required
          error={errors.fssai}
          hint="14 digits"
        >
          <Input
            {...fieldProps("fssai", errors.fssai, "14 digits")}
            value={values.fssai}
            onChange={(e) => set("fssai", e.target.value)}
            inputMode="numeric"
            placeholder="12421064000318"
            className="font-mono"
          />
        </Field>

        <Field
          label="FSSAI expiry"
          htmlFor="fssaiExpiry"
          required
          error={errors.fssaiExpiry}
        >
          <Input
            {...fieldProps("fssaiExpiry", errors.fssaiExpiry)}
            type="date"
            value={values.fssaiExpiry}
            onChange={(e) => set("fssaiExpiry", e.target.value)}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Photographs and documents"
        description="Scans or photographs. Images are resized in the browser before upload — a full-size phone photo would be slow to send and expensive to store."
      >
        <PhotoUpload
          id="premises-photo"
          label="Premises photo"
          hint="Shopfront or godown, used to confirm the business exists at the address"
          value={files.premises}
          onChange={(f) => setFile("premises", f)}
        />

        <DocumentUpload
          id="gst-doc"
          label="GST certificate"
          required
          value={files.gstCertificate}
          onChange={(f) => setFile("gstCertificate", f)}
          error={fileErrors.gstCertificate}
        />

        <DocumentUpload
          id="pan-doc"
          label="PAN card"
          required
          value={files.panCard}
          onChange={(f) => setFile("panCard", f)}
          error={fileErrors.panCard}
        />

        <DocumentUpload
          id="fssai-doc"
          label="FSSAI certificate"
          required
          value={files.fssaiCertificate}
          onChange={(f) => setFile("fssaiCertificate", f)}
          error={fileErrors.fssaiCertificate}
        />

        <DocumentUpload
          id="bank-doc"
          label="Cancelled cheque or passbook"
          hint="Must show the account number and IFSC entered above"
          required
          value={files.bankProof}
          onChange={(f) => setFile("bankProof", f)}
          error={fileErrors.bankProof}
        />
      </FormSection>

      <FormSection
        title="Bank account"
        description="Used for refunds and for settling cancelled orders."
      >
        <div className="border-border bg-secondary text-muted-foreground sm:col-span-2 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="text-foreground font-medium">
              No credit is extended.
            </span>{" "}
            Every order is paid in full when it is placed, so there is no credit
            limit to set and no balance to carry.
          </span>
        </div>

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
            placeholder="HDFC0001234"
            className="font-mono"
          />
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit for review"}
        </Button>
      </div>
    </form>
  );
}
