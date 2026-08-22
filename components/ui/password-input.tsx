"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A password field you can look at.
 *
 * Typing a passphrase blind on a phone keyboard is how people end up choosing
 * short ones. The platform asks for twelve characters and suggests three words;
 * that is only reasonable if the person can check what they typed before
 * committing to it.
 *
 * ## Details that matter
 *
 * `type="button"` — inside a form, a button without it submits, so revealing a
 * password would post the form on the first tap.
 *
 * The toggle starts hidden and never persists. Revealed state that survives a
 * navigation is a password left on screen in a shared house or an internet
 * café, which is exactly where a lot of this will be used.
 *
 * `autoComplete` is forwarded rather than fixed, because sign-in wants
 * `current-password` and registration wants `new-password` — a manager offering
 * to fill an existing password into a new-account form is a real annoyance, and
 * the distinction is the only thing that prevents it.
 *
 * The eye sits inside the field rather than beside it, so the control cannot be
 * mistaken for something that acts on the form, and it is `size-9` so a thumb
 * can hit it.
 */
export function PasswordInput({
  className,
  showLabel = "Show password",
  hideLabel = "Hide password",
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & {
  showLabel?: string;
  hideLabel?: string;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={shown ? "text" : "password"}
        // Room for the button, so a long passphrase does not run under it.
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setShown((was) => !was)}
        aria-label={shown ? hideLabel : showLabel}
        aria-pressed={shown}
        /*
          Not in the tab order. Somebody tabbing from the password field expects
          the next control to be Sign in, and a reveal toggle in between is a
          trap for anybody who navigates by keyboard. It stays reachable by
          pointer, and a screen reader reaches it through the form's controls.
        */
        tabIndex={-1}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {shown ? (
          <EyeOffIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </button>
    </div>
  );
}
