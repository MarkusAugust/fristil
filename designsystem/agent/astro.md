# Fristil i Astro

Regelboka for Fristil i et Astro-prosjekt.

En `.astro`-fil er HTML med frontmatter over. Stilarkene importeres der, og
byggerne brukes rett i malen, siden Astro støtter spredning som JSX. Det
særegne er at alt dette kjøres ved bygging: ut kommer ren HTML, og `fs` er
borte når siden er bygd. Null JavaScript sendt til nettleseren.

Dette er @fristil/designsystem 0.19.0. Fila er generert av pakken og følger
versjonen, så den kan aldri stå og si noe annet enn koden ved siden av.

## Kortversjon

1. **Importer stilarkene i frontmatteret**, `tokens.css` først. Mangler de,
   ser komponentene ustilte ut. Svaret er da å legge inn importen, aldri å
   skrive egen CSS for å få dem til å se riktige ut.
2. **Bruk bare klassene og elementene i tabellene under.** `fs-modal`,
   `fs-datepicker` og `data-variant="outline"` finnes i andre designsystemer,
   ikke i Fristil. Er du usikker på om noe finnes, står det her eller så gjør
   det ikke det.
3. **Ingen hardkodede farger eller piksler.** `var(--semantic-…)` og
   `var(--size-…)`. Paletten (`--palette-…`) er råverdier og brukes ikke
   direkte.
4. **`defineFs*()` hører i en `<script>` i malen, aldri i frontmatteret:**
   frontmatteret kjøres på serveren, der `customElements` ikke finnes. Og et
   boolsk attributt er sant så lenge det står der.
5. **Kjør sjekken på det du har skrevet:**
   `npx @fristil/designsystem sjekk src/pages/*.astro`. Den kjenner hver
   klasse, hvert element, hvert attributt og hver lovlige verdi, skriver
   `fil:linje:kolonne: melding`, og avslutter med feilkode hvis den finner
   noe.

## 1. Stilarkene

`tokens.css` definerer alle variablene, og alle de andre stilarkene bygger på
den. Den lastes derfor først. Importene står i frontmatteret:

```astro
---
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/button.css"
import "@fristil/designsystem/badge.css"
---
```

Navnet på hvert stilark står i tabellene under. Har du et layoutkomponent,
hører `tokens.css` der, én gang for hele siden.

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

1. **`defineFs*()` kjøres én gang** i en `<script>` i malen. Astro pakker
   `<script>`-tagger og kjører dem på klienten. Importen har ingen bivirkning
   alene; det er `define`-kallet som registrerer elementet.
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

## 5. Byggerne i malen

```astro
---
import { fs } from "@fristil/designsystem"
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/button.css"
import "@fristil/designsystem/badge.css"
---

<button {...fs.button({ variant: "secondary" })}>Lagre utkast</button>
<span {...fs.badge({ color: "success" })}>Innvilget</span>
```

Kjøres ved bygging. Ut kommer ren HTML:

```html
<button class="fs-button" data-variant="secondary">Lagre utkast</button>
<span class="fs-badge" data-color="success">Innvilget</span>
```

`fs` importeres fra hovedinngangen, som gir `class` og `for`. De 43 byggerne:

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

## 6. Felt uten JavaScript

`fs.field()` regner ut koblingen mellom ledetekst, kontroll, hjelpetekst og
feilmelding i frontmatteret, så også den blir statisk HTML:

```astro
---
import { fs } from "@fristil/designsystem"
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/field.css"

const epost = fs.field({ id: "epost", required: "symbol", help: true, error: true })
---

<label {...epost.label}>E-postadresse</label>
<input {...fs.input({ type: "email" })} {...epost.control} name="epost" required />
<p {...fs.helpText()} {...epost.help}>Vi sender kvittering hit.</p>
<p {...fs.errorText()} {...epost.error}>Skriv en gyldig adresse.</p>
```

Ingen `<fs-field>`, ingen kjøretid.

## 7. Web components i Astro

Skal feltet kunne bli ugyldig mens brukeren står i det, må komponenten
registreres:

```astro
---
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/field.css"
---

<fs-field required-marker="symbol">
  <label>Fullt navn</label>
  <input class="fs-input" type="text" name="navn" required />
  <p class="fs-error-text">Fyll inn navnet ditt.</p>
</fs-field>

<script>
  import { defineFsField } from "@fristil/designsystem/field"
  defineFsField()
</script>
```

`customElements` finnes bare i nettleseren, så registreringen kan ikke stå i
frontmatteret. En `<script>` i malen er alt som skal til: komponentene er
vanlige egendefinerte elementer, og trenger verken en Astro-integrasjon eller
et `client:`-direktiv.

## Kjente fallgruver

| Symptom | Årsak |
| --- | --- |
| Stilene mangler | `tokens.css` er ikke lastet, eller lastes etter komponentens eget stilark |
| Elementet vises ikke, siden ser tom ut | `define`-funksjonen har ikke kjørt |
| Feltet er alltid ugyldig | `invalid="false"` er satt. Attributtet må fjernes, ikke settes til `false` |
| `customElements is not defined` | Registreringen står i frontmatteret. Den hører i en `<script>` i malen |

## Når CSS ikke strekker til

Komponentene tilpasses med tokens og `--fs-`-variabler. Holder ikke det,
kopierer `npx @fristil/designsystem overta <komponent>` kildekoden til én
komponent inn i prosjektet, så du eier den. Et helt fargetema av merkefargene
dine lages med `npx @fristil/designsystem tema`.

Alt dette, med levende eksempler: https://fristil.netlify.app/
