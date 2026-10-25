// Generert av scripts/generate-matrise.ts fra kjernen og fargekontrakt.json. Ikke rediger.

/** Familiene Fristil leverer selv. En konsument kan ha andre. */
export const FAMILIES = ["accent","visited","brand1","brand2","brand3","neutral","danger","warning","success"] as const

export type Family = (typeof FAMILIES)[number]

/** Fristils egne merkefarger. */
export const FRISTIL_BRANDS: Record<Family, string> = {
  "accent": "#1362ae",
  "visited": "#5a77a8",
  "brand1": "#0d7a5f",
  "brand2": "#5b3fa0",
  "brand3": "#b04c5c",
  "neutral": "#24272b",
  "danger": "#a82e39",
  "warning": "#896508",
  "success": "#316f2a"
}

/** En rolle er en jobb en farge gjør, og den er lik i hver familie. */
export type Role = "surface" | "borderSubtle" | "border" | "borderStrong" | "fill" | "text" | "textStrong" | "textSubtle" | "content"

/** Lyst eller mørkt. Et tema er det ene eller det andre, aldri begge. */
export type Appearance = "light" | "dark"

type Spec = { lightness: Record<Appearance, number>; chroma: number }

/** Lyshet og metningsandel per rolle, i hvert utseende. */
export const ROLES: Record<Role, Spec> = {
  "surface": {
    "lightness": {
      "light": 0.96,
      "dark": 0.26
    },
    "chroma": 0.22
  },
  "borderSubtle": {
    "lightness": {
      "light": 0.88,
      "dark": 0.34
    },
    "chroma": 0.35
  },
  "border": {
    "lightness": {
      "light": 0.575,
      "dark": 0.625
    },
    "chroma": 0.55
  },
  "borderStrong": {
    "lightness": {
      "light": 0.48,
      "dark": 0.74
    },
    "chroma": 0.6
  },
  "fill": {
    "lightness": {
      "light": 0.53,
      "dark": 0.65
    },
    "chroma": 1
  },
  "text": {
    "lightness": {
      "light": 0.42,
      "dark": 0.82
    },
    "chroma": 0.85
  },
  "textStrong": {
    "lightness": {
      "light": 0.28,
      "dark": 0.93
    },
    "chroma": 0.5
  },
  "textSubtle": {
    "lightness": {
      "light": 0.485,
      "dark": 0.73
    },
    "chroma": 0.7
  },
  "content": {
    "lightness": {
      "light": 0.99,
      "dark": 0.16
    },
    "chroma": 0.04
  }
}

/** Siden og den hevede flaten, som bare den nøytrale familien har. */
export const NEUTRAL_LAYERS: Record<"canvas" | "raised", Spec> = {
  "canvas": {
    "lightness": {
      "light": 1,
      "dark": 0.18
    },
    "chroma": 0.08
  },
  "raised": {
    "lightness": {
      "light": 0.92,
      "dark": 0.32
    },
    "chroma": 0.12
  }
}

/** Kontrastkravene, med margin over WCAG. Tekst er 4,5 og grafikk er 3. */
export const REQUIREMENT = {"text":4.6,"graphic":3.1} as const

