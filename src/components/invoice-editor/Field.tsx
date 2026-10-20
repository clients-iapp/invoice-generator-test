import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";

/** Stable DOM id for a payload path, e.g. "lineItems.0.quantity" -> "field-lineItems-0-quantity". */
export function fieldId(path: string): string {
  return `field-${path.replace(/\./g, "-")}`;
}

export interface ControlProps {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
  /** Read by the form's blur handler to mark the field as touched. */
  "data-path": string;
}

interface FieldProps {
  path: string;
  label: string;
  /** Extra words for screen readers only, e.g. ", line 2" so repeated labels stay distinct. */
  labelSuffix?: string;
  error?: string;
  hint?: string;
  hideLabel?: boolean;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}

/** Label + control + hint/error, wired together for screen readers. */
export function Field({
  path,
  label,
  labelSuffix,
  error,
  hint,
  hideLabel,
  className,
  children,
}: FieldProps) {
  const id = fieldId(path);
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={hideLabel ? "sr-only" : "mb-1.5 block text-sm font-medium text-ink"}
      >
        {label}
        {labelSuffix && <span className="sr-only">{labelSuffix}</span>}
      </label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": message ? messageId : undefined,
        "data-path": path,
      })}
      {error ? (
        <p
          id={messageId}
          className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-danger"
        >
          <Icon name="alert" className="mt-px size-3.5" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="mt-1.5 text-[13px] leading-snug text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Text input with a leading symbol, used for dollar amounts. */
export function AffixInput({
  prefix,
  suffix,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string }) {
  return (
    <div className="relative">
      {prefix && (
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
          aria-hidden="true"
        >
          {prefix}
        </span>
      )}
      <input
        {...props}
        className={`field-input tabular ${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""} ${props.className ?? ""}`}
      />
      {suffix && (
        <span
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted"
          aria-hidden="true"
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
