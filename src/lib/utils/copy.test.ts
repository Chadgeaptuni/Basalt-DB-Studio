import { describe, it, expect, vi } from "vitest";
import { cellToTsv, copyCellsTsv } from "./copy";

describe("cellToTsv", () => {
  it("renders NULL as empty, not the literal", () => {
    expect(cellToTsv({ kind: "null" })).toBe("");
    expect(cellToTsv({ kind: "text", value: "hi" })).toBe("hi");
    expect(cellToTsv({ kind: "int", value: 7 })).toBe("7");
  });
});

describe("copyCellsTsv", () => {
  it("joins rows/cells as TSV and writes to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copyCellsTsv([
      [{ kind: "int", value: 1 }, { kind: "null" }],
      [{ kind: "text", value: "b" }, { kind: "text", value: "c" }],
    ]);
    expect(writeText).toHaveBeenCalledWith("1\t\nb\tc");
    vi.unstubAllGlobals();
  });
});
