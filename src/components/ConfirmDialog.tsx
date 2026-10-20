"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" styles the confirm button red and is used for destructive actions. */
  tone?: "danger" | "default";
}

type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void };

/**
 * An in-app replacement for window.confirm(). `confirm()` returns a promise that
 * resolves to true or false; render `dialog` once in the component.
 */
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const finish = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  return { confirm, dialog: <ConfirmDialog pending={pending} onFinish={finish} /> };
}

function ConfirmDialog({
  pending,
  onFinish,
}: {
  pending: PendingConfirm | null;
  onFinish: (confirmed: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) {
      dialog.showModal();
      // Start on the safe choice so Enter never confirms a destructive action by accident.
      cancelRef.current?.focus();
    } else if (!pending && dialog.open) {
      dialog.close();
    }
  }, [pending]);

  const danger = pending?.tone === "danger";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      // Escape or a backdrop-less close counts as "cancel".
      onClose={() => pending && onFinish(false)}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl bg-paper p-0 text-ink shadow-2xl"
    >
      {pending && (
        <div className="p-6">
          <div className="flex gap-4">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                danger ? "bg-danger-tint text-danger" : "bg-ledger-tint text-ledger"
              }`}
              aria-hidden="true"
            >
              <Icon name="alert" className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id="confirm-title" className="font-serif text-lg font-semibold">
                {pending.title}
              </h2>
              <p id="confirm-message" className="mt-1 text-sm leading-relaxed text-muted">
                {pending.message}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              ref={cancelRef}
              type="button"
              className="btn-secondary"
              onClick={() => onFinish(false)}
            >
              {pending.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              className={danger ? "btn bg-danger text-paper hover:bg-danger/90" : "btn-primary"}
              onClick={() => onFinish(true)}
            >
              {pending.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
