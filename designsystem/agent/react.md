# Fristil i React

Regelboka for Fristil i en React-app.

React skiller seg fra alle de andre miljøene på én ting, og den er viktig nok
til å ha sin egen fil: React skriver om attributtnavnene. `class` heter
`className` og `for` heter `htmlFor`, og bruker du byggefunksjonene fra
hovedinngangen skriver React «Invalid DOM property» i konsollen for hvert
element. Derfor har pakken en egen React-inngang.

Dette er @fristil/designsystem 0.25.0. Fila er generert av pakken og følger
versjonen, så den kan aldri stå og si noe annet enn koden ved siden av.

## Kortversjon

1. **Importer stilarkene i `main.tsx`**, `tokens.css` først. Mangler de, ser
   komponentene ustilte ut. Svaret er da å legge inn importen, aldri å skrive
   egen CSS for å få dem til å se riktige ut.
2. **Bruk bare klassene og elementene i tabellene under.** `fs-modal`,
   `fs-datepicker` og `data-variant="outline"` finnes i andre designsystemer,
   ikke i Fristil. Er du usikker på om noe finnes, står det her eller så gjør
   det ikke det.
3. **Ingen hardkodede farger eller piksler.** `var(--fs-color-…)` og
   `var(--fs-spacing-…)`.
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

33 CSS-komponenter og 9 web components, og dette er hele lista. Klassene er
`fs-` + kebab-case. Varianter er alltid `data-*`-attributter, aldri egne
klasser: `data-variant="secondary"`, ikke `fs-button--secondary`.
Standardvarianten har ingen attributt.

### CSS-komponenter (ingen JavaScript)

| Klasse | Stilark | Attributter |
| --- | --- | --- |
| `fs-accordion`<br>`fs-accordion__content` | `@fristil/designsystem/accordion.css` | `data-variant`: plain |
| `fs-alert`<br>`fs-alert__title` | `@fristil/designsystem/alert.css` | `data-color`: info, success, warning, danger |
| `fs-avatar`<br>`fs-avatar-stack` | `@fristil/designsystem/avatar.css` | `data-variant`: square<br>`data-size`: small, large |
| `fs-badge` | `@fristil/designsystem/badge.css` | `data-color`: success, warning, danger, neutral |
| `fs-breadcrumbs` | `@fristil/designsystem/breadcrumbs.css` | ingen |
| `fs-button` | `@fristil/designsystem/button.css` | `data-variant`: secondary, ghost, danger |
| `fs-card`<br>`fs-card__title` | `@fristil/designsystem/card.css` | `data-variant`: filled |
| `fs-checkbox`<br>`fs-checkbox-row` | `@fristil/designsystem/checkbox.css` | `data-state`: invalid, success |
| `fs-divider` | `@fristil/designsystem/divider.css` | `data-variant`: subtle, strong |
| `fs-error-text` | `@fristil/designsystem/error-text.css` | `data-variant`: warning |
| `fs-fieldset`<br>`fs-legend` | `@fristil/designsystem/fieldset.css` | `data-state`: invalid, success<br>`data-required`: symbol, text |
| `fs-file-upload`<br>`fs-file-upload-list` | `@fristil/designsystem/file-upload.css` | `data-state`: invalid, success |
| `fs-heading` | `@fristil/designsystem/heading.css` | `data-size`: xs, s, m, xl, mega |
| `fs-help-text` | `@fristil/designsystem/help-text.css` | `data-variant`: default, success, warning |
| `fs-input` | `@fristil/designsystem/input.css` | `data-state`: invalid, success<br>`data-variant`: date, datetime-local, time |
| `fs-label` | `@fristil/designsystem/label.css` | `data-required`: symbol, text |
| `fs-link` | `@fristil/designsystem/link.css` | ingen |
| `fs-list` | `@fristil/designsystem/list.css` | `data-variant`: plain, divided |
| `fs-pagination`<br>`fs-pagination__gap` | `@fristil/designsystem/pagination.css` | ingen |
| `fs-paragraph` | `@fristil/designsystem/paragraph.css` | `data-variant`: lead<br>`data-size`: small, large |
| `fs-radio`<br>`fs-radio-row` | `@fristil/designsystem/radio.css` | `data-state`: invalid, success |
| `fs-search`<br>`fs-search-row` | `@fristil/designsystem/search.css` | `data-state`: invalid, success |
| `fs-select` | `@fristil/designsystem/select.css` | `data-state`: invalid, success<br>`data-picker`: styled |
| `fs-skeleton` | `@fristil/designsystem/skeleton.css` | `data-variant`: text, circle |
| `fs-skip-link` | `@fristil/designsystem/skip-link.css` | ingen |
| `fs-spinner` | `@fristil/designsystem/spinner.css` | `data-size`: small, large |
| `fs-sr-only` | `@fristil/designsystem/sr-only.css` | ingen |
| `fs-switch`<br>`fs-switch-row` | `@fristil/designsystem/switch.css` | ingen |
| `fs-table`<br>`fs-table-scroll` | `@fristil/designsystem/table.css` | `data-variant`: striped |
| `fs-tag` | `@fristil/designsystem/tag.css` | `data-variant`: filled |
| `fs-textarea` | `@fristil/designsystem/textarea.css` | `data-state`: invalid, success |
| `fs-toggle-group`<br>`fs-toggle-group__option` | `@fristil/designsystem/toggle-group.css` | ingen |
| `fs-tooltip`<br>`fs-tooltip__bubble` | `@fristil/designsystem/tooltip.css` | ingen |

