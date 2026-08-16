"use client";

import { AlertDialog as Primitive } from "radix-ui";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Asking before something irreversible happens.
 *
 * There is exactly one of these because `window.confirm` must never appear in
 * this application. A native confirm is unstyled, unbranded, differently
 * worded on every browser, cannot say *what* is about to be deleted, blocks the
 * whole page thread, and on some mobile browsers offers a "prevent this page
 * from creating more dialogs" checkbox that silently disables it forever.
 *
 * Built on Radix's AlertDialog rather than Dialog. The difference is not
 * cosmetic: an alert dialog announces itself as `role="alertdialog"`, moves
 * focus to the safe action, and does not close on an outside click or a stray
 * Escape — none of which should dismiss a question whose answer deletes
 * something.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  pending = false,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  /** What exactly is about to happen, named. Not "Are you sure?". */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Primitive.Content
          className={cn(
            "bg-popover text-popover-foreground ring-foreground/10 fixed top-1/2 left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl p-5 text-sm ring-1 outline-none duration-100 sm:max-w-md",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          <div className="flex flex-col gap-2">
            <Primitive.Title className="text-base font-medium">{title}</Primitive.Title>
            <Primitive.Description asChild>
              <div className="text-muted-foreground text-sm">{description}</div>
            </Primitive.Description>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Primitive.Cancel asChild>
              <Button variant="outline" disabled={pending}>
                {cancelLabel}
              </Button>
            </Primitive.Cancel>
            {/*
              Not wrapped in Primitive.Action: that closes the dialog on click,
              which would tear the "Deleting…" state off the screen before the
              request finished. The caller closes it when the work is done.
            */}
            <Button
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? "Working…" : confirmLabel}
            </Button>
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

/**
 * The same thing for callers that would rather await an answer than manage
 * state, which is the shape `window.confirm` had and the reason people reach
 * for it.
 *
 *     const ok = await ask({ title: "Delete this?", description: "…" });
 *     if (!ok) return;
 */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description: React.ReactNode;
    confirmLabel?: string;
    resolve?: (ok: boolean) => void;
  }>({ open: false, title: "", description: null });

  function ask(options: {
    title: string;
    description: React.ReactNode;
    confirmLabel?: string;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      setState({ ...options, open: true, resolve });
    });
  }

  function settle(ok: boolean) {
    state.resolve?.(ok);
    setState((s) => ({ ...s, open: false, resolve: undefined }));
  }

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      onConfirm={() => settle(true)}
      // Covers Escape and the cancel button alike, so a dismissed question
      // always resolves rather than leaving the caller awaiting forever.
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    />
  );

  return { ask, dialog };
}
