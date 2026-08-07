import { describe, expect, it } from "vitest";
import { parseDiff } from "./diff";

const DIFF = `diff --git a/queries/a.sql b/queries/a.sql
index 83db48f..bf269f4 100644
--- a/queries/a.sql
+++ b/queries/a.sql
@@ -1,3 +1,4 @@
 select 1;
-select 2;
+select 3;
+select 4;
 select 5;
`;

describe("parseDiff", () => {
  it("numbers the old and new files independently", () => {
    const { lines } = parseDiff(DIFF);
    const body = lines.filter((l) => l.kind !== "meta");

    expect(body.map((l) => [l.kind, l.oldLine, l.newLine])).toEqual([
      ["context", 1, 1],
      ["remove", 2, null],
      ["add", null, 2],
      ["add", null, 3],
      // The trailing context line is line 3 of the old file and 4 of the new —
      // the case a single gutter has to lie about.
      ["context", 3, 4],
    ]);
  });

  it("counts what changed", () => {
    expect(parseDiff(DIFF).stat).toEqual({ added: 2, removed: 1 });
  });

  // `diff --git`, the index line and the ---/+++ pair say nothing the viewer's
  // own header doesn't, and rendering them puts four lines of noise above every
  // diff in the app.
  it("drops git's file header", () => {
    const { lines } = parseDiff(DIFF);
    expect(lines.some((l) => l.text.startsWith("diff --git"))).toBe(false);
    expect(lines.some((l) => l.text.startsWith("index "))).toBe(false);
    // The hunk header stays: it is the only marker of a jump in the file.
    expect(lines[0]).toMatchObject({ kind: "meta", text: "@@ -1,3 +1,4 @@" });
  });

  it("reports a binary file rather than rendering nothing", () => {
    const parsed = parseDiff(
      "diff --git a/x.png b/x.png\nBinary files a/x.png and b/x.png differ\n",
    );
    expect(parsed.binary).toBe(true);
    expect(parsed.empty).toBe(true);
  });

  it("reports an unchanged file as empty without claiming it is binary", () => {
    const parsed = parseDiff("");
    expect(parsed.empty).toBe(true);
    expect(parsed.binary).toBe(false);
  });

  // A line beginning with `-` or `+` *inside* the content still has to be read as
  // one column of marker plus content, never as a marker of its own.
  it("keeps a content line that starts with a marker character", () => {
    const { lines } = parseDiff("@@ -1 +1 @@\n+-- a sql comment\n");
    const added = lines.find((l) => l.kind === "add");
    expect(added?.text).toBe("-- a sql comment");
  });

  // "\\ No newline at end of file" annotates the line above; treating it as a
  // content line would shift every number after it.
  it("does not number git's no-newline note", () => {
    const { lines } = parseDiff("@@ -1 +1 @@\n-a\n\\ No newline at end of file\n+b\n");
    const note = lines.find((l) => l.text.startsWith("\\"));
    expect(note).toMatchObject({ kind: "meta", oldLine: null, newLine: null });
    expect(lines.find((l) => l.kind === "add")?.newLine).toBe(1);
  });

  it("follows the line numbers a hunk header declares", () => {
    const { lines } = parseDiff("@@ -40,2 +80,2 @@\n context\n");
    expect(lines[1]).toMatchObject({ oldLine: 40, newLine: 80 });
  });
});
