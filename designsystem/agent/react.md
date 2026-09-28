# Fristil i React

Regelboka for Fristil i en React-app.

React skiller seg fra alle de andre miljøene på én ting, og den er viktig nok
til å ha sin egen fil: React skriver om attributtnavnene. `class` heter
`className` og `for` heter `htmlFor`, og bruker du byggerne fra hovedinngangen
skriver React «Invalid DOM property» i konsollen for hvert element. Derfor har
pakken en egen React-inngang.

Dette er @fristil/designsystem 0.19.0. Fila er generert av pakken og følger
versjonen, så den kan aldri stå og si noe annet enn koden ved siden av.

## Kortversjon

1. **Importer stilarkene i `main.tsx`**, `tokens.css` først. Mangler de, ser
   komponentene ustilte ut. Svaret er da å legge inn importen, aldri å skrive
   egen CSS for å få dem til å se riktige ut.
2. **Bruk bare klassene og elementene i tabellene under.** `fs-modal`,
   `fs-datepicker` og `data-variant="outline"` finnes i andre designsystemer,
   ikke i Fristil. Er du usikker på om noe finnes, står det her eller så gjør
   det ikke det.
3. **Ingen hardkodede farger eller piksler.** `var(--semantic-…)` og
   `var(--size-…)`. Paletten (`--palette-…`) er råverdier og brukes ikke
   direkte.
4. **`defineFs*()` kjøres øverst i `main.tsx`,** ikke i en `useEffect`, og et
   boolsk attributt settes som `invalid={ugyldig || undefined}`. De to andre
   skrivemåtene er feil i én av React-versjonene hver.
5. **Typene er sjekken din.** Importer `@fristil/designsystem/react-jsx` én
   gang i en `.d.ts`-fil, og en variant som ikke finnes stopper bygget. Kjør
   `tsc`. Har prosjektet også HTML eller maler, sjekkes de med
   `npx @fristil/designsystem sjekk <fil>`.

## 1. Stilarkene

`tokens.css` definerer alle variablene, og alle de andre stilarkene bygger på
den. Den lastes derfor først. Deretter ett per komponent du bruker:

```tsx
// main.tsx, øverst
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/field.css"
import "@fristil/designsystem/button.css"
```

Navnet på hvert stilark står i tabellene under.

## 2. Hva som finnes

33 CSS-komponenter og 9 egendefinerte elementer, og dette er hele lista.
Klassene er `fs-` + kebab-case. Varianter er alltid `data-*`-attributter,
aldri egne klasser: `data-variant="secondary"`, ikke `fs-button--secondary`.
Standardvarianten har ingen attributt.

### CSS-komponenter (ingen JavaScript)

| Klasse | Stilark | Attributter |
| --- | --- | --- |
| `fs-accordion`<br>`fs-accordion__content` | `accordion.css` | `data-variant`: plain |
| `fs-alert`<br>`fs-alert__title` | `alert.css` | `data-color`: info, success, warning, danger |
| `fs-avatar`<br>`fs-avatar-stack` | `avatar.css` | `data-variant`: square<br>`data-size`: small, large |
| `fs-badge` | `badge.css` | `data-color`: success, warning, danger, neutral |
| `fs-breadcrumbs` | `breadcrumbs.css` | ingen |
| `fs-button` | `button.css` | `data-variant`: secondary, ghost, danger |
| `fs-card`<br>`fs-card__title` | `card.css` | `data-variant`: filled |
| `fs-checkbox`<br>`fs-checkbox-row` | `checkbox.css` | `data-state`: invalid, success |
| `fs-divider` | `divider.css` | `data-variant`: subtle, strong |
| `fs-error-text` | `error-text.css` | `data-variant`: warning |
| `fs-fieldset`<br>`fs-legend` | `fieldset.css` | `data-state`: invalid, success<br>`data-required`: symbol, text |
| `fs-file-upload`<br>`fs-file-upload-list` | `file-upload.css` | `data-state`: invalid, success |
| `fs-heading` | `heading.css` | `data-size`: xs, s, m, xl, mega |
| `fs-help-text` | `help-text.css` | `data-variant`: default, success, warning |
| `fs-input` | `input.css` | `data-state`: invalid, success<br>`data-variant`: date, datetime-local, time |
| `fs-label` | `label.css` | `data-required`: symbol, text |
| `fs-link` | `link.css` | ingen |
| `fs-list` | `list.css` | `data-variant`: plain, divided |
| `fs-pagination`<br>`fs-pagination__gap` | `pagination.css` | ingen |
| `fs-paragraph` | `paragraph.css` | `data-variant`: lead<br>`data-size`: small, large |
| `fs-radio`<br>`fs-radio-row` | `radio.css` | `data-state`: invalid, success |
| `fs-search`<br>`fs-search-row` | `search.css` | `data-state`: invalid, success |
| `fs-select` | `select.css` | `data-state`: invalid, success<br>`data-picker`: styled |
| `fs-skeleton` | `skeleton.css` | `data-variant`: text, circle |
| `fs-skip-link` | `skip-link.css` | ingen |
| `fs-spinner` | `spinner.css` | `data-size`: small, large |
| `fs-sr-only` | `sr-only.css` | ingen |
| `fs-switch`<br>`fs-switch-row` | `switch.css` | ingen |
| `fs-table`<br>`fs-table-scroll` | `table.css` | `data-variant`: striped |
| `fs-tag` | `tag.css` | `data-variant`: filled |
| `fs-textarea` | `textarea.css` | `data-state`: invalid, success |
| `fs-toggle-group`<br>`fs-toggle-group__option` | `toggle-group.css` | ingen |
| `fs-tooltip`<br>`fs-tooltip__bubble` | `tooltip.css` | ingen |