## 3. Tokens

Ett lag. En farge er en celle i en matrise av **familie**, altså hva den
betyr, og **rolle**, altså hva den gjør, og navnet er
`--fs-color-<familie>-<rolle>`. Hver familie har hver rolle, så
`--fs-color-danger-border` og `--fs-color-success-border` finnes begge.
Rollene er de samme uansett familie: `surface` er en tonet flate, `fill` en
fylt, `content` teksten oppå `fill`, `border` en ramme, og `text` familiens
farge som tekst. Kant og tekst har et svakere og et sterkere trinn ved siden
av.

```
Familier: `accent`, `visited`, `brand1`, `brand2`, `brand3`, `neutral`, `danger`, `warning`, `success`.

Roller: `surface`, `border-subtle`, `border`, `border-strong`, `fill`, `text`, `text-strong`, `text-subtle`, `content`.

Utenfor matrisen: `--fs-color-disabled-surface`, `--fs-color-disabled-text`, `--fs-color-neutral-canvas`, `--fs-color-neutral-raised`, `--fs-color-overlay`, `--fs-focus-ring`, `--fs-icon-calendar`, `--fs-icon-check`, `--fs-icon-clock`, `--fs-icon-dash`, `--fs-icon-search`, `--fs-shadow-overlay`.
```

Mål: `--fs-spacing-0-5`, `--fs-spacing-1`, `--fs-spacing-10`,
`--fs-spacing-12`, `--fs-spacing-16`, `--fs-spacing-2`, `--fs-spacing-3`,
`--fs-spacing-4`, `--fs-spacing-5`, `--fs-spacing-6`, `--fs-spacing-7`,
`--fs-spacing-8`, `--fs-spacing-px`.

Skrift: `--font-size-l`, `--font-size-m`, `--font-size-mega`,
`--font-size-reference`, `--font-size-s`, `--font-size-xl`, `--font-size-xs`,
`--font-size-xxl`, `--font-size-xxs`, `--font-weight-bold`,
`--font-weight-medium`, `--font-weight-regular`, `--font-weight-semibold`.

Linjehøyde: `--fs-line-height-article`, `--fs-line-height-compact`,
`--fs-line-height-default`, `--fs-line-height-heading`.

`disabled` og `neutral` er ikke det samme. `disabled` er for kontroller som er
slått av, og er unntatt kontrastkravet i WCAG 1.4.3. `neutral` er for dempet
informasjon brukeren faktisk skal lese eller trykke på, og holder 4,5:1. Bruk
aldri `disabled`-fargene for å dempe noe som skal leses.

### Lyst og mørkt

Uten at du gjør noe, følger fargene maskinens innstilling. En side som vil
bestemme selv setter `data-theme="light"` eller `data-theme="dark"` på
`<html>`.

Attributtet er en **temagrense** og virker på et hvilket som helst element,
ikke bare på roten. Et tema kan ligge inne i et annet, begge veier.

Det er dette en innebygd komponent skal bruke. Legger du Fristil inn i en side
du ikke eier, setter du attributtet på komponentens eget rotelement:

```tsx
<div data-theme="light">
  <button {...fs.button()}>Lagre</button>
</div>
```

Da er komponenten lys uansett hva maskinen står på, og verten røres ikke.

Fristil setter **ikke** `color-scheme` på `:root`. Egenskapen styrer
nettleserens egne flater, altså rullefelt, nedtrekkslister og kalenderpanel,
og den arves nedover. Et barn kan melde seg ut med `color-scheme: normal`, men
det er en motregel verten aldri ba om å måtte skrive: sto verdien på roten,
gjaldt den hele dokumentet, også der pakken bare er en gjest. Vil hele siden
følge systemet, skriver du `color-scheme: light dark` på `<html>` selv, på
samme måte som du selv setter lagrekkefølgen. Skriv den i et lag foran
`fristil`. Et usortert lag slår alle lag, så en regel utenfor lagene hindrer
temavelgeren under i å sette `color-scheme`.

### La brukeren velge tema

`fs-theme-control` på en radioknapp gjør `value` til et temavalg. Det er ren
CSS, uten en linje JavaScript:

