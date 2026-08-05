// Sidebar view state:
//   - `width`      : draggable px width (persisted).
//   - `collapsed`  : the user's manual accordion collapse (persisted).
//   - `autoHidden` : sections squeezed shut because the sidebar is too short
//                    (owned by Sidebar, which measures height; not persisted).
//   - `sizes`      : flex-grow weight per open section, adjusted by the drag
//                    handles between sections (persisted).
// A section body shows only when it's neither manually collapsed nor auto-hidden.

export const SECTIONS = [
  { id: "schema", title: "Schema" },
  { id: "saved", title: "Saved" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

const isSectionId = (id: unknown): id is SectionId => SECTIONS.some((s) => s.id === id);

// Shared layout metrics (also used by Sidebar + AccordionSection).
export const HEADER_H = 36; // h-9 accordion header row, px
export const MIN_BODY = 96; // smallest usable section body before it auto-collapses

const W_KEY = "basalt.sidebar.width";
const C_KEY = "basalt.sidebar.collapsed";
const S_KEY = "basalt.sidebar.sizes";
const MIN_W = 180;
const MAX_W = 600;
const DEFAULT_W = 260;

const clampW = (w: number): number => Math.min(MAX_W, Math.max(MIN_W, Math.round(w)));

function loadWidth(): number {
  const n = Number(localStorage.getItem(W_KEY));
  return n >= MIN_W && n <= MAX_W ? n : DEFAULT_W;
}

// Both loaders drop unknown ids so state persisted by an older layout (which had
// a Connections section) can't leak a retired id back into the weights.
function loadCollapsed(): Set<SectionId> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(C_KEY) ?? "[]");
    return new Set(Array.isArray(saved) ? saved.filter(isSectionId) : []);
  } catch {
    return new Set();
  }
}

function loadSizes(): Record<SectionId, number> {
  const base = Object.fromEntries(SECTIONS.map((s) => [s.id, 1])) as Record<SectionId, number>;
  try {
    const saved = JSON.parse(localStorage.getItem(S_KEY) ?? "{}") as Record<string, number>;
    for (const [id, weight] of Object.entries(saved)) {
      if (isSectionId(id) && typeof weight === "number") base[id] = weight;
    }
    return base;
  } catch {
    return base;
  }
}

let width = $state(loadWidth());
let collapsed = $state<Set<SectionId>>(loadCollapsed());
let autoHidden = $state<Set<SectionId>>(new Set());
let sizes = $state<Record<SectionId, number>>(loadSizes());
let availH = $state(0);

const isOpenId = (id: SectionId): boolean => !collapsed.has(id) && !autoHidden.has(id);
const openIds = (): SectionId[] => SECTIONS.filter((s) => isOpenId(s.id)).map((s) => s.id);

export const sidebar = {
  get width() {
    return width;
  },
  get availH() {
    return availH;
  },
  setWidth(w: number): void {
    width = clampW(w);
    localStorage.setItem(W_KEY, String(width));
  },
  /** Sidebar pushes its measured body height; guarded so it doesn't churn effects. */
  setAvailH(px: number): void {
    if (px !== availH) availH = px;
  },
  isCollapsed: (id: SectionId): boolean => collapsed.has(id),
  isOpen: isOpenId,
  size: (id: SectionId): number => sizes[id],
  toggle(id: SectionId): void {
    // Reassign (not mutate) so $state reactivity fires.
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed = next;
    localStorage.setItem(C_KEY, JSON.stringify([...next]));
  },
  setAutoHidden(ids: SectionId[]): void {
    if (ids.length === autoHidden.size && ids.every((id) => autoHidden.has(id))) return;
    autoHidden = new Set(ids);
  },
  /** Drag handle: transfer flex weight from `below` to `above` by `dy` local px. */
  resizeSections(above: SectionId, below: SectionId, dy: number): void {
    const open = openIds();
    const free = availH - (SECTIONS.length - open.length) * HEADER_H;
    const total = open.reduce((sum, id) => sum + sizes[id], 0);
    if (free <= 0 || total <= 0) return;
    const dW = (dy * total) / free; // px → weight
    const minW = ((HEADER_H + MIN_BODY) * total) / free; // keep each body ≥ MIN_BODY
    const a = sizes[above] + dW;
    const b = sizes[below] - dW;
    if (a < minW || b < minW) return;
    sizes = { ...sizes, [above]: a, [below]: b };
    localStorage.setItem(S_KEY, JSON.stringify(sizes));
  },
};
