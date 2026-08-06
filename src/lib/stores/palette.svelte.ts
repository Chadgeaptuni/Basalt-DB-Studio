// Command-palette visibility, declared once (DESIGN §9) so any surface can open
// it — the shortcut, the top-bar search button, a future empty-state action —
// without one of them owning the state and the others reaching through props.

let open = $state(false);

export const palette = {
  get open() {
    return open;
  },
  // Self-references go through `palette`, not `this`: these are passed straight to
  // `onclick={palette.toggle}` and to the keyboard registry, which detach the
  // receiver.
  show(): void {
    open = true;
  },
  close(): void {
    open = false;
  },
  toggle(): void {
    open = !open;
  },
};