## 3. Tokens

To lag. `--palette-…` er råfarger og brukes ikke direkte. `--semantic-…` sier
hva fargen betyr, peker på en palettfarge, og er det du skal bruke. Da følger
markupen med når paletten justeres eller konsumenten lager sitt eget tema.

```
--semantic-danger-background      --semantic-danger-contrast
--semantic-danger-foreground      --semantic-danger-main
--semantic-disabled-background    --semantic-disabled-foreground
--semantic-divider-100            --semantic-divider-30
--semantic-field-border           --semantic-field-border-hover
--semantic-focus-ring             --semantic-icon-calendar
--semantic-icon-check             --semantic-icon-clock
--semantic-icon-dash              --semantic-icon-search
--semantic-interactive-background --semantic-interactive-contrast
--semantic-interactive-foreground --semantic-interactive-main
--semantic-interactive-visited    --semantic-muted-foreground
--semantic-neutral-background     --semantic-neutral-foreground
--semantic-overlay-backdrop       --semantic-page-background
--semantic-page-foreground        --semantic-shadow-overlay
--semantic-size-default           --semantic-spacing-default
--semantic-success-background     --semantic-success-foreground
--semantic-warning-background     --semantic-warning-foreground
```

Mål: `--size-0-5`, `--size-1`, `--size-10`, `--size-12`, `--size-16`,
`--size-2`, `--size-3`, `--size-4`, `--size-5`, `--size-6`, `--size-7`,
`--size-8`, `--size-px`.

Skrift: `--font-size-l`, `--font-size-m`, `--font-size-mega`,
`--font-size-reference`, `--font-size-s`, `--font-size-xl`, `--font-size-xs`,
`--font-size-xxl`, `--font-size-xxs`, `--font-weight-bold`,
`--font-weight-medium`, `--font-weight-regular`, `--font-weight-semibold`.

Linjehøyde: `--semantic-line-height-article`,
`--semantic-line-height-compact`, `--semantic-line-height-default`,
`--semantic-line-height-heading`.

`disabled` og `neutral` er ikke det samme. `disabled` er for kontroller som er
slått av, og er unntatt kontrastkravet i WCAG 1.4.3. `neutral` er for dempet
informasjon brukeren faktisk skal lese eller trykke på, og holder 4,5:1. Bruk
aldri `disabled`-fargene for å dempe noe som skal leses.

## 4. Web components

Tre regler gjelder alle sammen:

1. **`defineFs*()` kjøres én gang** øverst i modulen, før `createRoot`, ikke i
   en `useEffect`. Importen har ingen bivirkning alene; det er `define`-kallet
   som registrerer elementet.
2. **Boolske attributter er sanne så lenge de finnes.** `invalid="false"`,
   `disabled="false"` og `open="false"` slår *på*. Skal noe av det bort, må
   attributtet fjernes helt.
3. **Du skriver markupen, komponenten fester oppførselen.** `<fs-field>` lager
   ikke ledeteksten eller kontrollen din. Den kobler sammen dem du har lagt
   inn, med `id`, `for` og `aria-describedby`. Et `<fs-field>` uten kontroll,
   eller uten ledetekst, er en feil komponenten melder fra om.

