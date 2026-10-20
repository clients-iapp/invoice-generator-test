import type { z } from "zod";
import { toFieldErrors } from "./invoice-schema";

/** Error body shape for every API route: { error: { message, fieldErrors? } }. */
export interface ApiErrorBody {
  error: { message: string; fieldErrors?: Record<string, string> };
}

export function jsonError(
  status: number,
  message: string,
  fieldErrors?: Record<string, string>,
  headers?: HeadersInit,
): Response {
  const body: ApiErrorBody = { error: { message, ...(fieldErrors && { fieldErrors }) } };
  return Response.json(body, { status, headers });
}

export function validationError(error: z.ZodError): Response {
  return jsonError(400, "Some fields need attention.", toFieldErrors(error));
}

export function notFound(): Response {
  return jsonError(404, "We couldn't find that invoice. It may have been deleted.");
}

/** Logs the real error server-side and returns a generic message, never a stack trace. */
export function serverError(error: unknown): Response {
  console.error(error);
  // Mongoose and the MongoDB driver both name these "...ServerSelectionError".
  if (
    error instanceof Error &&
    (error.name.endsWith("ServerSelectionError") || error.name === "DatabaseNotConfiguredError")
  ) {
    return jsonError(503, "Can't reach the database right now. Check that MongoDB is running.");
  }
  return jsonError(500, "Something went wrong on the server. Please try again.");
}

/**
 * Reads a JSON body and validates it. Only `application/json` is accepted: a
 * cross-site HTML form can send text or form bodies but not JSON, so this
 * blocks CSRF-style writes (and emails) triggered from another website.
 */
export async function parseJsonBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<{ data: z.output<Schema> } | { response: Response }> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return {
      response: jsonError(415, "Send the request body as JSON (Content-Type: application/json)."),
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: jsonError(400, "The request body isn't valid JSON.") };
  }

  const parsed = schema.safeParse(body);
  return parsed.success ? { data: parsed.data } : { response: validationError(parsed.error) };
}

export function duplicateNumberError(invoiceNumber: string): Response {
  return jsonError(409, "That invoice number is already used.", {
    invoiceNumber: `${invoiceNumber} is already used by another invoice`,
  });
}
