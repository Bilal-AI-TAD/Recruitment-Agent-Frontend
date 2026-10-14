import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "TAD Logistics";

export const INTERVIEW_FEATURES_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_INTERVIEW_FEATURES === "true";

/** Turn an API error (FastAPI detail string, validation list or structured error) into readable text. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: { loc?: unknown[]; msg?: string }) => {
        const field = item.loc ? String(item.loc[item.loc.length - 1]) : "";
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    const structured = detail as { error?: { details?: unknown }; message?: unknown };
    const details = structured.error?.details;
    // Structured details (e.g. PERSON_IN_POOL with the pool record and steps) carry their own message.
    const text = typeof details === "string" ? details
      : (details && typeof details === "object" ? (details as { message?: unknown }).message : undefined);
    if (typeof text === "string" && text) return text;
    return typeof structured.message === "string" && structured.message ? structured.message : fallback;
  }
  return (error as Error)?.message || fallback;
}