/** Hvert navn matrisen sender ut. */
export type MatrixToken =
  | "--fs-color-accent-surface"
  | "--fs-color-accent-border-subtle"
  | "--fs-color-accent-border"
  | "--fs-color-accent-border-strong"
  | "--fs-color-accent-fill"
  | "--fs-color-accent-text"
  | "--fs-color-accent-text-strong"
  | "--fs-color-accent-text-subtle"
  | "--fs-color-accent-content"
  | "--fs-color-visited-surface"
  | "--fs-color-visited-border-subtle"
  | "--fs-color-visited-border"
  | "--fs-color-visited-border-strong"
  | "--fs-color-visited-fill"
  | "--fs-color-visited-text"
  | "--fs-color-visited-text-strong"
  | "--fs-color-visited-text-subtle"
  | "--fs-color-visited-content"
  | "--fs-color-brand1-surface"
  | "--fs-color-brand1-border-subtle"
  | "--fs-color-brand1-border"
  | "--fs-color-brand1-border-strong"
  | "--fs-color-brand1-fill"
  | "--fs-color-brand1-text"
  | "--fs-color-brand1-text-strong"
  | "--fs-color-brand1-text-subtle"
  | "--fs-color-brand1-content"
  | "--fs-color-brand2-surface"
  | "--fs-color-brand2-border-subtle"
  | "--fs-color-brand2-border"
  | "--fs-color-brand2-border-strong"
  | "--fs-color-brand2-fill"
  | "--fs-color-brand2-text"
  | "--fs-color-brand2-text-strong"
  | "--fs-color-brand2-text-subtle"
  | "--fs-color-brand2-content"
  | "--fs-color-brand3-surface"
  | "--fs-color-brand3-border-subtle"
  | "--fs-color-brand3-border"
  | "--fs-color-brand3-border-strong"
  | "--fs-color-brand3-fill"
  | "--fs-color-brand3-text"
  | "--fs-color-brand3-text-strong"
  | "--fs-color-brand3-text-subtle"
  | "--fs-color-brand3-content"
  | "--fs-color-neutral-surface"
  | "--fs-color-neutral-border-subtle"
  | "--fs-color-neutral-border"
  | "--fs-color-neutral-border-strong"
  | "--fs-color-neutral-fill"
  | "--fs-color-neutral-text"
  | "--fs-color-neutral-text-strong"
  | "--fs-color-neutral-text-subtle"
  | "--fs-color-neutral-content"
  | "--fs-color-danger-surface"
  | "--fs-color-danger-border-subtle"
  | "--fs-color-danger-border"
  | "--fs-color-danger-border-strong"
  | "--fs-color-danger-fill"
  | "--fs-color-danger-text"
  | "--fs-color-danger-text-strong"
  | "--fs-color-danger-text-subtle"
  | "--fs-color-danger-content"
  | "--fs-color-warning-surface"
  | "--fs-color-warning-border-subtle"
  | "--fs-color-warning-border"
  | "--fs-color-warning-border-strong"
  | "--fs-color-warning-fill"
  | "--fs-color-warning-text"
  | "--fs-color-warning-text-strong"
  | "--fs-color-warning-text-subtle"
  | "--fs-color-warning-content"
  | "--fs-color-success-surface"
  | "--fs-color-success-border-subtle"
  | "--fs-color-success-border"
  | "--fs-color-success-border-strong"
  | "--fs-color-success-fill"
  | "--fs-color-success-text"
  | "--fs-color-success-text-strong"
  | "--fs-color-success-text-subtle"
  | "--fs-color-success-content"
  | "--fs-color-neutral-canvas"
  | "--fs-color-neutral-raised"

