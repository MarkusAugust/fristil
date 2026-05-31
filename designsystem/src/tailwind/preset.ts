import type { Config } from "tailwindcss"
import { Breakpoints, Containers, type cssTokens } from "../tokens/tokens.js"

const v = (token: keyof typeof cssTokens) => `var(${token})`

export const fristilPreset = {
  theme: {
    screens: Breakpoints,

    colors: {
      transparent: "transparent",
      current: "currentColor",

      page: {
        bg: v("--semantic-page-background"),
        fg: v("--semantic-page-foreground"),
      },
      interactive: {
        DEFAULT: v("--semantic-interactive-main"),
        bg: v("--semantic-interactive-background"),
        fg: v("--semantic-interactive-foreground"),
      },
      danger: {
        DEFAULT: v("--semantic-danger-foreground"),
        bg: v("--semantic-danger-background"),
      },
      warning: {
        DEFAULT: v("--semantic-warning-foreground"),
        bg: v("--semantic-warning-background"),
      },
      success: {
        DEFAULT: v("--semantic-success-foreground"),
        bg: v("--semantic-success-background"),
      },
      disabled: {
        DEFAULT: v("--semantic-disabled-foreground"),
        bg: v("--semantic-disabled-background"),
      },
      divider: {
        DEFAULT: v("--semantic-divider-30"),
        strong: v("--semantic-divider-100"),
      },

      palette: {
        burgundy: {
          5: v("--palette-burgundy-5"),
          10: v("--palette-burgundy-10"),
          30: v("--palette-burgundy-30"),
          50: v("--palette-burgundy-50"),
          70: v("--palette-burgundy-70"),
          100: v("--palette-burgundy-100"),
        },
        forest: {
          5: v("--palette-forest-5"),
          10: v("--palette-forest-10"),
          30: v("--palette-forest-30"),
          50: v("--palette-forest-50"),
          70: v("--palette-forest-70"),
          100: v("--palette-forest-100"),
        },
        ochre: {
          5: v("--palette-ochre-5"),
          10: v("--palette-ochre-10"),
          30: v("--palette-ochre-30"),
          50: v("--palette-ochre-50"),
          70: v("--palette-ochre-70"),
          100: v("--palette-ochre-100"),
        },
        denim: {
          5: v("--palette-denim-5"),
          10: v("--palette-denim-10"),
          30: v("--palette-denim-30"),
          50: v("--palette-denim-50"),
          70: v("--palette-denim-70"),
          100: v("--palette-denim-100"),
        },
        azure: {
          10: v("--palette-azure-10"),
          30: v("--palette-azure-30"),
          70: v("--palette-azure-70"),
          100: v("--palette-azure-100"),
        },
        graphite: {
          0: v("--palette-graphite-0"),
          5: v("--palette-graphite-5"),
          10: v("--palette-graphite-10"),
          30: v("--palette-graphite-30"),
          50: v("--palette-graphite-50"),
          70: v("--palette-graphite-70"),
          100: v("--palette-graphite-100"),
        },
      },
    },

    fontSize: {
      xxs: v("--font-size-xxs"),
      xs: v("--font-size-xs"),
      s: v("--font-size-s"),
      m: v("--font-size-m"),
      l: v("--font-size-l"),
      xl: v("--font-size-xl"),
      xxl: v("--font-size-xxl"),
      mega: v("--font-size-mega"),
    },

    extend: {
      maxWidth: Containers,
    },
  },
} satisfies Partial<Config>
