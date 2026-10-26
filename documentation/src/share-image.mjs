import pkg from "../../interfaces/package.json" with { type: "json" }

/*
 * The image a link to the documentation gets when it is shared. The Starlight
 * pages get the tags from `head` in `astro.config.mjs`, and the front page,
 * which sits outside Starlight, writes them itself in `index.astro`. Both read
 * the list from here.
 *
 * The address must be absolute: X and the others do not read a relative path.
 * The image is `public/og.png`, 1200 × 630 pixels.
 */
const BASE = pkg.homepage.replace(/\/$/, "")

export const SHARE_IMAGE = [
  ["og:image", `${BASE}/og.png`],
  ["og:image:width", "1200"],
  ["og:image:height", "630"],
  ["og:image:alt", "LO-TEK. Framework-independent design system."],
  ["twitter:image", `${BASE}/og.png`],
]

// `og:*` is a `property` in Open Graph, `twitter:*` is a `name`.
export const metaAttributes = ([name, value]) =>
  name.startsWith("og:")
    ? { property: name, content: value }
    : { name: name, content: value }
