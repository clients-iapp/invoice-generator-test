"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { InvoicePreview } from "@/components/InvoicePreview";
import { StatusBadge } from "@/components/StatusBadge";
import type { ApiErrorBody } from "@/lib/api";
import { addDays, todayIso } from "@/lib/format";
import { type InvoiceInput, invoiceInputSchema, toFieldErrors } from "@/lib/invoice-schema";
import type { InvoiceRecord } from "@/lib/invoice-types";
import {
  type DraftAction,
  draftReducer,
  previewTotals,
  shiftPathsAfterRemoval,
  toDraft,
  toPayload,
} from "./draft";
import { EditorForm } from "./EditorForm";
import { SendDialog } from "./SendDialog";

type Notice = { tone: "success" | "error"; text: string } | null;

type SaveResponse = Partial<ApiErrorBody> & { invoice?: InvoiceRecord };

interface InvoiceEditorProps {
  /** A saved invoice, or the starting values for a new one. */
  initial: InvoiceRecord | InvoiceInput;
  /** New invoices only: payment terms used to set the dates from the browser's own "today". */
  defaultTermsDays?: number;
}

export function InvoiceEditor({ initial, defaultTermsDays }: InvoiceEditorProps) {
  const [draft, dispatch] = useReducer(draftReducer, initial, toDraft);
  const [record, setRecord] = useState<InvoiceRecord | null>("id" in initial ? initial : null);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(toPayload(toDraft(initial))),
  );
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [sendTarget, setSendTarget] = useState<InvoiceRecord | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const payload = useMemo(() => toPayload(draft), [draft]);
  const totals = useMemo(() => previewTotals(payload), [payload]);
  const clientErrors = useMemo(() => {
    const result = invoiceInputSchema.safeParse(payload);
    return result.success ? {} : toFieldErrors(result.error);
  }, [payload]);

  const isDirty = JSON.stringify(payload) !== savedSnapshot;
  const isNew = record === null;

  // A field shows its error once it has been left, or once a save attempt found it invalid;
  // never while someone is typing into a fresh field for the first time.
  const errorFor = useCallback(
    (path: string) => (touched.has(path) ? clientErrors[path] : undefined) ?? serverErrors[path],
    [touched, clientErrors, serverErrors],
  );

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.tone === "success" ? 4000 : 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  // The server picked "today" in its own time zone; switch to the browser's if they differ.
  // Next keeps recently visited pages alive and re-runs their effects when they are shown
  // again, so the ref makes sure this happens once and never overwrites the user's dates.
  const datesChecked = useRef(false);
  useEffect(() => {
    if (datesChecked.current || defaultTermsDays === undefined || record) return;
    datesChecked.current = true;
    const issueDate = todayIso();
    if (issueDate === initial.issueDate) return;
    const dueDate = addDays(issueDate, defaultTermsDays);
    dispatch({ type: "setField", field: "issueDate", value: issueDate });
    dispatch({ type: "setField", field: "dueDate", value: dueDate });
    // Still counts as untouched, so leaving the page doesn't warn about unsaved changes.
    // This has to run after hydration (the browser's clock isn't known during the server
    // render), so it is a deliberate one-time state update in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedSnapshot(JSON.stringify(toPayload({ ...toDraft(initial), issueDate, dueDate })));
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(action: DraftAction) {
    if (action.type === "removeLine" || action.type === "removeCustomField") {
      const list = action.type === "removeLine" ? "lineItems" : "customFields";
      const index = draft[list].findIndex((item) => item.key === action.key);
      setTouched((previous) => shiftPathsAfterRemoval(previous, list, index));
    }
    dispatch(action);
    if (Object.keys(serverErrors).length > 0) setServerErrors({});
  }

  function focusFirstError() {
    setView("edit");
    requestAnimationFrame(() => {
      const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (!invalid) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      invalid.focus({ preventScroll: true });
      invalid.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  async function save(): Promise<InvoiceRecord | null> {
    const parsed = invoiceInputSchema.safeParse(payload);
    if (!parsed.success) {
      const invalidPaths = Object.keys(toFieldErrors(parsed.error));
      setTouched((previous) => new Set([...previous, ...invalidPaths]));
      const count = invalidPaths.length;
      setNotice({
        tone: "error",
        text: `Fix ${count} ${count === 1 ? "field" : "fields"} before saving.`,
      });
      focusFirstError();
      return null;
    }

    // Compare later edits against what was submitted (the server trims text,
    // so its copy can differ by whitespace without being a real change).
    const submitted = JSON.stringify(payload);
    setSaving(true);
    try {
      const response = await fetch(record ? `/api/invoices/${record.id}` : "/api/invoices", {
        method: record ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json().catch(() => null)) as SaveResponse | null;
      if (!response.ok || !body?.invoice) {
        const error = body?.error;
        setServerErrors(error?.fieldErrors ?? {});
        setNotice({
          tone: "error",
          text: error?.message ?? "Couldn't save the invoice. Try again.",
        });
        if (error?.fieldErrors) focusFirstError();
        return null;
      }

      const saved = body.invoice;
      setRecord(saved);
      setSavedSnapshot(submitted);
      setNotice({ tone: "success", text: `Saved ${saved.invoiceNumber}` });
      document.title = `${saved.invoiceNumber} | Folio`;
      if (isNew) {
        // Give the new invoice its own URL so a reload opens it again.
        window.history.replaceState(null, "", `/invoices/${saved.id}`);
      }
      return saved;
    } catch {
      setNotice({
        tone: "error",
        text: "Couldn't reach the server. Check your connection and try again.",
      });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrent() {
    if (!record) return;
    const confirmed = await confirm({
      title: `Delete ${record.invoiceNumber}?`,
      message: "This permanently removes the invoice. It can't be undone.",
      confirmLabel: "Delete invoice",
      tone: "danger",
    });
    if (!confirmed) return;
    const response = await fetch(`/api/invoices/${record.id}`, { method: "DELETE" }).catch(
      () => null,
    );
    if (!response || (!response.ok && response.status !== 404)) {
      setNotice({ tone: "error", text: "Couldn't delete the invoice. Try again." });
      return;
    }
    router.push("/");
  }

  async function openSendDialog() {
    // Emails always use the saved invoice, so save pending edits first.
    const target = isDirty || isNew ? await save() : record;
    if (target) setSendTarget(target);
  }

  // Keyboard shortcuts: Ctrl/⌘+S saves, Ctrl/⌘+Enter opens the email dialog. Ctrl/⌘+P is
  // the browser's own print, which already prints only the invoice.
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    // Dialogs handle their own keys (the email dialog sends on Ctrl/⌘+Enter).
    if (document.querySelector("dialog[open]")) return;
    if (event.key.toLowerCase() === "s") {
      event.preventDefault(); // instead of the browser's "Save page as"
      if (!saving) void save();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!saving) void openSendDialog();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  // The mobile action bar is narrow, so it says "Save"; the desktop header has room for more.
  const saveLabel = saving ? (
    "Saving…"
  ) : (
    <>
      <span className="lg:hidden">Save</span>
      <span className="hidden lg:inline">{isNew ? "Save invoice" : "Save changes"}</span>
    </>
  );
  const statusText = isNew ? "Not saved yet" : isDirty ? "Unsaved changes" : "All changes saved";

  const actions = (
    <>
      <button
        type="button"
        className="btn-secondary"
        title="Print or save as PDF (Ctrl/⌘ + P)"
        aria-keyshortcuts="Control+P Meta+P"
        onClick={() => window.print()}
      >
        <Icon name="print" />
        <span>
          Print<span className="hidden sm:inline"> / PDF</span>
        </span>
      </button>
      <button
        type="button"
        className="btn-secondary"
        title="Email invoice (Ctrl/⌘ + Enter)"
        aria-keyshortcuts="Control+Enter Meta+Enter"
        onClick={openSendDialog}
        disabled={saving}
      >
        <Icon name="mail" />
        Email
      </button>
      <button
        type="submit"
        form="invoice-form"
        className="btn-primary flex-1 lg:flex-none"
        title="Save (Ctrl/⌘ + S)"
        aria-keyshortcuts="Control+S Meta+S"
        disabled={saving}
      >
        <Icon name="check" />
        {saveLabel}
      </button>
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh print:block print:h-auto">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper print:hidden">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <Link
            href="/"
            className="btn-quiet -ml-2"
            onClick={async (event) => {
              // Opening in a new tab doesn't leave this page, so don't ask.
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              if (!isDirty) return;
              event.preventDefault();
              const leave = await confirm({
                title: "Leave without saving?",
                message: "Your latest changes to this invoice haven't been saved.",
                confirmLabel: "Leave without saving",
                cancelLabel: "Keep editing",
                tone: "danger",
              });
              if (leave) router.push("/");
            }}
          >
            <Icon name="back" />
            <span className="hidden sm:inline">Invoices</span>
            <span className="sr-only sm:hidden">Back to invoices</span>
          </Link>
          <h1 className="tabular min-w-0 truncate font-serif text-lg font-semibold">
            {draft.invoiceNumber.trim() || "New invoice"}
          </h1>
          <StatusBadge status={record?.status ?? "draft"} />
          {isDirty && !isNew && <span className="text-xs text-ink md:hidden">Unsaved</span>}
          <p className={`hidden text-sm md:block ${isDirty && !isNew ? "text-ink" : "text-muted"}`}>
            {statusText}
          </p>
          <div className="ml-auto hidden gap-2 lg:flex">{actions}</div>
        </div>

        <div
          className="flex gap-1 border-t border-rule px-4 py-2 lg:hidden"
          role="group"
          aria-label="Show"
        >
          {(["edit", "preview"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`btn flex-1 ${view === option ? "bg-ink text-paper" : "text-muted hover:bg-desk"}`}
            >
              {option === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>
      </header>

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 print:hidden lg:top-[4.5rem] lg:bottom-auto"
      >
        {notice && (
          <p
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-lg ${
              notice.tone === "success" ? "bg-ink text-paper" : "bg-danger text-paper"
            }`}
          >
            <Icon name={notice.tone === "success" ? "check" : "alert"} />
            {notice.text}
          </p>
        )}
      </div>

      <main
        id="main"
        className="flex-1 pb-20 lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:pb-0 print:block print:pb-0"
      >
        <form
          id="invoice-form"
          ref={formRef}
          noValidate
          aria-label="Invoice details"
          className={`${view === "edit" ? "block" : "hidden"} relative border-rule bg-paper lg:block lg:overflow-y-auto lg:border-r print:hidden`}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          onBlur={(event) => {
            // Moving to a button (e.g. "Add line item") shouldn't flag the field yet: the error
            // text would push the button down mid-click and swallow it. Save flags everything.
            if ((event.relatedTarget as HTMLElement | null)?.tagName === "BUTTON") return;
            const path = (event.target as HTMLElement).dataset.path;
            if (path && !touched.has(path)) setTouched((previous) => new Set(previous).add(path));
          }}
        >
          <EditorForm draft={draft} dispatch={update} errorFor={errorFor} totals={totals} />
          {record && (
            <div className="px-4 pb-8 sm:px-6">
              <button
                type="button"
                className="btn px-2 text-danger hover:bg-danger-tint"
                onClick={deleteCurrent}
              >
                Delete invoice
              </button>
            </div>
          )}
        </form>

        <section
          aria-label="Preview"
          // Focusable so keyboard users can scroll the preview column on desktop.
          tabIndex={0}
          className={`${view === "preview" ? "block" : "hidden"} relative px-3 py-6 sm:px-8 lg:block lg:overflow-y-auto lg:py-10 print:block print:p-0`}
        >
          <InvoicePreview invoice={payload} totals={totals} />
          <p className="mt-4 text-center text-xs text-muted print:hidden">
            Live preview. Print / PDF prints only this page.
          </p>
          <p className="mt-1 hidden text-center text-xs text-muted lg:block print:hidden">
            Shortcuts: <kbd className="font-sans">Ctrl/⌘ + S</kbd> save,{" "}
            <kbd className="font-sans">Ctrl/⌘ + Enter</kbd> email,{" "}
            <kbd className="font-sans">Ctrl/⌘ + P</kbd> print
          </p>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-rule bg-paper p-3 lg:hidden print:hidden">
        {actions}
      </div>

      <SendDialog
        invoice={sendTarget}
        onClose={() => setSendTarget(null)}
        onSent={(sent, warning) => {
          setRecord(sent);
          setSendTarget(null);
          setNotice(
            warning
              ? { tone: "error", text: warning }
              : { tone: "success", text: `Emailed ${sent.invoiceNumber} to ${sent.lastSentTo}` },
          );
        }}
      />
      {confirmDialog}
    </div>
  );
}
