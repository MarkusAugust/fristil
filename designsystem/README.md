# @fristil/designsystem

Design tokens og komponenter for Fristil designsystem.

---

## Kom i gang

```bash
npm install @fristil/designsystem
```

Importer tokens i rot-CSS eller `<head>`:

```html
<link rel="stylesheet" href="node_modules/@fristil/designsystem/tokens.css" />
```

Eller via bundler:

```js
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/utilities.css" // valgfritt: .link, .srOnly
```

---

## Legge til en ny komponent

### pure-css — Plain CSS-klasse

Bruk dette for enkle, stateless elementer: knapper, badges, typografi, input-styling.

**1. Opprett CSS-fil i `src/designsystem/pure-css/my-component/`:**

```css
/* src/designsystem/pure-css/my-component/my-component.css */
.ds-my-component {
  color: var(--semantic-page-foreground);
  padding: var(--size-2) var(--size-4);
  font-size: var(--font-size-m);
}

.ds-my-component[data-variant="primary"] {
  background: var(--semantic-interactive-main);
  color: var(--palette-graphite-0);
}
```

**2. Legg til eksport i `package.json`:**

```json
"./my-component.css": "./src/designsystem/pure-css/my-component/my-component.css"
```

**Bruk hos konsument:**

```html
<link rel="stylesheet" href="@fristil/designsystem/my-component.css" />
<div class="ds-my-component" data-variant="primary">Innhold</div>
```

Ingen JavaScript. Ingen import. Bare CSS.

---

### light-dom — Light DOM Web Component (Lit)

Bruk dette for elementer som trenger logikk, slots eller automatisk a11y — men der native `<input>` og CSS-klasser fra pure-css skal fungere inne i komponenten.

Light DOM betyr at komponentens HTML havner i den vanlige DOM-en. Tokens på `:root` er synlige uten noe ekstra.

**1. Opprett TypeScript-fil i `src/designsystem/light-dom/my-wrapper/`:**

```ts
// src/designsystem/light-dom/my-wrapper/ds-my-wrapper.ts
import { LitElement, html } from "lit"
import { customElement, property } from "lit/decorators.js"

@customElement("ds-my-wrapper")
export class DsMyWrapper extends LitElement {
  // Light DOM: overstyrer createRenderRoot
  override createRenderRoot() {
    return this
  }

  @property() label?: string

  render() {
    return html`
      <div class="ds-my-wrapper">
        ${this.label ? html`<span class="ds-my-wrapper__label">${this.label}</span>` : ""}
        <slot></slot>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ds-my-wrapper": DsMyWrapper
  }
}
```

**2. Eksporter fra `src/index.ts`:**

```ts
export * from "./ds-my-wrapper.js"
```

**3. Legg til CSS-fil for styling (samme som pure-css):**

```css
/* src/designsystem/pure-css/my-wrapper/my-wrapper.css */
.ds-my-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--size-2);
}
```

**Bruk hos konsument:**

```html
<script type="module" src="@fristil/designsystem"></script>

<ds-my-wrapper label="E-post">
  <input class="ds-input" type="email" />
</ds-my-wrapper>
```

---

### shadow-dom — Shadow DOM Web Component (Lit)

Bruk dette for visuelt isolerte, komplekse interaktive komponenter: datepicker, modal, tooltip.

Shadow DOM isolerer stilene. CSS custom properties **piercer** Shadow DOM automatisk — tokens fra `:root` fungerer inne i komponenten via `var()` i `css\`\``.

**1. Opprett TypeScript-fil i `src/designsystem/shadow-dom/my-widget/`:**

```ts
// src/designsystem/shadow-dom/my-widget/ds-my-widget.ts
import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"

@customElement("ds-my-widget")
export class DsMyWidget extends LitElement {
  // Shadow DOM: IKKE overstyr createRenderRoot

  // css`` henter tokens fra :root via CSS custom property inheritance
  static styles = css`
    :host {
      display: block;
      background: var(--semantic-page-background);
      border: 1px solid var(--semantic-divider-30);
      padding: var(--size-4);
      font-size: var(--font-size-m);
      border-radius: var(--size-1);
    }

    :host([hidden]) {
      display: none;
    }
  `

  @property({ type: Boolean }) open = false

  render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ds-my-widget": DsMyWidget
  }
}
```

**2. Eksporter fra `src/index.ts`:**

```ts
export * from "./ds-my-widget.js"
```

**Bruk hos konsument:**

```html
<ds-my-widget open>Innhold</ds-my-widget>
```

**Bruk i Astro docs** (`client:only` er påkrevd for alle Lit-komponenter):

```astro
<ds-my-widget client:only="lit" open>Innhold</ds-my-widget>
```

---

## Tilgjengelige tokens

```js
import "@fristil/designsystem/tokens.css"        // CSS custom properties (:root)
import "@fristil/designsystem/utilities.css"     // .link, .srOnly

import { cssTokens, type CssToken } from "@fristil/designsystem/tokens"
import { Breakpoints, Containers } from "@fristil/designsystem/tokens"
import { fristilPreset } from "@fristil/designsystem/tailwind" // Tailwind v3 preset
```

Se `src/tokens/tokens.ts` for alle tilgjengelige CSS custom properties.
