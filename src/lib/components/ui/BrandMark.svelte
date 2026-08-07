<script lang="ts">
  interface Props {
    size?: number | string;
    /**
     * Sets the mark's neutral tone — it draws in `currentColor`. Replaces the
     * default outright rather than merging: two colour utilities on one element
     * resolve by stylesheet order, not by class order, so a caller adding one
     * could not predict which wins.
     */
    class?: string;
  }
  // Matches IconComponent's `size`/`class` so the mark drops into any ui slot
  // that takes a Lucide icon. Decorative: it is never the only name for anything.
  let { size = 16, class: klass = "text-on-surface" }: Props = $props();

  // The mark, drawn from tokens instead of loaded from `/icon-mark.svg`.
  //
  // The asset keeps its fixed palette because it is what the OS renders — the
  // taskbar, the installer, the favicon — where there is no theme to read. Inside
  // the app there is one, and a mark with eight baked-in colours only ever looked
  // right on the two themes it was drawn against: on a light theme its near-white
  // top face vanished into the surface. So the in-app mark is this component, and
  // it carries exactly two colours: the surrounding text colour and `--primary`.
  //
  // Geometry is the asset's, unchanged. What is gone is the detail that was never
  // visible here: the 2-unit dark ring inside the frame (a stand-in for the app
  // background, which real transparency now does properly) and the 2.5-unit seams
  // around each slab. This renders at 16–24px, where the group transform puts
  // both under a third of a pixel — they were a smudge on the edges, and the
  // 5-unit gap of bare surface between slabs separates them far better than a
  // sub-pixel line. The full-detail version still exists in the asset for 256px.
  const FRAME = "m 46,60.1 82,-24.6 82,24.6 v 109.8 l -82,24.6 -82,-24.6 z";

  // How far each face is turned from the light. The asset spells these out as
  // eight literal colours; as opacities they compose with whatever token is
  // underneath, so one set of numbers works in both polarities — a face steps
  // toward the surface it sits on, which reads as recession on a dark theme and
  // on a light one.
  const BEVEL = 0.28; // the frame's outer band, around its lit inner band
  const LEFT_FACE = 0.55;
  const RIGHT_FACE = 0.3;
</script>

<svg
  viewBox="0 0 256 256"
  width={size}
  height={size}
  aria-hidden="true"
  focusable="false"
  class={klass}
>
  <g transform="matrix(1.3369355,0,0,1.3369355,-43.127748,-25.747586)">
    <!-- Outer frame: the stack's own silhouette hexagon, offset outward, so it
         stays parallel to the mark all the way round. Two passes on one path
         build the band outwards from the centre: bevel 2.5 | lit 6 | bevel 2.5. -->
    <g fill="none" stroke-linejoin="round" class="stroke-current">
      <path stroke-opacity={BEVEL} stroke-width="11" d={FRAME} />
      <path stroke-width="6" d={FRAME} />
    </g>

    <!-- Top face, hollowed at the hexagon inset 10 so the surface shows through
         the ring band — on whichever surface the mark happens to sit. -->
    <path
      class="fill-current"
      fill-rule="evenodd"
      d="m 58,69 70,-21 70,21 v 38 l -70,21 -70,-21 z m 10,7.4 60,-18 60,18 v 23.2 l -60,18 -60,-18 z"
    />
    <!-- Inner hexagon (inset 15). Full accent rather than the asset's darker
         blue: at 22px this is the only accent with area enough to read, and it is
         what carries the brand colour when the mark is the size of a favicon. -->
    <path class="fill-primary" d="m 73,80.2 55,-16.5 55,16.5 V 95.8 L 128,112.3 73,95.8 Z" />

    <!-- Left/right faces are separate fills that butt at x=128, so the centre
         seam stays bare. The middle slab is stone; the bottom one is the lit
         accent slab. -->
    <path class="fill-current" fill-opacity={LEFT_FACE} d="m 58,112 70,21 v 22 L 58,134 Z" />
    <path class="fill-current" fill-opacity={RIGHT_FACE} d="m 198,112 v 22 l -70,21 v -22 z" />
    <path class="fill-primary" d="m 58,139 70,21 v 22 L 58,161 Z" />
    <path class="fill-primary" fill-opacity={LEFT_FACE} d="m 198,139 v 22 l -70,21 v -22 z" />
  </g>
</svg>
