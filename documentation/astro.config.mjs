import startlight from "@astrojs/starlight"
import { defineConfig } from "astro/config"

// https://astro.build/config
export default defineConfig({
  integrations: [
    startlight({
      title: "Fristil",
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
