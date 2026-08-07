// Unified diff → the lines a viewer draws. Parsed here rather than in Rust
// because hunk structure is what the *viewer* needs and nothing else does;
// sending it over IPC would be a second representation of git's own output,
// kept in step by hand.

export type DiffLineKind = "add" | "remove" | "context" | "meta";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  /** Line number in the old file, or null for an added line. */
  oldLine: number | null;
  /** Line number in the new file, or null for a removed line. */
  newLine: number | null;
}

export interface DiffStat {
  added: number;
  removed: number;
}

export interface ParsedDiff {
  lines: DiffLine[];
  stat: DiffStat;
  /** True when git produced nothing — an unchanged file, or a binary one. */
  empty: boolean;
  /** Git declined to show content, e.g. `Binary files … differ`. */
  binary: boolean;
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Everything before the first `@@` is git's file header — `diff --git`, index
 * hashes, `---`/`+++`. It says nothing the viewer doesn't already show in its own
 * header, so it is dropped rather than rendered as noise above every diff.
 */
export function parseDiff(raw: string): ParsedDiff {
  const lines: DiffLine[] = [];
  const stat: DiffStat = { added: 0, removed: 0 };
  let binary = false;
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const text of raw.split("\n")) {
    const hunk = HUNK.exec(text);
    if (hunk) {
      inHunk = true;
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      lines.push({ kind: "meta", text, oldLine: null, newLine: null });
      continue;
    }
    if (!inHunk) {
      if (text.startsWith("Binary files")) binary = true;
      continue;
    }

    // "\ No newline at end of file" is a note about the line above, not a line.
    if (text.startsWith("\\")) {
      lines.push({ kind: "meta", text, oldLine: null, newLine: null });
      continue;
    }

    const marker = text[0];
    const body = text.slice(1);
    if (marker === "+") {
      stat.added++;
      lines.push({ kind: "add", text: body, oldLine: null, newLine: newLine++ });
    } else if (marker === "-") {
      stat.removed++;
      lines.push({ kind: "remove", text: body, oldLine: oldLine++, newLine: null });
    } else if (marker === " ") {
      lines.push({ kind: "context", text: body, oldLine: oldLine++, newLine: newLine++ });
    }
    // Anything else inside a hunk is a trailing blank from the final split.
  }

  return { lines, stat, empty: lines.length === 0, binary };
}