```tsx
<fieldset className="fs-toggle-group">
  <legend className="fs-sr-only">Tema</legend>
  <label className="fs-toggle-group__option">
    <input className="fs-theme-control" type="radio" name="tema"
           value="auto" defaultChecked /> Følg systemet
  </label>
  <label className="fs-toggle-group__option">
    <input className="fs-theme-control" type="radio" name="tema"
           value="light" /> Lyst
  </label>
  <label className="fs-toggle-group__option">
    <input className="fs-theme-control" type="radio" name="tema"
           value="dark" /> Mørkt
  </label>
</fieldset>
```

Valget styrer to ting. Fristils farger kommer fra tokenene, og nettleserens
**egne** flater fra `color-scheme`: `light` gir `light`, `dark` gir `dark`, og
`auto` gir `light dark`. `light dark` er ikke et tema, men beskjeden om at
siden fungerer i begge, så nettleseren kan velge etter systemet.

«Følg systemet» har ingen temablokk, og det er med vilje: en verdi uten blokk
treffer ingenting, og da gjelder mediespørringen igjen.

Du skal ikke skrive `color-scheme` selv når velgeren er i bruk. En slik regel
utenfor et lag slår `@layer fristil` og låser nettleserens flater til systemet
mens brukeren har valgt noe annet.

Kontrollen vinner over `data-theme` på `<html>`, slik at serveren kan sende
det lagrede valget mens et klikk likevel slår igjennom før svaret er tilbake.

To ting den ikke gjør. Den **lagrer ingenting**: send gruppa i et skjema og
lagre valget i en cookie serveren leser, eller i `localStorage`. Og den må stå
i det **samme treet som `<html>`**, siden `:has()` ikke ser ut av sitt eget
tre; en kontroll inne i en shadow rot temaer ingenting.

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
| `<fs-field>` | ramme | `@fristil/designsystem/field.css` | `defineFsField()` fra `@fristil/designsystem/field` | `invalid` (flag)<br>`disabled` (flag)<br>`optional` (flag)<br>`required-marker`: symbol, text, none<br>`control-id` (text)<br>`described-by` (text) | ingen |
| `<fs-tabs>` | ramme | `@fristil/designsystem/tabs.css` | `defineFsTabs()` fra `@fristil/designsystem/tabs` | `server-controlled` (flag) | `fs-tabs__list`<br>`fs-tabs__panel` |
| `<fs-error-summary>` | ramme | `@fristil/designsystem/error-summary.css` | `defineFsErrorSummary()` fra `@fristil/designsystem/error-summary` | `data-autofocus`: false<br>`hidden` (flag) | `fs-error-summary`<br>`fs-error-summary__title` |
| `<fs-popover>` | ramme | `@fristil/designsystem/popover.css` | `defineFsPopover()` fra `@fristil/designsystem/popover` | `open` (flag)<br>`placement`: bottom-start, bottom-end, top-start, top-end<br>`server-controlled` (flag) | `fs-popover` |
| `<fs-suggestion>` | ramme | `@fristil/designsystem/suggestion.css` | `defineFsSuggestion()` fra `@fristil/designsystem/suggestion` | `prefiltered` (flag)<br>`server-controlled` (flag) | `fs-suggestion__field`<br>`fs-suggestion__list`<br>`fs-suggestion__option`<br>`fs-suggestion__empty` |
| `<fs-dialog>` | ramme | `@fristil/designsystem/dialog.css` | `defineFsDialog()` fra `@fristil/designsystem/dialog` | `open` (flag)<br>`server-controlled` (flag) | `fs-dialog`<br>`fs-dialog__body`<br>`fs-dialog__title`<br>`fs-dialog__footer`<br>`fs-dialog__header`<br>`fs-dialog__subtitle` |
| `<fs-toast>` | frittstaende | `@fristil/designsystem/toast.css` | `defineFsToast()` fra `@fristil/designsystem/toast` | `duration` (number)<br>`label` (text) | `fs-toast`<br>`fs-toast__close` |
| `<fs-session-timeout>` | frittstaende | `@fristil/designsystem/session-timeout.css` | `defineFsSessionTimeout()` fra `@fristil/designsystem/session-timeout` | `warn-at` (number)<br>`expires-at` (number) | `fs-session-timeout`<br>`fs-session-timeout__dialog`<br>`fs-session-timeout__title`<br>`fs-session-timeout__text`<br>`fs-session-timeout__count`<br>`fs-session-timeout__actions` |
| `<fs-connection-status>` | frittstaende | `@fristil/designsystem/connection-status.css` | `defineFsConnectionStatus()` fra `@fristil/designsystem/connection-status` | `offline-text` (text)<br>`online-text` (text) | `fs-connection-status`<br>`fs-connection-status__bar` |

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
`for`. De 43 byggefunksjonene finnes i begge:

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

React behandler web components ulikt mellom versjoner, og bare dette mønsteret
er riktig i begge:

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
