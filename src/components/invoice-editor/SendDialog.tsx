"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { ApiErrorBody } from "@/lib/api";
import { sendInvoiceSchema, toFieldErrors } from "@/lib/invoice-schema";
import type { InvoiceRecord } from "@/lib/invoice-types";
import { formatDate } from "@/lib/format";
import { formatCents } from "@/lib/money";
import { Field } from "./Field";

interface SendDialogProps {
  invoice: InvoiceRecord | null;
  onClose: () => void;
  onSent: (invoice: InvoiceRecord, warning?: string) => void;
}

type SendResponse = Partial<ApiErrorBody> & { invoice?: InvoiceRecord; warning?: string };

function defaultMessage(invoice: InvoiceRecord): string {
  const greeting = invoice.customer.name ? `Hi ${invoice.customer.name},` : "Hello,";
  return `${greeting}\n\nHere is invoice ${invoice.invoiceNumber} for ${formatCents(invoice.totals.totalCents)}, due ${formatDate(invoice.dueDate)}.\n\nThank you,\n${invoice.business.name}`;
}

/** Native <dialog>: focus is trapped and Escape closes it without extra code. */
export function SendDialog({ invoice, onClose, onSent }: SendDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState({ to: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (invoice && !dialog.open) {
      setForm({
        to: invoice.customer.email || invoice.lastSentTo,
        subject: `Invoice ${invoice.invoiceNumber} from ${invoice.business.name}`,
        message: defaultMessage(invoice),
      });
      setErrors({});
      dialog.showModal();
    } else if (!invoice && dialog.open) {
      dialog.close();
    }
  }, [invoice]);

  // After a failed send, move focus to the first problem so screen readers announce it.
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    const target =
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      formRef.current?.querySelector<HTMLElement>('[role="alert"]');
    target?.focus();
  }, [errors]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!invoice || sending) return;

    const parsed = sendInvoiceSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }

    setSending(true);
    setErrors({});
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json().catch(() => null)) as SendResponse | null;
      if (!response.ok || !body?.invoice) {
        setErrors({
          ...body?.error?.fieldErrors,
          _form: body?.error?.message ?? "The email couldn't be sent. Try again.",
        });
        return;
      }
      onSent(body.invoice, body.warning);
    } catch {
      setErrors({ _form: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="send-title"
      onClose={() => {
        // Chrome lets a second Escape close a dialog even after cancel was prevented,
        // so reopen it while sending; otherwise a failure would land in a hidden dialog.
        if (sending) {
          dialogRef.current?.showModal();
          return;
        }
        onClose();
      }}
      // Don't let Escape close the dialog while the email is on its way.
      onCancel={(event) => sending && event.preventDefault()}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] overscroll-contain rounded-xl bg-paper p-0 text-ink shadow-2xl"
    >
      <form
        ref={formRef}
        onSubmit={send}
        noValidate
        className="p-6"
        // Ctrl/⌘+Enter sends from anywhere in the dialog, including the message box.
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      >
        <h2 id="send-title" className="font-serif text-xl font-semibold">
          Email invoice
        </h2>
        {invoice && (
          <p className="mt-1 text-sm text-muted">
            Sends {invoice.invoiceNumber} ({formatCents(invoice.totals.totalCents)}) with a PDF copy
            attached, through your SMTP server. Use an address you control while testing.
          </p>
        )}
        {invoice?.sentAt && (
          <p className="mt-3 flex items-center gap-2 rounded-md bg-ledger-tint px-3 py-2 text-sm text-ledger-dark">
            <Icon name="check" />
            Last sent{" "}
            {new Date(invoice.sentAt).toLocaleDateString("en-US", { dateStyle: "medium" })} to{" "}
            {invoice.lastSentTo}
          </p>
        )}

        <div className="mt-5 space-y-4">
          <Field path="to" label="To" error={errors.to}>
            {(control) => (
              <input
                {...control}
                type="email"
                className="field-input"
                value={form.to}
                // The recipient is a customer, so don't offer the user's own address.
                autoComplete="off"
                onChange={(event) => setForm({ ...form, to: event.target.value })}
              />
            )}
          </Field>
          <Field path="subject" label="Subject" error={errors.subject}>
            {(control) => (
              <input
                {...control}
                className="field-input"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
              />
            )}
          </Field>
          <Field path="message" label="Message" error={errors.message}>
            {(control) => (
              <textarea
                {...control}
                rows={6}
                className="field-input resize-y"
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
              />
            )}
          </Field>
        </div>

        {errors._form && (
          <p
            role="alert"
            tabIndex={-1}
            className="mt-4 flex items-start gap-2 rounded-md bg-danger-tint px-3 py-2 text-sm text-danger"
          >
            <Icon name="alert" className="mt-0.5 size-4" />
            {errors._form}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            disabled={sending}
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            title="Send (Ctrl/⌘ + Enter)"
            aria-keyshortcuts="Control+Enter Meta+Enter"
            disabled={sending}
          >
            <Icon name="mail" />
            {sending ? "Sending…" : "Send email"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