| Element | Kategori | Stilark | Registrering | Attributter | Klasser inni |
| --- | --- | --- | --- | --- | --- |
| `<fs-field>` | ramme | `field.css` | `defineFsField()` fra `@fristil/designsystem/field` | `invalid` (flag)<br>`disabled` (flag)<br>`optional` (flag)<br>`required-marker`: symbol, text, none<br>`control-id` (text)<br>`described-by` (text) | ingen |
| `<fs-tabs>` | ramme | `tabs.css` | `defineFsTabs()` fra `@fristil/designsystem/tabs` | `server-controlled` (flag) | `fs-tabs__list`<br>`fs-tabs__panel` |
| `<fs-error-summary>` | ramme | `error-summary.css` | `defineFsErrorSummary()` fra `@fristil/designsystem/error-summary` | `data-autofocus`: false<br>`hidden` (flag) | `fs-error-summary`<br>`fs-error-summary__title` |
| `<fs-popover>` | ramme | `popover.css` | `defineFsPopover()` fra `@fristil/designsystem/popover` | `open` (flag)<br>`placement`: bottom-start, bottom-end, top-start, top-end<br>`server-controlled` (flag) | `fs-popover` |
| `<fs-suggestion>` | ramme | `suggestion.css` | `defineFsSuggestion()` fra `@fristil/designsystem/suggestion` | `prefiltered` (flag)<br>`server-controlled` (flag) | `fs-suggestion__field`<br>`fs-suggestion__list`<br>`fs-suggestion__option`<br>`fs-suggestion__empty` |
| `<fs-dialog>` | ramme | `dialog.css` | `defineFsDialog()` fra `@fristil/designsystem/dialog` | `open` (flag)<br>`server-controlled` (flag) | `fs-dialog`<br>`fs-dialog__body`<br>`fs-dialog__title`<br>`fs-dialog__footer`<br>`fs-dialog__header`<br>`fs-dialog__subtitle` |
| `<fs-toast>` | frittstaende | `toast.css` | `defineFsToast()` fra `@fristil/designsystem/toast` | `duration` (number)<br>`label` (text) | `fs-toast`<br>`fs-toast__close` |
| `<fs-session-timeout>` | frittstaende | `session-timeout.css` | `defineFsSessionTimeout()` fra `@fristil/designsystem/session-timeout` | `warn-at` (number)<br>`expires-at` (number) | `fs-session-timeout`<br>`fs-session-timeout__dialog`<br>`fs-session-timeout__title`<br>`fs-session-timeout__text`<br>`fs-session-timeout__count`<br>`fs-session-timeout__actions` |
| `<fs-connection-status>` | frittstaende | `connection-status.css` | `defineFsConnectionStatus()` fra `@fristil/designsystem/connection-status` | `offline-text` (text)<br>`online-text` (text) | `fs-connection-status`<br>`fs-connection-status__bar` |

Ingen av dem bruker shadow DOM. Innholdet står i vanlig DOM, så
`querySelector`, `FormData` og vanlig CSS virker rett inn i det.

## 5. Registrering, typer og bruk

```tsx
// main.tsx, kjøres én gang når appen starter
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/field.css"
import { defineFsField } from "@fristil/designsystem/field"

defineFsField()
```

Kallet står øverst i modulen, ikke i en `useEffect`. En effekt kjører etter
første tegning, så elementene er vanlige `HTMLElement` i det React tegner dem,
og et kall på `show()` eller `reportFailure()` før effekten feiler med «is not
a function». Funksjonen gjør ingenting på en server, så den kan stå i en
rotmodul som kjøres begge steder. Skal alt registreres, finnes `defineFs()` i
`@fristil/designsystem/register`.

```ts
// src/fristil.d.ts, gir <fs-field> typer i JSX
import "@fristil/designsystem/react-jsx"
```

```tsx
// Kontaktskjema.tsx
import { fs } from "@fristil/designsystem/react"
import { useState } from "react"

export function Kontaktskjema() {
  const [navn, setNavn] = useState("")
  const [berørt, setBerørt] = useState(false)

  const ugyldig = berørt && navn.trim() === ""

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <fs-field required-marker="symbol" invalid={ugyldig || undefined}>
        <label>Fullt navn</label>
        <input
          {...fs.input({ type: "text" })}
          name="navn"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          onBlur={() => setBerørt(true)}
        />
        <p {...fs.errorText()}>Fyll inn navnet ditt.</p>
      </fs-field>

      <button {...fs.button()} type="submit">Send</button>
    </form>
  )
}
```

