"use client";

import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A card per logical group of fields.
 *
 * Registration forms here are long — a vehicle carries four separate statutory
 * documents — and a single unbroken column of inputs is unreadable. One card
 * per real-world grouping lets someone with a folder of papers work through it
 * a document at a time.
 */
export function FormSection({
  title,
  description,
  children,
  columns = 2,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "grid gap-4",
            columns === 2 ? "sm:grid-cols-2" : "grid-cols-1",
          )}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  wide,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", wide && "sm:col-span-2")}>
      <Label htmlFor={htmlFor} className="text-sm">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : (
          <span className="text-faint text-xs font-normal">optional</span>
        )}
      </Label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="text-destructive flex items-center gap-1 text-xs"
        >
          <TriangleAlertIcon className="size-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-faint text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Props every control needs so errors and hints are announced. */
export function fieldProps(id: string, error?: string, hint?: string) {
  return {
    id,
    "aria-invalid": Boolean(error),
    "aria-describedby": error
      ? `${id}-error`
      : hint
        ? `${id}-hint`
        : undefined,
  };
}

/** Multi-select over a small fixed set — districts, crops. */
export function CheckboxGroup({
  legend,
  options,
  selected,
  onChange,
  error,
  hint,
  id,
}: {
  legend: string;
  options: readonly string[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  error?: string;
  hint?: string;
  id: string;
}) {
  function toggle(option: string, checked: boolean) {
    onChange(
      checked
        ? [...selected, option]
        : selected.filter((value) => value !== option),
    );
  }

  return (
    <fieldset className="sm:col-span-2 flex flex-col gap-2">
      <legend className="text-sm leading-none font-medium">
        {legend}
        <span className="text-destructive" aria-hidden>
          *
        </span>
      </legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
        {options.map((option) => {
          const optionId = `${id}-${option.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <div key={option} className="flex items-center gap-2">
              <Checkbox
                id={optionId}
                checked={selected.includes(option)}
                onCheckedChange={(checked) => toggle(option, checked === true)}
              />
              <Label htmlFor={optionId} className="text-sm font-normal">
                {option}
              </Label>
            </div>
          );
        })}
      </div>
      {error ? (
        <p className="text-destructive flex items-center gap-1 text-xs">
          <TriangleAlertIcon className="size-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-faint text-xs">{hint}</p>
      ) : null}
    </fieldset>
  );
}

/**
 * A summary of everything wrong, shown after a failed submit.
 *
 * Long forms scroll, so the invalid field is frequently off-screen when the
 * submit button is pressed. Naming the failures at the point of action beats
 * leaving someone to hunt for red text.
 */
export function ErrorSummary({ errors }: { errors: readonly string[] }) {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive-soft rounded-lg border px-4 py-3"
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <TriangleAlertIcon className="text-destructive size-4 shrink-0" />
        {errors.length === 1
          ? "One field needs attention"
          : `${errors.length} fields need attention`}
      </p>
      <ul className="text-muted-foreground mt-1.5 list-disc pl-8 text-sm">
        {errors.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
