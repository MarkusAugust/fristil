/*
 * The mark, as path data: L and T set tight, with the shadow the pair casts
 * drawn as scan lines. `Logo.astro` draws it on the site and `share-card.ts`
 * puts it on the share card, so the two never drift apart.
 *
 * The shapes are computed, not drawn by hand: the letters are polygons, the
 * shadow is their joined silhouette moved down and to the right, with the
 * letters and a gap cut out of it, and the edge is the whole outline grown
 * by the gap. `public/favicon.svg` is the same mark with a solid shadow,
 * since lines this fine disappear at the size of a tab.
 *
 * The colours are fixed and do not follow the theme.
 */

export const COLOURS = { edge: "#111212", shadow: "#4992e2", ink: "#e6e8eb" }

export const VIEW_BOX = "-5 -12.0711 125.071 129.071"
export const EDGE =
  "M7 105L7 117L49.07 117L70 96.07L70 82L70 65L70 35L92.07 35L120.07 7L96.07 7L108.07 -5L23 -5L23 -12.07L-5 15.93L-5 105Z"
export const INK =
  "M23 18L35 18L35 77L53 77L53 18L78 18L96 0L23 0ZM0 100L35 100L53 82L18 82L18 0L0 18Z"
export const SCAN_LINES =
  "M49 110L12 110L12 112L47 112ZM54 105L37.07 105L12 105L12 108L51 108ZM59 100L42.07 100L39.07 103L56 103ZM64 95L47.07 95L44.07 98L61 98ZM65 90L52.07 90L49.07 93L65 93ZM65 85L57.07 85L54.07 88L65 88ZM65 80L62.07 80L59.07 83L65 83ZM95 25L58 25L58 28L92 28ZM100 20L83.07 20L80.07 23L97 23ZM105 15L88.07 15L85.07 18L102 18ZM108 12L91.07 12L90.07 13L107 13ZM58 33L65 33L65 30L58 30ZM58 38L65 38L65 35L58 35ZM58 43L65 43L65 40L58 40ZM58 48L65 48L65 45L58 45ZM58 53L65 53L65 50L58 50ZM58 58L65 58L65 55L58 55ZM58 63L65 63L65 60L58 60ZM58 68L65 68L65 65L58 65ZM58 73L65 73L65 70L58 70ZM58 77L65 77L65 75L58 75ZM30 25L23 25L23 28L30 28ZM23 33L30 33L30 30L23 30ZM23 38L30 38L30 35L23 35ZM23 43L30 43L30 40L23 40ZM23 48L30 48L30 45L23 45ZM23 53L30 53L30 50L23 50ZM23 58L30 58L30 55L23 55ZM23 63L30 63L30 60L23 60ZM23 68L30 68L30 65L23 65ZM23 73L30 73L30 70L23 70ZM23 77L30 77L30 75L23 75Z"
