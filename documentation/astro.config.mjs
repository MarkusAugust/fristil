import startlight from "@astrojs/starlight"
import { defineConfig } from "astro/config"

// https://astro.build/config
export default defineConfig({
  integrations: [
    startlight({
      title: "Fristil",
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
