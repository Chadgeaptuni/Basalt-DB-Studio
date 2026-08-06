// Side-panel view state: which rail destination is showing, how wide the panel
// is, and whether it is collapsed.
//
// This replaces the accordion sidebar store. The accordion had to track a
// collapsed set, per-section flex weights, a measured available height and an
// `autoHidden` set — machinery that existed only to decide which of the user's
// open sections to shut when they stopped fitting. One panel at a time (DESIGN
// §5) removes the contention, and with it all of that state.

export const PANELS = ["schema", "queries", "history", "git"] as const;
export type PanelId = (typeof PANELS)[number];

const isPanelId = (id: unknown): id is PanelId => PANELS.includes(id as PanelId);

const ACTIVE_KEY = "basalt.panel.active";
const WIDTH_KEY = "basalt.sidebar.width"; // kept: the width the user already set
const COLLAPSED_KEY = "basalt.panel.collapsed";
const MIN_W = 180;
const MAX_W = 600;
const DEFAULT_W = 280;

const clampW = (w: number): number => Math.min(MAX_W, Math.max(MIN_W, Math.round(w)));

function loadActive(): PanelId {
  const saved = localStorage.getItem(ACTIVE_KEY);
  return isPanelId(saved) ? saved : "schema";
}

function loadWidth(): number {
  const n = Number(localStorage.getItem(WIDTH_KEY));
  return n >= MIN_W && n <= MAX_W ? n : DEFAULT_W;
}

let active = $state<PanelId>(loadActive());
let width = $state(loadWidth());
let collapsed = $state(localStorage.getItem(COLLAPSED_KEY) === "1");

export const panel = {
  get active() {
    return active;
  },
  get width() {
    return width;
  },
  get collapsed() {
    return collapsed;
  },

  /** Selecting the destination that is already showing collapses the panel —
   *  the standard rail behaviour, and the only way to hide it with the mouse. */
  select(id: PanelId): void {
    if (id === active && !collapsed) {
      panel.setCollapsed(true);
      return;
    }
    active = id;
    collapsed = false;
    localStorage.setItem(ACTIVE_KEY, id);
    localStorage.setItem(COLLAPSED_KEY, "0");
  },

  setCollapsed(next: boolean): void {
    collapsed = next;
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  },

  toggleCollapsed(): void {
    panel.setCollapsed(!collapsed);
  },

  setWidth(w: number): void {
    width = clampW(w);
    localStorage.setItem(WIDTH_KEY, String(width));
  },
};
