"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { checkMobile, required } from "@/lib/domain/registration";
import type { Dictionary } from "@/lib/i18n";

type Interest = "buyer" | "farmer";

interface Values {
  interest: Interest;
  name: string;
  organisation: string;
  mobile: string;
  district: string;
  message: string;
}

const EMPTY: Values = {
  interest: "buyer",
  name: "",
  organisation: "",
  mobile: "",
  district: "",
  message: "",
};

/**
 * Request an account.
 *
 * Nobody self-registers on this platform. A buyer is onboarded by operations
 * and a farmer by a franchise, both after documents are checked in person — so
 * this is an enquiry that starts a conversation, not a sign-up that creates
 * anything. The copy says so plainly rather than implying instant access.
 *
 * Validation messages come from `lib/domain/registration`, which is still
 * English-only. Translating those is a follow-up: they are shared with the
 * admin console, which staff operate in English.
 */
export function EnquiryForm({ t }: { t: Dictionary }) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const found: Partial<Record<keyof Values, string>> = {
      name: required(values.name, t.apply.yourName),
      mobile: checkMobile(values.mobile),
      district: required(values.district, t.apply.district),
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setValues(EMPTY);
      toast.success(t.apply.successTitle, { description: t.apply.successBody });
    }, 500);
  }

  function fieldError(id: string, message?: string) {
    if (!message) return null;
    return (
      <p id={`${id}-error`} className="text-destructive flex items-center gap-1 text-xs">
        <TriangleAlertIcon className="size-3 shrink-0" />
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t.apply.iWantTo}</legend>
        <RadioGroup
          value={values.interest}
          onValueChange={(v) => set("interest", v as Interest)}
          className="flex flex-wrap gap-x-6 gap-y-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="buyer" id="interest-buyer" />
            <Label htmlFor="interest-buyer" className="text-sm font-normal">
              {t.apply.buyProduce}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="farmer" id="interest-farmer" />
            <Label htmlFor="interest-farmer" className="text-sm font-normal">
              {t.apply.sellProduce}
            </Label>
          </div>
        </RadioGroup>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enq-name" className="text-sm">
            {t.apply.yourName}
          </Label>
          <Input
            id="enq-name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "enq-name-error" : undefined}
          />
          {fieldError("enq-name", errors.name)}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enq-mobile" className="text-sm">
            {t.apply.mobile}
          </Label>
          <Input
            id="enq-mobile"
            inputMode="tel"
            value={values.mobile}
            onChange={(e) => set("mobile", e.target.value)}
            aria-invalid={Boolean(errors.mobile)}
            aria-describedby={errors.mobile ? "enq-mobile-error" : undefined}
            placeholder="98430 11204"
          />
          {fieldError("enq-mobile", errors.mobile)}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enq-org" className="text-sm">
            {t.apply.businessName}
            <span className="text-faint text-xs font-normal">{t.apply.optional}</span>
          </Label>
          <Input
            id="enq-org"
            value={values.organisation}
            onChange={(e) => set("organisation", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enq-district" className="text-sm">
            {t.apply.district}
          </Label>
          <Input
            id="enq-district"
            value={values.district}
            onChange={(e) => set("district", e.target.value)}
            aria-invalid={Boolean(errors.district)}
            aria-describedby={errors.district ? "enq-district-error" : undefined}
          />
          {fieldError("enq-district", errors.district)}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enq-message" className="text-sm">
          {values.interest === "buyer" ? t.apply.whatBuy : t.apply.whatGrow}
          <span className="text-faint text-xs font-normal">{t.apply.optional}</span>
        </Label>
        <Textarea
          id="enq-message"
          rows={3}
          value={values.message}
          onChange={(e) => set("message", e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? t.apply.sending : t.apply.send}
        </Button>
        <p className="text-faint max-w-sm text-xs">{t.apply.note}</p>
      </div>
    </form>
  );
}
