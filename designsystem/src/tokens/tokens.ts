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

  /*
   * Skriftvekter og linjeavstander.
   *
   * De står her, og ikke i hver komponent, fordi en organisasjon som tar
   * systemet i bruk gjerne har sin egen typografi. Skatteetatens knapper er
   * fete med linjeavstand 1,666, våre er halvfete med 1,5, og forskjellen
   * skal kunne settes ett sted framfor i tjue stilark.
   *
   * Komponentene leser dem gjennom sin egen `--fs-*`-variabel, slik at et
   * tema kan endre alle knapper uten å endre all tekst.
   */
  "--font-weight-regular": "400",
  "--font-weight-medium": "500",
  "--font-weight-semibold": "600",
  "--font-weight-bold": "700",

  /*
   * Verdiene er nøyaktig dem komponentene hadde skrevet ut fra før, slik at
   * ingen konsument ser en endring av at de ble tokens.
   */
  /** Kontroller og tabeller: knapp, felt, celle. */
  "--semantic-line-height-default": "1.5",
  /** Overskrifter, som tåler tettere linjer fordi de er korte. */
  "--semantic-line-height-heading": "1.2",
  /** Brødtekst, der øyet skal finne tilbake til neste linje. */
  "--semantic-line-height-article": "1.6",

  // Size scale (Tailwind-kompatibel, 4px-base)
  "--size-px": "1px",
  "--size-0-5": "0.125rem",
  "--size-1": "0.25rem",
  "--size-2": "0.5rem",
  "--size-3": "0.75rem",
  "--size-4": "1rem",
  "--size-5": "1.25rem",
  "--size-6": "1.5rem",
  "--size-7": "1.75rem",
  "--size-8": "2rem",
  "--size-10": "2.5rem",
  "--size-12": "3rem",
  "--size-16": "4rem",

  // Semantic: størrelse og avstand
  "--semantic-size-default": "var(--size-4)",
  "--semantic-spacing-default": "var(--size-4)",

  // Palette: Burgundy
  "--palette-burgundy-5": "#faf0f3",
  "--palette-burgundy-10": "#f7e2e8",
  "--palette-burgundy-30": "#f3a7b0",
  "--palette-burgundy-50": "#f06674",
  "--palette-burgundy-70": "#b04c5c",
  "--palette-burgundy-100": "#6f2c3f",

  // Palette: Forest
  "--palette-forest-5": "#f4faf5",
  "--palette-forest-10": "#e3f5ea",
  "--palette-forest-30": "#b9e1c8",
  "--palette-forest-50": "#91d6ac",
  "--palette-forest-70": "#5d9b73",
  "--palette-forest-100": "#2b6940",

  // Palette: Ochre
  "--palette-ochre-5": "#f9f4f0",
  "--palette-ochre-10": "#f9ede2",
  "--palette-ochre-30": "#f0d2b6",
  "--palette-ochre-50": "#e7b78a",
  "--palette-ochre-70": "#a9805b",
  "--palette-ochre-100": "#6b492c",

  // Palette: Denim
  "--palette-denim-5": "#eff3f9",
  "--palette-denim-10": "#e2eaf7",
  "--palette-denim-30": "#b5cbee",
  "--palette-denim-50": "#89abe5",
  "--palette-denim-70": "#5a77a8",
  "--palette-denim-100": "#2c436b",

  // Palette: Azure
  "--palette-azure-10": "#cde1f9",
  "--palette-azure-30": "#9ccff2",
  "--palette-azure-70": "#1362ae",
  "--palette-azure-100": "#093e61",

  // Palette: Graphite
  "--palette-graphite-0": "#ffffff",
  "--palette-graphite-5": "#f4f4f4",
  "--palette-graphite-10": "#e5e5e5",
  "--palette-graphite-30": "#b2b2b2",
  "--palette-graphite-50": "#757575",
  "--palette-graphite-70": "#4d4d4d",
  "--palette-graphite-100": "#1a1a1a",

  // Palette: Alpha
  "--palette-dark-alpha-50": "#1a1a1a80",

  // Semantic: side
  "--semantic-page-background": "var(--palette-graphite-0)",
  "--semantic-page-foreground": "var(--palette-graphite-100)",

  // Semantic: status
  "--semantic-danger-background": "var(--palette-burgundy-10)",
  "--semantic-danger-foreground": "#a82e39",
  "--semantic-warning-background": "var(--palette-ochre-10)",
  "--semantic-warning-foreground": "#896508",
  "--semantic-success-background": "var(--palette-forest-10)",
  "--semantic-success-foreground": "#316f2a",

  /**
   * Deaktiverte kontroller. WCAG 1.4.3 unntar inaktive komponenter fra
   * kontrastkravet, men teksten bør fortsatt kunne leses, siden et avslått
   * felt ofte viser innhold brukeren trenger. Bruk den bare på noe som faktisk er
   * slått av; dempet tekst som skal leses bruker `muted-foreground`.
   */
  "--semantic-disabled-background": "var(--palette-graphite-10)",
  "--semantic-disabled-foreground": "var(--palette-graphite-50)",

  /**
   * Dempet tekst som likevel skal leses: hjelpetekst, plassholdere,
   * «(valgfri)»-markeringen, ukedagene i kalenderen. Holder 4,5:1 mot
   * sideflaten i begge temaer.
   */
  "--semantic-muted-foreground": "var(--palette-graphite-50)",

  // Nøytral status: informasjon brukeren skal lese, ikke en avslått
  // kontroll. Derfor mørkere enn disabled: 6,71:1 mot egen bakgrunn.
  "--semantic-neutral-background": "var(--palette-graphite-10)",
  "--semantic-neutral-foreground": "var(--palette-graphite-70)",

  // Semantic: interaktiv
  "--semantic-interactive-background": "var(--palette-azure-10)",
  "--semantic-interactive-main": "var(--palette-azure-70)",
  "--semantic-interactive-foreground": "var(--palette-azure-100)",
  /** Tekst oppå `interactive-main`. Snur med temaet. */
  "--semantic-interactive-contrast": "var(--palette-graphite-0)",
  "--semantic-interactive-visited": "var(--palette-denim-70)",

  // Semantic: skjemafelt
  /**
   * Rammen rundt input, textarea, select og kalenderpanelet.
   *
   * graphite-50, ikke graphite-30. WCAG 1.4.11 krever 3:1 for grafiske
   * avgrensninger, og graphite-30 gir bare 2,12:1 mot hvit flate. Feltet var
   * så vidt synlig for den som ser dårlig.
   */
  "--semantic-field-border": "var(--palette-graphite-50)",
  "--semantic-field-border-hover": "var(--palette-graphite-70)",

  // Semantic: farefylte handlinger
  /**
   * Fylt flate på danger-knappen når den holdes over, med `danger-contrast`
   * som tekst. Før mørknet bakgrunnen mens teksten ble stående, og hover
   * havnet på 3,52:1, altså svakere enn hviletilstanden.
   */
  "--semantic-danger-main": "#a82e39",
  "--semantic-danger-contrast": "var(--palette-graphite-0)",

  // Semantic: skillelinjer
  "--semantic-divider-30": "var(--palette-graphite-30)",
  "--semantic-divider-100": "var(--palette-graphite-100)",

  /** Forstørrelsesglasset i søkefeltet. */
  "--semantic-icon-search":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234d4d4d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='16.5' y1='16.5' x2='21' y2='21'/%3E%3C/svg%3E\")",

  /**
   * Haken og streken i avkryssingsboksen.
   *
   * De tegnes oppå `interactive-main`, og må derfor følge
   * `interactive-contrast`, ikke sideflaten.
   */
  "--semantic-icon-check":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E\")",
  "--semantic-icon-dash":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'%3E%3Cline x1='6' y1='12' x2='18' y2='12'/%3E%3C/svg%3E\")",

  /**
   * Ikonene som tegnes inn i bakgrunnen til dato- og klokkeslettfeltet.
   *
   * De hører hjemme her og ikke i komponenten, fordi en data-URL ikke kan
   * lese en CSS-variabel: streken er malt inn i selve bildet. Med ikonet som
   * token snur det med temaet, som alt annet. Før var streken fast
   * graphite-70, altså 2,03:1 mot den mørke flaten, og så vidt synlig.
   */
  "--semantic-icon-calendar":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234d4d4d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E\")",
  "--semantic-icon-clock":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234d4d4d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpolyline points='12 7 12 12 15 15'/%3E%3C/svg%3E\")",

  /**
   * Flaten bak en dialog som er åpnet med `showModal()`.
   *
   * Den ligger mellom siden og dialogen, og må dempe sideinnholdet i begge
   * temaer. I mørkt tema er en sort flate nesten usynlig mot bakgrunnen, så
   * den er kraftigere der.
   */
  "--semantic-overlay-backdrop": "var(--palette-dark-alpha-50)",

  /**
   * Skyggen under flater som ligger over siden, som kalenderpanelet.
   *
   * Hører til det semantiske laget fordi den må snu med temaet: en svak
   * sort skygge er usynlig mot en nesten sort flate, og panelet mistet
   * dybden si i mørkt tema.
   */
  "--semantic-shadow-overlay": "0 16px 40px rgba(0, 0, 0, 0.12)",

  /**
   * Ringen rundt det som har tastaturfokus.
   *
   * Den sto skrevet ut med bredde og farge i tjue regler fordelt på atten
   * stilark. Selektorene er forskjellige i hver komponent, og `outline-offset`
   * skal være ulik, så det som faktisk gjentok seg var verdien. Da hører den
   * hjemme her.
   *
   * Fargen følger temaet av seg selv, siden den peker på et annet semantisk
   * token. Trenger en komponent en annen farge, som feiloppsummeringen og
   * hopplenken, skriver den `outline-color` etter kortformen og arver
   * bredden.
   */
  "--semantic-focus-ring": "2px solid var(--semantic-interactive-main)",
} as const

