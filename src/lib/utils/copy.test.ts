import { describe, it, expect, vi } from "vitest";
import { cellToTsv, copyCellsTsv, toDelimited } from "./copy";

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

describe("toDelimited", () => {
  const rows = [
    [{ kind: "int", value: 1 }, { kind: "text", value: 'say "hi", twice' }],
    [{ kind: "int", value: 2 }, { kind: "null" }],
  ] as const;

  it("quotes only the fields that need it, and writes the header first", () => {
    const out = toDelimited(["id", "note"], rows.map((r) => [...r]), {
      delimiter: ",",
      header: true,
      nullText: "",
    });
    expect(out).toBe('id,note\n1,"say ""hi"", twice"\n2,');
  });

  it("spells NULL out when asked", () => {
    const out = toDelimited(["id", "note"], rows.map((r) => [...r]), {
      delimiter: "\t",
      header: false,
      nullText: "NULL",
    });
    expect(out).toBe('1\t"say ""hi"", twice"\n2\tNULL');
  });
});