/** Fristils egne farger i lyst tema. */
export const lightCells: Record<MatrixToken, string> = {
  "--fs-color-accent-surface": "#e9f3ff",
  "--fs-color-accent-border-subtle": "#c1daf8",
  "--fs-color-accent-border": "#577ca6",
  "--fs-color-accent-border-strong": "#39608c",
  "--fs-color-accent-fill": "#226dba",
  "--fs-color-accent-text": "#0d4e8c",
  "--fs-color-accent-text-strong": "#0b2a4a",
  "--fs-color-accent-text-subtle": "#336195",
  "--fs-color-accent-content": "#f9fcff",
  "--fs-color-visited-surface": "#ebf2ff",
  "--fs-color-visited-border-subtle": "#cdd8eb",
  "--fs-color-visited-border": "#697a95",
  "--fs-color-visited-border-strong": "#4d5e7a",
  "--fs-color-visited-fill": "#4f6c9c",
  "--fs-color-visited-text": "#364d74",
  "--fs-color-visited-text-strong": "#1d293e",
  "--fs-color-visited-text-subtle": "#4c6080",
  "--fs-color-visited-content": "#fafcfe",
  "--fs-color-brand1-surface": "#e4f7ef",
  "--fs-color-brand1-border-subtle": "#c2dfd4",
  "--fs-color-brand1-border": "#578474",
  "--fs-color-brand1-border-strong": "#386958",
  "--fs-color-brand1-fill": "#157e63",
  "--fs-color-brand1-text": "#005b46",
  "--fs-color-brand1-text-strong": "#073125",
  "--fs-color-brand1-text-subtle": "#316c59",
  "--fs-color-brand1-content": "#f9fdfb",
  "--fs-color-brand2-surface": "#f2efff",
  "--fs-color-brand2-border-subtle": "#d8d2f8",
  "--fs-color-brand2-border": "#7a70a6",
  "--fs-color-brand2-border-strong": "#5f538c",
  "--fs-color-brand2-fill": "#7156ba",
  "--fs-color-brand2-text": "#513b8b",
  "--fs-color-brand2-text-strong": "#2b204a",
  "--fs-color-brand2-text-subtle": "#625295",
  "--fs-color-brand2-content": "#fcfbff",
  "--fs-color-brand3-surface": "#ffecee",
  "--fs-color-brand3-border-subtle": "#f4cccf",
  "--fs-color-brand3-border": "#9f676d",
  "--fs-color-brand3-border-strong": "#844a51",
  "--fs-color-brand3-fill": "#a94656",
  "--fs-color-brand3-text": "#7e2e3c",
  "--fs-color-brand3-text-strong": "#431920",
  "--fs-color-brand3-text-subtle": "#8b4750",
  "--fs-color-brand3-content": "#fffafb",
  "--fs-color-neutral-surface": "#f1f2f3",
  "--fs-color-neutral-border-subtle": "#d6d7d9",
  "--fs-color-neutral-border": "#77797c",
  "--fs-color-neutral-border-strong": "#5c5e60",
  "--fs-color-neutral-fill": "#696c71",
  "--fs-color-neutral-text": "#4a4d51",
  "--fs-color-neutral-text-strong": "#27292b",
  "--fs-color-neutral-text-subtle": "#5d5f62",
  "--fs-color-neutral-content": "#fbfcfc",
  "--fs-color-danger-surface": "#ffedec",
  "--fs-color-danger-border-subtle": "#facac8",
  "--fs-color-danger-border": "#a66363",
  "--fs-color-danger-border-strong": "#8b4647",
  "--fs-color-danger-fill": "#b53b43",
  "--fs-color-danger-text": "#87232c",
  "--fs-color-danger-text-strong": "#481518",
  "--fs-color-danger-text-subtle": "#934244",
  "--fs-color-danger-content": "#fffafa",
  "--fs-color-warning-surface": "#f9f1e1",
  "--fs-color-warning-border-subtle": "#e3d6bc",
  "--fs-color-warning-border": "#8a7650",
  "--fs-color-warning-border-strong": "#6f5a31",
  "--fs-color-warning-fill": "#896508",
  "--fs-color-warning-text": "#644800",
  "--fs-color-warning-text-strong": "#352604",
  "--fs-color-warning-text-subtle": "#735b29",
  "--fs-color-warning-content": "#fdfcf9",
  "--fs-color-success-surface": "#e8f7e6",
  "--fs-color-success-border-subtle": "#c9dfc5",
  "--fs-color-success-border": "#63835e",
  "--fs-color-success-border-strong": "#466841",
  "--fs-color-success-fill": "#3f7d37",
  "--fs-color-success-text": "#285a22",
  "--fs-color-success-text-strong": "#163013",
  "--fs-color-success-text-subtle": "#426b3d",
  "--fs-color-success-content": "#fafdfa",
  "--fs-color-neutral-canvas": "#ffffff",
  "--fs-color-neutral-raised": "#e4e4e5"
}