export type CssToken = keyof typeof cssTokens

/**
 * Verdiene som overstyres i mørkt tema.
 *
 * Bare det semantiske laget snur. Paletten er råverdier og er den samme i
 * begge temaer. Det er hva fargene *betyr* som endrer seg, ikke hvilke
 * farger som finnes.
 *
 * Alle par er kontrollert mot WCAG AA. Se `tokens.browser.test.ts`.
 */
export const darkTokens = {
  // Side: nær sort flate, dempet hvit tekst
  "--semantic-page-background": "var(--palette-graphite-100)",
  "--semantic-page-foreground": "var(--palette-graphite-5)",

  // Status: mørk flate, lys tekst. Speilvendt av lyst tema.
  "--semantic-danger-background": "var(--palette-burgundy-100)",
  "--semantic-danger-foreground": "var(--palette-burgundy-30)",
  "--semantic-warning-background": "var(--palette-ochre-100)",
  "--semantic-warning-foreground": "var(--palette-ochre-30)",
  "--semantic-success-background": "var(--palette-forest-100)",
  "--semantic-success-foreground": "var(--palette-forest-30)",

  // Deaktivert: graphite-50 på graphite-70 ga 1,83:1 og var uleselig.
  // graphite-30 gir 3,99:1: fortsatt tydelig av, men mulig å lese.
  "--semantic-disabled-background": "var(--palette-graphite-70)",
  "--semantic-disabled-foreground": "var(--palette-graphite-30)",

  // Dempet, lesbar tekst som holder 8,21:1 mot den mørke flaten
  "--semantic-muted-foreground": "var(--palette-graphite-30)",

  // Nøytral status som fortsatt skal leses, og holder 6,71:1
  "--semantic-neutral-background": "var(--palette-graphite-70)",
  "--semantic-neutral-foreground": "var(--palette-graphite-10)",

  // Interaktiv: lys blå på mørk flate, med mørk tekst oppå
  "--semantic-interactive-background": "var(--palette-azure-100)",
  "--semantic-interactive-main": "var(--palette-azure-30)",
  "--semantic-interactive-foreground": "var(--palette-azure-10)",
  "--semantic-interactive-contrast": "var(--palette-graphite-100)",
  "--semantic-interactive-visited": "var(--palette-denim-30)",

  // Skjemafelt: rammen må være lysere enn flaten, ikke mørkere
  "--semantic-field-border": "var(--palette-graphite-50)",
  "--semantic-field-border-hover": "var(--palette-graphite-30)",

  // Farefylte handlinger
  "--semantic-danger-main": "var(--palette-burgundy-30)",
  "--semantic-danger-contrast": "var(--palette-graphite-100)",

  // Skillelinjer
  "--semantic-divider-30": "var(--palette-graphite-70)",
  "--semantic-divider-100": "var(--palette-graphite-30)",

  "--semantic-icon-search":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23b2b2b2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='16.5' y1='16.5' x2='21' y2='21'/%3E%3C/svg%3E\")",

  // Hake og strek ligger oppå interactive-main, som er lys i mørkt tema
  "--semantic-icon-check":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a1a1a' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E\")",
  "--semantic-icon-dash":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a1a1a' stroke-width='3' stroke-linecap='round'%3E%3Cline x1='6' y1='12' x2='18' y2='12'/%3E%3C/svg%3E\")",

  // Ikoner: lysere strek, så de holder seg synlige mot den mørke flaten
  "--semantic-icon-calendar":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23b2b2b2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E\")",
  "--semantic-icon-clock":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23b2b2b2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpolyline points='12 7 12 12 15 15'/%3E%3C/svg%3E\")",

  // Flaten bak en dialog må dempe mer når siden under alt er mørk
  "--semantic-overlay-backdrop": "rgba(0, 0, 0, 0.72)",

  // Skygge: kraftigere, siden flaten under er nesten sort
  "--semantic-shadow-overlay": "0 16px 40px rgba(0, 0, 0, 0.6)",
} as const satisfies Partial<Record<CssToken, string>>

export type DarkToken = keyof typeof darkTokens
