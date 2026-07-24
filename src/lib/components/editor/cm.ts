import { Compartment, Prec, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  drawSelection,
  type KeyBinding,
} from "@codemirror/view";
import { history, defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from "@codemirror/language";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import {
  sql,
  PostgreSQL,
  MySQL,
  SQLite,
  type SQLDialect,
  type SQLNamespace,
} from "@codemirror/lang-sql";
import { tags as t } from "@lezer/highlight";
import type { Engine, SchemaTree } from "$lib/api/types";

// CodeMirror 6 config lives here so the Svelte component stays thin. Colors come
// only from the `--syntax-*`/surface tokens (DESIGN §3) via var() — no literals.

export interface EditorCallbacks {
  onChange: (doc: string) => void;
  /** cursorOffset is a UTF-8 byte offset (Rust `statement_at`); undefined = run all. */
  onRun: (payload: { sql: string; cursorOffset?: number }) => void;
  onFormat: () => void;
}

const DIALECT: Record<Engine, SQLDialect> = {
  postgres: PostgreSQL,
  mysql: MySQL,
  sqlite: SQLite,
};

/** Autocomplete schema (DESIGN §10 — from the in-memory cache, zero IPC/keystroke).
 *  Bare + schema-qualified table names → their columns (empty until described). */
export function schemaFrom(
  tree: SchemaTree | undefined,
  columnsOf: (ns: string, table: string) => string[] | undefined,
): SQLNamespace {
  const out: Record<string, string[]> = {};
  if (!tree) return out;
  for (const ns of tree.namespaces) {
    for (const rel of ns.relations) {
      const cols = columnsOf(ns.name, rel.name) ?? [];
      out[rel.name] = cols;
      out[`${ns.name}.${rel.name}`] = cols;
    }
  }
  return out;
}

function sqlExtension(dialect: Engine, schema: SQLNamespace): Extension {
  return sql({ dialect: DIALECT[dialect], schema, upperCaseKeywords: false });
}

const utf8 = new TextEncoder();

function runKeys(cb: EditorCallbacks): KeyBinding[] {
  return [
    {
      key: "Mod-Enter",
      preventDefault: true,
      run: (view) => {
        const { state } = view;
        const sel = state.selection.main;
        if (!sel.empty) {
          cb.onRun({ sql: state.sliceDoc(sel.from, sel.to) }); // run selection
        } else {
          cb.onRun({
            sql: state.doc.toString(),
            cursorOffset: utf8.encode(state.sliceDoc(0, sel.head)).length,
          });
        }
        return true;
      },
    },
    {
      key: "Mod-Shift-Enter",
      preventDefault: true,
      run: (view) => {
        cb.onRun({ sql: view.state.doc.toString() });
        return true;
      },
    },
    {
      key: "Mod-Shift-f",
      preventDefault: true,
      run: () => {
        cb.onFormat();
        return true;
      },
    },
  ];
}

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: "var(--syntax-kw)" },
  { tag: [t.string, t.special(t.string)], color: "var(--syntax-str)" },
  { tag: [t.number, t.bool, t.null], color: "var(--syntax-num)" },
  { tag: [t.lineComment, t.blockComment], color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--syntax-fn)" },
  { tag: t.typeName, color: "var(--syntax-fn)" },
  { tag: [t.variableName, t.propertyName, t.name], color: "var(--syntax-ident)" },
  { tag: t.operator, color: "var(--fg-1)" },
]);

// Flat, tokenized editor chrome — the app owns the focus ring, so CM's is off.
const theme = EditorView.theme({
  "&": { color: "var(--fg-1)", backgroundColor: "var(--bg-0)", height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: "1.5" },
  ".cm-content": { caretColor: "var(--fg-0)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--fg-0)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--grid-sel)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-1)",
    color: "var(--fg-2)",
    border: "none",
    borderRight: "1px solid var(--border)",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 12px" },
  ".cm-matchingBracket": { backgroundColor: "var(--bg-2)", outline: "1px solid var(--border-strong)" },
  ".cm-tooltip": {
    backgroundColor: "var(--bg-2)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--fg-1)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-mono)", fontSize: "12px" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-fg)",
  },
});

export function buildEditor(opts: {
  dialect: Engine;
  schema: SQLNamespace;
  cb: EditorCallbacks;
}): { extensions: Extension[]; language: Compartment } {
  const language = new Compartment();
  const extensions = [
    lineNumbers(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    language.of(sqlExtension(opts.dialect, opts.schema)),
    syntaxHighlighting(highlight),
    theme,
    EditorView.lineWrapping,
    Prec.highest(keymap.of(runKeys(opts.cb))),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) opts.cb.onChange(u.state.doc.toString());
    }),
  ];
  return { extensions, language };
}

export function reconfigureSql(
  view: EditorView,
  language: Compartment,
  dialect: Engine,
  schema: SQLNamespace,
): void {
  view.dispatch({ effects: language.reconfigure(sqlExtension(dialect, schema)) });
}