/** Fristils egne farger i mørkt tema. */
export const darkCells: Record<MatrixToken, string> = {
  "--fs-color-accent-surface": "#192533",
  "--fs-color-accent-border-subtle": "#253951",
  "--fs-color-accent-border": "#668bb6",
  "--fs-color-accent-border-strong": "#85aedf",
  "--fs-color-accent-fill": "#4992e2",
  "--fs-color-accent-text": "#99c8ff",
  "--fs-color-accent-text-strong": "#d8eaff",
  "--fs-color-accent-text-subtle": "#7aabe4",
  "--fs-color-accent-content": "#0c0d10",
  "--fs-color-visited-surface": "#1f242d",
  "--fs-color-visited-border-subtle": "#2f3847",
  "--fs-color-visited-border": "#7888a4",
  "--fs-color-visited-border-strong": "#99accb",
  "--fs-color-visited-fill": "#7290c2",
  "--fs-color-visited-text": "#aac5f3",
  "--fs-color-visited-text-strong": "#dbe9ff",
  "--fs-color-visited-text-subtle": "#93a9cd",
  "--fs-color-visited-content": "#0c0d0f",
  "--fs-color-brand1-surface": "#192822",
  "--fs-color-brand1-border-subtle": "#253e35",
  "--fs-color-brand1-border": "#669382",
  "--fs-color-brand1-border-strong": "#85b7a5",
  "--fs-color-brand1-fill": "#45a386",
  "--fs-color-brand1-text": "#8bd6bc",
  "--fs-color-brand1-text-strong": "#c8f3e3",
  "--fs-color-brand1-text-subtle": "#7bb6a1",
  "--fs-color-brand1-content": "#0c0e0d",
  "--fs-color-brand2-surface": "#242133",
  "--fs-color-brand2-border-subtle": "#393351",
  "--fs-color-brand2-border": "#897eb6",
  "--fs-color-brand2-border-strong": "#aca0df",
  "--fs-color-brand2-fill": "#937be2",
  "--fs-color-brand2-text": "#c6b8ff",
  "--fs-color-brand2-text-strong": "#e8e4ff",
  "--fs-color-brand2-text-subtle": "#aa9be4",
  "--fs-color-brand2-content": "#0d0d10",
  "--fs-color-brand3-surface": "#311e20",
  "--fs-color-brand3-border-subtle": "#4d2e31",
  "--fs-color-brand3-border": "#af767c",
  "--fs-color-brand3-border-strong": "#d7979d",
  "--fs-color-brand3-fill": "#d26a79",
  "--fs-color-brand3-text": "#ffa8b1",
  "--fs-color-brand3-text-strong": "#ffdee1",
  "--fs-color-brand3-text-subtle": "#db9098",
  "--fs-color-brand3-content": "#0f0c0d",
  "--fs-color-neutral-surface": "#232425",
  "--fs-color-neutral-border-subtle": "#373839",
  "--fs-color-neutral-border": "#86888a",
  "--fs-color-neutral-border-strong": "#a9abae",
  "--fs-color-neutral-fill": "#8c8f94",
  "--fs-color-neutral-text": "#c1c4c9",
  "--fs-color-neutral-text-strong": "#e6e8eb",
  "--fs-color-neutral-text-subtle": "#a5a8ab",
  "--fs-color-neutral-content": "#0d0d0d",
  "--fs-color-danger-surface": "#331d1d",
  "--fs-color-danger-border-subtle": "#512c2c",
  "--fs-color-danger-border": "#b67271",
  "--fs-color-danger-border-strong": "#e09392",
  "--fs-color-danger-fill": "#df6165",
  "--fs-color-danger-text": "#ffa9a8",
  "--fs-color-danger-text-strong": "#ffdfde",
  "--fs-color-danger-text-subtle": "#e58b8a",
  "--fs-color-danger-content": "#100c0c",
  "--fs-color-warning-surface": "#292317",
  "--fs-color-warning-border-subtle": "#413621",
  "--fs-color-warning-border": "#99855f",
  "--fs-color-warning-border-strong": "#bea87d",
  "--fs-color-warning-fill": "#ae893a",
  "--fs-color-warning-text": "#e0bf7f",
  "--fs-color-warning-text-strong": "#f9e6c0",
  "--fs-color-warning-text-subtle": "#bea471",
  "--fs-color-warning-content": "#0e0d0b",
  "--fs-color-success-surface": "#1d271b",
  "--fs-color-success-border-subtle": "#2b3e29",
  "--fs-color-success-border": "#71926d",
  "--fs-color-success-border-strong": "#91b78c",
  "--fs-color-success-fill": "#62a15b",
  "--fs-color-success-text": "#9ed597",
  "--fs-color-success-text-strong": "#d2f3cd",
  "--fs-color-success-text-subtle": "#8ab684",
  "--fs-color-success-content": "#0c0e0c",
  "--fs-color-neutral-canvas": "#111212",
  "--fs-color-neutral-raised": "#323333"
}
