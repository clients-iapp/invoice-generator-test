import type { Dispatch, ReactNode } from "react";
import { flushSync } from "react-dom";
import { Icon } from "@/components/Icon";
import { LIMITS } from "@/lib/invoice-schema";
import type { Totals } from "@/lib/invoice-math";
import { formatCents } from "@/lib/money";
import type { Draft, DraftAction } from "./draft";
import { AffixInput, Field, fieldId } from "./Field";

type ErrorFor = (path: string) => string | undefined;

interface EditorFormProps {
  draft: Draft;
  dispatch: Dispatch<DraftAction>;
  errorFor: ErrorFor;
  totals: Totals;
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-b border-rule px-4 py-6 last:border-b-0 sm:px-6"
    >
      <h2 id={id} className="font-serif text-lg font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function EditorForm({ draft, dispatch, errorFor, totals }: EditorFormProps) {
  const setParty =
    (party: "business" | "customer", field: string) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      dispatch({ type: "setParty", party, field, value: event.target.value });

  // Removing a row deletes the focused button; move focus to the row that took its place
  // (or the Add button) instead of letting it fall back to <body>.
  function removeLine(key: string, index: number) {
    flushSync(() => dispatch({ type: "removeLine", key }));
    const next = Math.min(index, draft.lineItems.length - 2);
    document.getElementById(fieldId(`lineItems.${next}.description`))?.focus();
  }

  function removeCustomField(key: string, index: number) {
    flushSync(() => dispatch({ type: "removeCustomField", key }));
    const remaining = draft.customFields.length - 1;
    const target =
      remaining > 0
        ? fieldId(`customFields.${Math.min(index, remaining - 1)}.label`)
        : "add-custom-field";
    document.getElementById(target)?.focus();
  }

