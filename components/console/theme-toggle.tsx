"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The theme control every console rail carries.
 *
 * There were two of these, byte for byte, one in the farm rail and one in the
 * agency rail — and a third console had none. Two copies of a control is two
 * places for it to drift; one of them already had no label.
 *
 * The three options stay in English. They are the words the operating system
 * uses for the same setting, and a farmer who has set their phone to dark
 * recognises them.
 */
export function ThemeToggle({
  label,
  compact = false,
}: {
  label: string;
  /**
   * Icon only, for the mobile app bar.
   *
   * Same shape and same prop name as the language switcher's, so the two sit
   * beside each other without one of them being a head taller. The label
   * becomes the accessible name rather than disappearing — a bare icon button
   * with no name is unusable by a screen reader, and this control is a
   * dropdown whose trigger says nothing about itself.
   */
  compact?: boolean;
}) {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={compact ? "ghost" : "outline"}
          size={compact ? "icon" : "sm"}
          aria-label={compact ? label : undefined}
          className={compact ? undefined : "w-full justify-start"}
        >
          <SunIcon className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
          {compact ? null : <span className="ml-6">{label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"}>
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
