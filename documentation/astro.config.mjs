import startlight from "@astrojs/starlight"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    startlight({
      title: "Fristil - Dokumentasjon",
      customCss: [
        "@fristil/designsystem/tokens.css",
        "@fristil/designsystem/button.css",
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
          items: [{ autogenerate: { directory: "components" } }],
        },
      ],
    }),
  ],
})
