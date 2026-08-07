// The M3 outlined field box, declared once (DESIGN §6): 32px, `rounded-sm`, a 1px
// edge over `--surface`.
//
// It is a class string rather than a wrapper component because the three controls
// that wear it put focus on different elements — the text input focuses itself,
// the select trigger is a button, and the number field's border belongs to a
// wrapper around an input and two steppers. A component would have to expose all
// three as options, which is a worse abstraction than sharing the box.
//
// Border *colour*, padding and the focus rule stay with the caller: a field in
// error swaps its edge for `--error`, and a box with controls inset against its
// right edge cannot use the same horizontal padding as one holding only text.
// Both are `border-*`/`px-*` utilities, and two of those on one element resolve
// by stylesheet order rather than class order — so they are set once, at the end.
export const FIELD_BOX =
  "h-8 w-full rounded-sm border bg-surface text-body-md transition-colors " +
  "duration-200 ease-standard disabled:opacity-[0.38]";
