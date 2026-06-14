import startlight from "@astrojs/starlight"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import remarkGfm from "remark-gfm"

// https://astro.build/config
export default defineConfig({
  markdown: {
    remarkPlugins: [remarkGfm],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    startlight({
      title: "Fristil - Dokumentasjon",
      defaultLocale: "root",
      locales: {
        root: { label: "Norsk", lang: "nb" },
      },
      components: {
        SiteTitle: "./src/components/SiteTitle.astro",
      },
      customCss: [
        "./src/styles/global.css",
        "@fristil/designsystem/tokens.css",
        "@fristil/designsystem/button.css",
        "@fristil/designsystem/link.css",
        "@fristil/designsystem/badge.css",
        "@fristil/designsystem/label.css",
        "@fristil/designsystem/input.css",
        "@fristil/designsystem/textarea.css",
        "@fristil/designsystem/select.css",
        "@fristil/designsystem/help-text.css",
        "@fristil/designsystem/error-text.css",
      ],
      sidebar: [
        {
          label: "Start her",
          items: [
            {
              label: "Introduksjon",
              slug: "introduksjon",
            },
            {
              label: "Typesikker bruk",
              slug: "typesikker-bruk",
            },
          ],
        },
        {
          label: "Komponenter",
          items: [
            {
              label: "CSS-komponenter",
              items: [
                { label: "Button", slug: "components/button" },
                { label: "Link", slug: "components/link" },
                { label: "Badge", slug: "components/badge" },
                { label: "Label", slug: "components/label" },
                { label: "Input", slug: "components/input" },
                { label: "Textarea", slug: "components/textarea" },
                { label: "Select", slug: "components/select" },
                { label: "Help Text", slug: "components/help-text" },
                { label: "Error Text", slug: "components/error-text" },
              ],
            },
            {
              label: "Ramme",
              items: [{ label: "Field", slug: "components/field" }],
            },
            {
              label: "Sammensatt",
              items: [
                { label: "Date Field", slug: "components/date-field" },
                { label: "Calendar", slug: "components/calendar" },
              ],
            },
          ],
        },
      ],
    }),
  ],
})
