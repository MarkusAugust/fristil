export const Breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const

export const Containers = {
  xs: "100%",
  sm: "576px",
  md: "960px",
  lg: "1152px",
  xl: "1536px",
  aside: "384px",
  asideNarrow: "288px",
  wideContent: "768px",
} as const

export type Breakpoint = keyof typeof Breakpoints
export type Container = keyof typeof Containers

export const cssTokens = {
  // Font sizes
  "--font-size-reference": "16px",
  "--font-size-xxs": "0.625rem",
  "--font-size-xs": "0.75rem",
  "--font-size-s": "0.875rem",
  "--font-size-m": "1rem",
  "--font-size-l": "1.125rem",
  "--font-size-xl": "1.375rem",
  "--font-size-xxl": "1.875rem",
  "--font-size-mega": "2.625rem",

  // Size scale (Tailwind-kompatibel, 4px-base)
  "--size-px": "1px",
  "--size-0-5": "0.125rem",
  "--size-1": "0.25rem",
  "--size-2": "0.5rem",
  "--size-3": "0.75rem",
  "--size-4": "1rem",
  "--size-5": "1.25rem",
  "--size-6": "1.5rem",
  "--size-8": "2rem",
  "--size-10": "2.5rem",
  "--size-12": "3rem",
  "--size-16": "4rem",

  // Semantic — størrelse og avstand
  "--semantic-size-default": "var(--size-4)",
  "--semantic-spacing-default": "var(--size-4)",

  // Palette — Burgundy
  "--palette-burgundy-5": "#faf0f3",
  "--palette-burgundy-10": "#f7e2e8",
  "--palette-burgundy-30": "#f3a7b0",
  "--palette-burgundy-50": "#f06674",
  "--palette-burgundy-70": "#b04c5c",
  "--palette-burgundy-100": "#6f2c3f",

  // Palette — Forest
  "--palette-forest-5": "#f4faf5",
  "--palette-forest-10": "#e3f5ea",
  "--palette-forest-30": "#b9e1c8",
  "--palette-forest-50": "#91d6ac",
  "--palette-forest-70": "#5d9b73",
  "--palette-forest-100": "#2b6940",

  // Palette — Ochre
  "--palette-ochre-5": "#f9f4f0",
  "--palette-ochre-10": "#f9ede2",
  "--palette-ochre-30": "#f0d2b6",
  "--palette-ochre-50": "#e7b78a",
  "--palette-ochre-70": "#a9805b",
  "--palette-ochre-100": "#6b492c",

  // Palette — Denim
  "--palette-denim-5": "#eff3f9",
  "--palette-denim-10": "#e2eaf7",
  "--palette-denim-30": "#b5cbee",
  "--palette-denim-50": "#89abe5",
  "--palette-denim-70": "#5a77a8",
  "--palette-denim-100": "#2c436b",

  // Palette — Azure
  "--palette-azure-10": "#cde1f9",
  "--palette-azure-30": "#9ccff2",
  "--palette-azure-70": "#1362ae",
  "--palette-azure-100": "#093e61",

  // Palette — Graphite
  "--palette-graphite-0": "#ffffff",
  "--palette-graphite-5": "#f4f4f4",
  "--palette-graphite-10": "#e5e5e5",
  "--palette-graphite-30": "#b2b2b2",
  "--palette-graphite-50": "#757575",
  "--palette-graphite-70": "#4d4d4d",
  "--palette-graphite-100": "#1a1a1a",

  // Palette — Alpha
  "--palette-dark-alpha-50": "#1a1a1a80",

  // Semantic — side
  "--semantic-page-background": "var(--palette-graphite-0)",
  "--semantic-page-foreground": "var(--palette-graphite-100)",

  // Semantic — status
  "--semantic-danger-background": "var(--palette-burgundy-10)",
  "--semantic-danger-foreground": "#a82e39",
  "--semantic-warning-background": "var(--palette-ochre-10)",
  "--semantic-warning-foreground": "#896508",
  "--semantic-success-background": "var(--palette-forest-10)",
  "--semantic-success-foreground": "#316f2a",

  // Deaktiverte kontroller. WCAG 1.4.3 unntar inaktive komponenter fra
  // kontrastkravet, så denne er bevisst dempet — bruk den kun på noe som
  // faktisk er slått av, aldri på tekst brukeren skal lese.
  "--semantic-disabled-background": "var(--palette-graphite-10)",
  "--semantic-disabled-foreground": "var(--palette-graphite-50)",

  // Nøytral status — informasjon brukeren skal lese, ikke en avslått
  // kontroll. Derfor mørkere enn disabled: 6,71:1 mot egen bakgrunn.
  "--semantic-neutral-background": "var(--palette-graphite-10)",
  "--semantic-neutral-foreground": "var(--palette-graphite-70)",

  // Semantic — interaktiv
  "--semantic-interactive-background": "var(--palette-azure-10)",
  "--semantic-interactive-main": "var(--palette-azure-70)",
  "--semantic-interactive-foreground": "var(--palette-azure-100)",

  // Semantic — skillelinjer
  "--semantic-divider-30": "var(--palette-graphite-30)",
  "--semantic-divider-100": "var(--palette-graphite-100)",
} as const

export type CssToken = keyof typeof cssTokens
