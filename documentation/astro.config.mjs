import { readdirSync } from "node:fs"
import sitemap from "@astrojs/sitemap"
import startlight from "@astrojs/starlight"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import remarkGfm from "remark-gfm"
import pakke from "../designsystem/package.json" with { type: "json" }
import { markdownsider } from "./src/plugins/markdown-pages.mjs"
import { rehypeTabellrull } from "./src/plugins/rehype-table-scroll.mjs"
import { remarkVersjon } from "./src/plugins/remark-version.mjs"
import { DELINGSBILDE, metaAttributter } from "./src/share-image.mjs"

/*
 * Sitemapen tar bare med HTML-sidene av seg selv. `llms.txt` og
 * regelbøkene er nettopp det en agent leter etter, så de føres opp her.
 * Regelbøkene leses av mappa, slik at en ny bok kommer med uten at noen
 * husker det.
 */
const BASE = pakke.homepage.replace(/\/$/, "")
const AGENTFILER = [
  `${BASE}/llms.txt`,
  ...readdirSync(new URL("../designsystem/agent/", import.meta.url))
    .filter((fil) => fil.endsWith(".md"))
    .map((fil) => `${BASE}/agent/${fil}`),
]

// https://astro.build/config
export default defineConfig({
  /*
   * Adressen står i `homepage` i pakken, som `llms.txt` og `robots.txt` også
   * leser. Med `site` satt lager Starlight sitemapen selv, og den er det
   * søkemotorer og agenter finner sidene gjennom.
   */
  site: pakke.homepage,
  /*
   * `markdown.remarkPlugins` er merket som utfaset til fordel for
   * `markdown.processor`. Den veien virker ikke her: sidene er `.mdx`, og
   * MDX-pipelinen leser `remarkPlugins` herfra, mens `processor` bare gjelder
   * `.md`. Målt ved å bytte: alle tabellene kom ut som rå tekst med
   * skilletegn. Blir stående til MDX leser prosessoren.
   */
  markdown: {
    remarkPlugins: [remarkGfm, remarkVersjon],
    rehypePlugins: [rehypeTabellrull],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    // Står foran Starlight, som da lar være å legge til sin egen.
    sitemap({ customPages: AGENTFILER }),
    startlight({
      title: "LO-TEK - Dokumentasjon",
      // Pekeren til llms.txt på hver side, for en agent som leser sidehodet.
      head: [
        {
          tag: "link",
          attrs: {
            rel: "alternate",
            type: "text/plain",
            href: "/llms.txt",
            title: "llms.txt",
          },
        },
        /*
         * Bildet en lenke får når den deles. Starlight skriver tittel,
         * beskrivelse og `twitter:card` selv, men ikke noe bilde, og uten det
         * viser X lenken uten forhåndsvisning.
         */
        ...DELINGSBILDE.map((tagg) => ({
          tag: "meta",
          attrs: metaAttributter(tagg),
        })),
      ],
      // Pekeren til hver sides Markdown-utgave, som `markdownsider` skriver.
      routeMiddleware: "./src/route-data.ts",
      defaultLocale: "root",
      locales: {
        root: { label: "Norsk", lang: "nb" },
      },
      components: {
        SiteTitle: "./src/components/SiteTitle.astro",
        MarkdownContent: "./src/components/MarkdownContent.astro",
      },
      // Valgene for Expressive Code står i `ec.config.mjs`. `<Code>` krever at
      // de kan gjøres om til JSON når de står her, og det kan ikke et tillegg.
      /*
       * Tre stilark, og det er ikke en innstramming for innstrammingens skyld:
       * de 42 komponentstilarkene som sto her ble lastet på hver av de 62
       * sidene, og ingen av dem ble brukt av vanlig DOM noe sted.
       *
       * Grunnen er `Preview.astro`. Hvert levende eksempel ligger i en shadow
       * root, og forhåndsvisningen legger selv inn nøyaktig de stilarkene
       * `stiler`-lista oppgir, med `?inline`. Et stilark i `customCss` nådde
       * altså aldri eksemplene det var ment for: de har sine egne kopier.
       * Utenfor forhåndsvisningene er det bare `.lt-preview` selv som står i
       * vanlig DOM, og den er dokumentasjonens egen klasse fra `global.css`.
       *
       * `tokens.css` må være global. Variablene settes på `:root` og arves inn
       * gjennom shadow-grensen, så det er den som gir forhåndsvisningene farger
       * og avstander.
       *
       * `button.css` står igjen, og grunnen er Vite framfor smak. Tas det ut
       * herfra, slutter Vite å skrive stilarket i det hele tatt:
       * `src/pages/demo/page-skeleton.astro` importerer det selv, men med så få
       * importører havnet det ikke i noen chunk, og demosiden kom ut med
       * uformede knapper. `scripts/check-stylesheets.ts` fant det, og er grunnen
       * til at den finnes.
       */
      customCss: [
        "./src/styles/global.css",
        "@lo-tek/interfaces/tokens.css",
        "@lo-tek/interfaces/button.css",
      ],
      sidebar: [
        {
          label: "Start her",
          items: [
            { label: "Introduksjon", slug: "introduction" },
            { label: "Kom i gang", slug: "getting-started" },
            { label: "Rammeverk", slug: "frameworks" },
            { label: "Markup og oppførsel", slug: "markup-and-behaviour" },
            { label: "Design tokens", slug: "design-tokens" },
            { label: "Tilpasning", slug: "customising" },
            { label: "Tailwind", slug: "tailwind" },
            { label: "Tilgjengelighet", slug: "accessibility" },
            { label: "Oversettelse", slug: "translation" },
            { label: "Eget tema", slug: "your-own-theme" },
            { label: "Typesikker bruk", slug: "type-safe-use" },
            { label: "Kotlin og Java", slug: "kotlin" },
            { label: "Editoren", slug: "the-editor" },
            { label: "Kommandolinjen", slug: "command-line" },
            { label: "Kodeagenter", slug: "coding-agents" },
            { label: "Lisens og pris", slug: "licence" },
            { label: "Veikart", slug: "roadmap" },
            { label: "Versjonslogg", link: "/changelog/" },
          ],
        },
        {
          label: "Mønstre",
          items: [
            { label: "Skjema med validering", slug: "patterns/form" },
            { label: "Liste med filtre", slug: "patterns/list" },
            { label: "Sideskjelett", slug: "patterns/page-skeleton" },
            { label: "Bekreft en handling", slug: "patterns/confirmation" },
            { label: "Dato i et skjema", slug: "patterns/date" },
            { label: "La brukeren velge tema", slug: "patterns/theme" },
          ],
        },
        {
          label: "Komponenter",
          items: [
            { label: "Alle komponenter", slug: "components" },
            {
              label: "CSS-komponenter",
              items: [
                { label: "Accordion", slug: "components/accordion" },
                { label: "Alert", slug: "components/alert" },
                { label: "Avatar", slug: "components/avatar" },
                { label: "Badge", slug: "components/badge" },
                { label: "Breadcrumbs", slug: "components/breadcrumbs" },
                { label: "Button", slug: "components/button" },
                { label: "Card", slug: "components/card" },
                { label: "Checkbox", slug: "components/checkbox" },
                { label: "Divider", slug: "components/divider" },
                { label: "Error Text", slug: "components/error-text" },
                { label: "Fieldset", slug: "components/fieldset" },
                { label: "File Upload", slug: "components/file-upload" },
                { label: "Heading", slug: "components/heading" },
                { label: "Help Text", slug: "components/help-text" },
                { label: "Icon", slug: "components/icon" },
                { label: "Input", slug: "components/input" },
                { label: "Label", slug: "components/label" },
                { label: "Link", slug: "components/link" },
                { label: "List", slug: "components/list" },
                { label: "Pagination", slug: "components/pagination" },
                { label: "Paragraph", slug: "components/paragraph" },
                { label: "Progress", slug: "components/progress" },
                { label: "Radio", slug: "components/radio" },
                { label: "Search", slug: "components/search" },
                { label: "Select", slug: "components/select" },
                { label: "Skeleton", slug: "components/skeleton" },
                { label: "Skip Link", slug: "components/skip-link" },
                { label: "Spinner", slug: "components/spinner" },
                { label: "Sr Only", slug: "components/sr-only" },
                { label: "Switch", slug: "components/switch" },
                { label: "Table", slug: "components/table" },
                { label: "Tag", slug: "components/tag" },
                { label: "Textarea", slug: "components/textarea" },
                { label: "Toggle Group", slug: "components/toggle-group" },
                { label: "Tooltip", slug: "components/tooltip" },
              ],
            },
            {
              label: "Ramme",
              items: [
                { label: "Dialog", slug: "components/dialog" },
                { label: "Error Summary", slug: "components/error-summary" },
                { label: "Field", slug: "components/field" },
                { label: "Popover", slug: "components/popover" },
                {
                  label: "Session Timeout",
                  slug: "components/session-timeout",
                },
                { label: "Suggestion", slug: "components/suggestion" },
                { label: "Tabs", slug: "components/tabs" },
              ],
            },
            {
              label: "Frittstående",
              items: [
                {
                  label: "Connection Status",
                  slug: "components/connection-status",
                },
                { label: "Toast", slug: "components/toast" },
              ],
            },
          ],
        },
      ],
    }),
    // Etter Starlight, så sidene den leser er ferdige.
    markdownsider(),
  ],
})
