import { describe, it, expect } from "vitest";
import { ENVIRONMENTS, envLabel, envTone, isProtected, envConfirmTitle } from "./environment";

describe("environment", () => {
  it("labels every environment it offers", () => {
    for (const env of ENVIRONMENTS) {
      expect(envLabel(env)).toBeTruthy();
      expect(envTone(env)).toBeTruthy();
    }
  });

  it("treats only prod as protected", () => {
    expect(isProtected("prod")).toBe(true);
    expect(isProtected("staging")).toBe(false);
    expect(isProtected("local")).toBe(false);
  });

  // An untagged profile must not get a warning: a caution people see on
  // connections nobody classified is a caution they learn to click through.
  it("treats an untagged profile as unprotected", () => {
    expect(isProtected(undefined)).toBe(false);
    expect(envConfirmTitle("Drop table users?", undefined)).toBe("Drop table users?");
  });

  it("names production in a destructive title", () => {
    expect(envConfirmTitle("Drop table users?", "prod")).toBe("Production: Drop table users?");
  });

  it("leaves non-prod titles alone", () => {
    expect(envConfirmTitle("Commit changes?", "staging")).toBe("Commit changes?");
    expect(envConfirmTitle("Commit changes?", "local")).toBe("Commit changes?");
  });

  it("distinguishes prod from the rest by tone", () => {
    expect(envTone("prod")).toBe("error");
    expect(envTone("prod")).not.toBe(envTone("staging"));
    expect(envTone("staging")).not.toBe(envTone("local"));
  });
});