  return (
    <>
      <Section id="section-details" title="Invoice details">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            path="invoiceNumber"
            label="Invoice number"
            error={errorFor("invoiceNumber")}
            className="sm:col-span-3"
          >
            {(control) => (
              <input
                {...control}
                className="field-input tabular"
                value={draft.invoiceNumber}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) =>
                  dispatch({ type: "setField", field: "invoiceNumber", value: event.target.value })
                }
              />
            )}
          </Field>
          <Field
            path="issueDate"
            label="Issue date"
            error={errorFor("issueDate")}
            className="sm:col-span-1"
          >
            {(control) => (
              <input
                {...control}
                type="date"
                className="field-input tabular"
                value={draft.issueDate}
                onChange={(event) =>
                  dispatch({ type: "setField", field: "issueDate", value: event.target.value })
                }
              />
            )}
          </Field>
          <Field
            path="dueDate"
            label="Due date"
            error={errorFor("dueDate")}
            className="sm:col-span-1"
          >
            {(control) => (
              <input
                {...control}
                type="date"
                className="field-input tabular"
                value={draft.dueDate}
                min={draft.issueDate || undefined}
                onChange={(event) =>
                  dispatch({ type: "setField", field: "dueDate", value: event.target.value })
                }
              />
            )}
          </Field>
        </div>
      </Section>

      <Section
        id="section-business"
        title="From"
        description="Your business, as it appears at the top of the invoice."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            path="business.name"
            label="Business name"
            error={errorFor("business.name")}
            className="sm:col-span-2"
          >
            {(control) => (
              <input
                {...control}
                className="field-input"
                value={draft.business.name}
                autoComplete="organization"
                onChange={setParty("business", "name")}
              />
            )}
          </Field>
          <Field
            path="business.email"
            label="Email"
            error={errorFor("business.email")}
            hint="Replies to invoice emails go here."
          >
            {(control) => (
              <input
                {...control}
                type="email"
                className="field-input"
                value={draft.business.email}
                autoComplete="email"
                onChange={setParty("business", "email")}
              />
            )}
          </Field>
          <Field path="business.phone" label="Phone" error={errorFor("business.phone")}>
            {(control) => (
              <input
                {...control}
                type="tel"
                className="field-input"
                value={draft.business.phone}
                autoComplete="tel"
                onChange={setParty("business", "phone")}
              />
            )}
          </Field>
          <Field
            path="business.address"
            label="Address"
            error={errorFor("business.address")}
            className="sm:col-span-2"
          >
            {(control) => (
              <textarea
                {...control}
                rows={2}
                className="field-input resize-y"
                value={draft.business.address}
                autoComplete="street-address"
                onChange={setParty("business", "address")}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section id="section-customer" title="Billed to">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field path="customer.name" label="Customer name" error={errorFor("customer.name")}>
            {(control) => (
              <input
                {...control}
                className="field-input"
                value={draft.customer.name}
                autoComplete="off"
                onChange={setParty("customer", "name")}
              />
            )}
          </Field>
          <Field
            path="customer.email"
            label="Email"
            error={errorFor("customer.email")}
            hint="Used as the default recipient."
          >
            {(control) => (
              <input
                {...control}
                type="email"
                className="field-input"
                value={draft.customer.email}
                autoComplete="off"
                onChange={setParty("customer", "email")}
              />
            )}
          </Field>
          <Field
            path="customer.address"
            label="Address"
            error={errorFor("customer.address")}
            className="sm:col-span-2"
          >
            {(control) => (
              <textarea
                {...control}
                rows={2}
                className="field-input resize-y"
                value={draft.customer.address}
                autoComplete="off"
                onChange={setParty("customer", "address")}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section id="section-lines" title="Line items">
        <ol className="space-y-5">
          {draft.lineItems.map((line, index) => {
            const path = `lineItems.${index}`;
            const number = index + 1;
            return (
              <li
                key={line.key}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 border-b border-rule pb-5 last:border-b-0 last:pb-0"
              >
                <span className="tabular pt-[2.375rem] text-sm text-muted" aria-hidden="true">
                  {number}
                </span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[5.5rem_8rem_minmax(0,1fr)]">
                  <div className="col-span-2 flex items-start gap-2 sm:col-span-3">
                    <Field
                      path={`${path}.description`}
                      label="Description"
                      labelSuffix={`, line ${number}`}
                      error={errorFor(`${path}.description`)}
                      className="flex-1"
                    >
                      {(control) => (
                        <input
                          {...control}
                          className="field-input"
                          placeholder="Item or service"
                          value={line.description}
                          onChange={(event) =>
                            dispatch({
                              type: "updateLine",
                              key: line.key,
                              patch: { description: event.target.value },
                            })
                          }
                        />
                      )}
                    </Field>
                    <button
                      type="button"
                      className="btn-quiet mt-[1.875rem] hover:text-danger"
                      aria-label={`Remove line ${number}`}
                      disabled={draft.lineItems.length === 1}
                      title={
                        draft.lineItems.length === 1
                          ? "An invoice needs at least one line"
                          : undefined
                      }
                      onClick={() => removeLine(line.key, index)}
                    >
                      <Icon name="remove" />
                    </button>
                  </div>
                  <Field
                    path={`${path}.quantity`}
                    label="Qty"
                    labelSuffix={`, line ${number}`}
                    error={errorFor(`${path}.quantity`)}
                  >
                    {(control) => (
                      <input
                        {...control}
                        inputMode="decimal"
                        className="field-input tabular"
                        value={line.quantity}
                        onChange={(event) =>
                          dispatch({
                            type: "updateLine",
                            key: line.key,
                            patch: { quantity: event.target.value },
                          })
                        }
                      />
                    )}
                  </Field>
                  <Field
                    path={`${path}.unitPriceCents`}
                    label="Unit price"
                    labelSuffix={`, line ${number}`}
                    error={errorFor(`${path}.unitPriceCents`)}
                  >
                    {(control) => (
                      <AffixInput
                        {...control}
                        prefix="$"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={line.unitPrice}
                        onChange={(event) =>
                          dispatch({
                            type: "updateLine",
                            key: line.key,
                            patch: { unitPrice: event.target.value },
                          })
                        }
                      />
                    )}
                  </Field>
                  <div className="col-span-2 flex items-baseline justify-between text-sm sm:col-span-1 sm:block sm:text-right">
                    <span className="text-muted sm:mb-1.5 sm:block">Amount</span>
                    {/* Plain text, not <output>: its implicit live region would announce every keystroke. */}
                    <span className="tabular font-semibold sm:block sm:py-2">
                      {formatCents(totals.lineTotalsCents[index] ?? 0)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {errorFor("lineItems") && (
          <p className="mt-3 text-[13px] text-danger">{errorFor("lineItems")}</p>
        )}
        <button
          type="button"
          id="add-line-item"
          className="btn-secondary mt-5"
          disabled={draft.lineItems.length >= LIMITS.lineItems}
          onClick={() => {
            // Render the new line now, then move focus to it so keyboard users can keep typing.
            flushSync(() => dispatch({ type: "addLine" }));
            document
              .getElementById(fieldId(`lineItems.${draft.lineItems.length}.description`))
              ?.focus();
          }}
        >
          <Icon name="plus" />
          Add line item
        </button>
      </Section>

      <Section
        id="section-adjustments"
        title="Discount and tax"
        description="The discount comes off the subtotal before tax is added."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            path="discountCents"
            label="Discount"
            error={errorFor("discountCents")}
            hint="A fixed amount in USD."
          >
            {(control) => (
              <AffixInput
                {...control}
                prefix="$"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.discount}
                onChange={(event) =>
                  dispatch({ type: "setField", field: "discount", value: event.target.value })
                }
              />
            )}
          </Field>
          <Field
            path="taxRate"
            label="Tax rate"
            error={errorFor("taxRate")}
            hint="Percentage, up to 3 decimals."
          >
            {(control) => (
              <AffixInput
                {...control}
                suffix="%"
                inputMode="decimal"
                placeholder="0"
                value={draft.taxRate}
                onChange={(event) =>
                  dispatch({ type: "setField", field: "taxRate", value: event.target.value })
                }
              />
            )}
          </Field>
        </div>
        <dl className="tabular mt-5 space-y-1 rounded-md bg-desk/60 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatCents(totals.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Discount</dt>
            <dd>−{formatCents(totals.discountCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Tax</dt>
            <dd>{formatCents(totals.taxCents)}</dd>
          </div>
          <div className="flex justify-between border-t border-rule pt-2 font-semibold">
            <dt>Total</dt>
            <dd>{formatCents(totals.totalCents)}</dd>
          </div>
        </dl>
      </Section>

      <Section
        id="section-custom"
        title="Custom fields"
        description="Extra details like a PO number or project name. Hidden fields stay off the invoice. None of them change the totals."
      >
        {draft.customFields.length > 0 && (
          <ul className="space-y-4">
            {draft.customFields.map((field, index) => {
              const path = `customFields.${index}`;
              const name = field.label.trim() || `custom field ${index + 1}`;
              return (
                <li
                  key={field.key}
                  className={`flex flex-wrap items-start gap-2 rounded-md border p-3 ${field.visible ? "border-rule" : "border-dashed border-field bg-desk/40"}`}
                >
                  <Field
                    path={`${path}.label`}
                    label="Label"
                    labelSuffix={`, custom field ${index + 1}`}
                    error={errorFor(`${path}.label`)}
                    className="min-w-[8rem] flex-1"
                  >
                    {(control) => (
                      <input
                        {...control}
                        className="field-input"
                        placeholder="PO number"
                        value={field.label}
                        onChange={(event) =>
                          dispatch({
                            type: "updateCustomField",
                            key: field.key,
                            patch: { label: event.target.value },
                          })
                        }
                      />
                    )}
                  </Field>
                  <Field
                    path={`${path}.value`}
                    label="Value"
                    labelSuffix={`, custom field ${index + 1}`}
                    error={errorFor(`${path}.value`)}
                    className="min-w-[10rem] flex-[1.4]"
                  >
                    {(control) => (
                      <input
                        {...control}
                        className="field-input"
                        placeholder="PO-1042"
                        value={field.value}
                        onChange={(event) =>
                          dispatch({
                            type: "updateCustomField",
                            key: field.key,
                            patch: { value: event.target.value },
                          })
                        }
                      />
                    )}
                  </Field>
                  <div className="flex gap-1 sm:pt-7">
                    <button
                      type="button"
                      className="btn-quiet"
                      aria-pressed={field.visible}
                      aria-label={`Show ${name} on invoice`}
                      onClick={() =>
                        dispatch({
                          type: "updateCustomField",
                          key: field.key,
                          patch: { visible: !field.visible },
                        })
                      }
                    >
                      <Icon name={field.visible ? "eye" : "eyeOff"} />
                      <span className="w-12 text-left text-xs" aria-hidden="true">
                        {field.visible ? "Shown" : "Hidden"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn-quiet hover:text-danger"
                      aria-label={`Remove ${name}`}
                      onClick={() => removeCustomField(field.key, index)}
                    >
                      <Icon name="remove" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          id="add-custom-field"
          className={`btn-secondary ${draft.customFields.length > 0 ? "mt-4" : ""}`}
          disabled={draft.customFields.length >= LIMITS.customFields}
          onClick={() => {
            flushSync(() => dispatch({ type: "addCustomField" }));
            document
              .getElementById(fieldId(`customFields.${draft.customFields.length}.label`))
              ?.focus();
          }}
        >
          <Icon name="plus" />
          Add custom field
        </button>
      </Section>

      <Section id="section-notes" title="Notes">
        <Field
          path="notes"
          label="Notes for the customer"
          hideLabel
          error={errorFor("notes")}
          hint="Shown at the bottom of the invoice."
        >
          {(control) => (
            <textarea
              {...control}
              rows={3}
              className="field-input resize-y"
              placeholder="Payment terms, bank details or a thank-you note"
              value={draft.notes}
              onChange={(event) =>
                dispatch({ type: "setField", field: "notes", value: event.target.value })
              }
            />
          )}
        </Field>
      </Section>
    </>
  );
}
