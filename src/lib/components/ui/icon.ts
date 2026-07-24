import type { Component } from "svelte";

/** Shape a Lucide icon exposes. Used to type `icon` props on ui primitives. */
export type IconComponent = Component<{
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
  class?: string;
}>;
