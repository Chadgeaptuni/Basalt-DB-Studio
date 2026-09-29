import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import ErrorState from "./ErrorState.svelte";
import { presentError } from "$lib/utils/errorPresentation";
import { ERROR_KINDS } from "$lib/api/types";

describe("ErrorState", () => {
  it("renders the kind's title, its next step, and the backend message", () => {
    render(ErrorState, { kind: "configParse", message: "expected `=` at line 3" });

    expect(screen.getByText("Config file is malformed")).toBeInTheDocument();
    expect(screen.getByText(/Fix the TOML by hand/)).toBeInTheDocument();
    expect(screen.getByText("expected `=` at line 3")).toBeInTheDocument();
  });

  // The point of the audit: no kind falls through to a bare heading with no
  // recovery step, whichever pane happens to catch it.
  it("gives every kind a heading and a next step", () => {
    for (const kind of ERROR_KINDS) {
      const { unmount } = render(ErrorState, { kind });
      const { title, hint } = presentError(kind);
      expect(screen.getByText(title), kind).toBeInTheDocument();
      expect(screen.getByText(hint), kind).toBeInTheDocument();
      unmount();
    }
  });

  it("is announced as an alert", () => {
    render(ErrorState, { kind: "internal", message: "boom" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("omits the message block when the caller has none", () => {
    render(ErrorState, { kind: "queryCancelled" });
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });
});