`fs` importeres fra `@fristil/designsystem/react`, aldri fra hovedinngangen:
React-inngangen gir `className` og `htmlFor`, hovedinngangen gir `class` og
`for`. De 43 byggerne finnes i begge:

`fs.accordion()`, `fs.alert()`, `fs.avatar()`, `fs.badge()`,
`fs.breadcrumbs()`, `fs.button()`, `fs.card()`, `fs.checkbox()`,
`fs.connectionStatus()`, `fs.dialog()`, `fs.divider()`, `fs.errorSummary()`,
`fs.errorText()`, `fs.field()`, `fs.fieldset()`, `fs.fileUpload()`,
`fs.heading()`, `fs.helpText()`, `fs.input()`, `fs.label()`, `fs.legend()`,
`fs.link()`, `fs.list()`, `fs.pagination()`, `fs.paragraph()`, `fs.popover()`,
`fs.radio()`, `fs.search()`, `fs.select()`, `fs.sessionTimeout()`,
`fs.skeleton()`, `fs.skipLink()`, `fs.spinner()`, `fs.srOnly()`,
`fs.suggestion()`, `fs.switch()`, `fs.table()`, `fs.tabs()`, `fs.tag()`,
`fs.textarea()`, `fs.toast()`, `fs.toggleGroup()`, `fs.tooltip()`

## 6. Bare `invalid={ugyldig || undefined}` virker

React behandler egendefinerte elementer ulikt mellom versjoner, og bare dette
mønsteret er riktig i begge:

| Skrivemåte | React 18 (setter attributt) | React 19 (setter egenskap) |
| --- | --- | --- |
| `invalid=""` | virker | aldri ugyldig |
| `invalid={ugyldig}` | alltid ugyldig | virker |
| `invalid={ugyldig \|\| undefined}` | virker | virker |

React 18 stringifiserer `false` til attributtet `invalid="false"`. Attributtet
finnes da, og er dermed sant. React 19 setter egenskapen til `""`, som er
usann.

Importerer du `@fristil/designsystem/react-jsx`, blir de to andre variantene
kompileringsfeil.

## 7. Typene

Uten `@fristil/designsystem/react-jsx` kjenner ikke TypeScript `<fs-field>` i
det hele tatt, og du får
`Property 'fs-field' does not exist on type 'JSX.IntrinsicElements'`. Med den
får du autofullføring og feil på attributtene:

```tsx
<fs-field required-marker="tekst" />     // feil: "none" | "symbol" | "text"
<fs-session-timeout warnAt={1500} />     // feil: attributtet heter warn-at
<fs-connection-status offline="Nede" />  // feil: ukjent attributt
```

Typene virker ved at pakken utvider Reacts `JSX.IntrinsicElements`. Har
prosjektet to installasjoner av `@types/react`, noe som lett skjer i et
monorepo, utvider pakken den ene mens koden din bruker den andre, og
elementene forblir ukjente. Kjør `npm ls @types/react` hvis noe ser rart ut.

## Kjente fallgruver

| Symptom | Årsak |
| --- | --- |
| Stilene mangler | `tokens.css` er ikke lastet, eller lastes etter komponentens eget stilark |
| Elementet vises ikke, siden ser tom ut | `define`-funksjonen har ikke kjørt |
| Feltet er alltid ugyldig | `invalid="false"` er satt. Attributtet må fjernes, ikke settes til `false` |
| `customElements is not defined` | Registreringen kjøres der det ikke finnes noen nettleser |
| «Invalid DOM property `class`» | `fs` er importert fra hovedinngangen. Bruk `@fristil/designsystem/react` |
| `Property 'fs-field' does not exist` | `@fristil/designsystem/react-jsx` er ikke importert i en `.d.ts`-fil |

## Når CSS ikke strekker til

Komponentene tilpasses med tokens og `--fs-`-variabler. Holder ikke det,
kopierer `npx @fristil/designsystem overta <komponent>` kildekoden til én
komponent inn i prosjektet, så du eier den. Et helt fargetema av merkefargene
dine lages med `npx @fristil/designsystem tema`.

Alt dette, med levende eksempler: https://fristil.netlify.app/
