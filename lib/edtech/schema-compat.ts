import { ApiError } from "@/lib/api/errors";

type MaybeDbError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function isMissingSchemaMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("schema cache") ||
    lower.includes("could not find the table 'public.") ||
    (lower.includes("relation") && lower.includes("does not exist"))
  );
}

export function isMissingOptionalSchemaError(error: unknown): boolean {
  if (!error) return false;

  if (error instanceof ApiError) {
    return isMissingSchemaMessage(error.message);
  }

  if (typeof error === "string") {
    return isMissingSchemaMessage(error);
  }

  if (typeof error === "object") {
    const maybe = error as MaybeDbError;
    if (maybe.code === "PGRST205" || maybe.code === "42P01") {
      return true;
    }
    return isMissingSchemaMessage(maybe.message);
  }

  return false;
}

export function shouldIgnoreOptionalSchemaErrors(errors: Array<unknown>): boolean {
  const present = errors.filter(Boolean);
  return present.length > 0 && present.every((error) => isMissingOptionalSchemaError(error));
}
