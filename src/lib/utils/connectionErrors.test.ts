import { describe, expect, it } from "vitest";
import { connectErrorTitle } from "./connectionErrors";
import type { ErrorKind } from "$lib/api/types";

describe("connectErrorTitle", () => {
  it("gives each connect failure kind its own actionable heading", () => {
    const kinds: ErrorKind[] = [
      "connectionRefused",
      "authFailed",
      "tlsError",
      "tunnelError",
      "secretNotFound",
      "keychainUnavailable",
      "vaultLocked",
      "configParse",
    ];
    const titles = kinds.map(connectErrorTitle);

    expect(new Set(titles).size).toBe(kinds.length);
    expect(titles).not.toContain("Connection error");
  });

  it("falls back for kinds a connect attempt cannot produce", () => {
    expect(connectErrorTitle("queryError")).toBe("Connection error");
  });
});
