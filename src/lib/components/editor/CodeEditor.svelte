<script lang="ts">
  import { untrack } from "svelte";
  import { EditorState, type Compartment } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import type { SQLNamespace } from "@codemirror/lang-sql";
  import type { Engine } from "$lib/api/types";
  import { buildEditor, reconfigureSql, type EditorCallbacks } from "./cm";

  // Thin CodeMirror 6 host. `value` is the source of truth (owned by the tab);
  // typing flows out via onChange, and external changes (new tab, format, history
  // reload) flow back in through the value effect. All config lives in cm.ts.
  interface Props {
    value: string;
    dialect: Engine;
    schema: SQLNamespace;
    onChange: (v: string) => void;
    onRun: (payload: { sql: string; cursorOffset?: number }) => void;
    onFormat: () => void;
  }
  let { value, dialect, schema, onChange, onRun, onFormat }: Props = $props();

  let el = $state<HTMLDivElement>();
  let view: EditorView | undefined;
  let language: Compartment | undefined;

  // Always dispatch to the latest prop handlers even though CM binds them once.
  const cb: EditorCallbacks = {
    onChange: (d) => onChange(d),
    onRun: (p) => onRun(p),
    onFormat: () => onFormat(),
  };

  $effect(() => {
    const host = el;
    if (!host) return;
    const built = untrack(() => buildEditor({ dialect, schema, cb }));
    language = built.language;
    view = new EditorView({
      parent: host,
      state: EditorState.create({ doc: untrack(() => value), extensions: built.extensions }),
    });
    return () => {
      view?.destroy();
      view = undefined;
      language = undefined;
    };
  });

  // External value change → replace the doc (typing is a no-op: doc already matches).
  $effect(() => {
    const next = value;
    if (view && next !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
    }
  });

  // Reconfigure autocomplete when the connection's engine or cached schema changes.
  $effect(() => {
    const d = dialect;
    const s = schema;
    if (view && language) reconfigureSql(view, language, d, s);
  });
</script>

<div bind:this={el} class="h-full overflow-hidden"></div>
