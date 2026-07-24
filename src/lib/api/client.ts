import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { ErrorKind, ErrorResponse } from "./types";

/**
 * Typed error thrown by every api call. Components switch on `.kind` to render a
 * specific state (DESIGN §8) — they never string-match `.message`.
 */
export class ApiError extends Error {
  readonly kind: ErrorKind;
  readonly detail?: unknown;

  constructor(res: ErrorResponse) {
    super(res.message);
    this.name = "ApiError";
    this.kind = res.kind;
    this.detail = res.detail;
  }
}

function isErrorResponse(v: unknown): v is ErrorResponse {
  return (
    typeof v === "object" &&
    v !== null &&
    "kind" in v &&
    "message" in v &&
    typeof (v as ErrorResponse).kind === "string"
  );
}

/**
 * The ONLY wrapper around Tauri's invoke (DESIGN §9). Every backend error comes
 * back as a structured ErrorResponse; anything else (a panic, a serialization
 * fault) is normalized to `internal` so callers can rely on always catching an
 * ApiError.
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (raw) {
    if (isErrorResponse(raw)) throw new ApiError(raw);
    throw new ApiError({ kind: "internal", message: String(raw) });
  }
}
