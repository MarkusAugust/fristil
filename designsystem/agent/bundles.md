# Fristil med bundles

Regelboka for Fristil i et prosjekt med et byggesteg, der markupen er vanlig
HTML: Vue, Svelte, Solid, Lit, og vanlig TypeScript med Vite, Rollup, esbuild
eller webpack.

Det disse har til felles er de tre tingene som betyr noe her: stilarkene
importeres i inngangsmodulen, attributtene heter det de heter i HTML, og
`defineFs*()` kjøres øverst i `main.ts`. Skriver du React, er attributtnavnene
annerledes og `react.md` gjelder i stedet. Skriver du Astro, importeres
stilarkene i frontmatteret og `astro.md` gjelder.

Dette er @fristil/designsystem 0.28.0. Fila er generert av pakken og følger
versjonen, så den kan aldri stå og si noe annet enn koden ved siden av.

## Kortversjon

1. **Importer stilarkene i inngangsmodulen**, `tokens.css` først. Mangler de,
   ser komponentene ustilte ut. Svaret er da å legge inn importen, aldri å
   skrive egen CSS for å få dem til å se riktige ut.
2. **Bruk bare klassene og elementene i tabellene under.** `fs-modal`,
   `fs-datepicker` og `data-variant="outline"` finnes i andre designsystemer,
   ikke i Fristil. Er du usikker på om noe finnes, står det her eller så gjør
   det ikke det.
3. **Ingen hardkodede farger eller piksler.** `var(--fs-color-…)` og
   `var(--fs-spacing-…)`.
4. **`defineFs*()` kjøres øverst i `main.ts`,** ikke i en livsløpskrok, og et
   boolsk attributt er sant så lenge det står der. Sjekk at det som havner i
   DOM-en ikke er `invalid="false"`: attributtet må fjernes, ikke settes til
   `false`.
5. **Kjør sjekken på det du har skrevet:**
   `npx @fristil/designsystem sjekk src/komponenter/*.vue`. Den kjenner hver
   klasse, hvert element, hvert attributt og hver lovlige verdi, skriver
   `fil:linje:kolonne: feil: melding`, eller `advarsel:`, og avslutter med
   feilkode hvis den finner noe.

## 1. Stilarkene

`tokens.css` definerer alle variablene, og alle de andre stilarkene bygger på
den. Den må lastes, og står først av vane: rekkefølgen mellom den og de andre
har ikke noe å si. Deretter ett per komponent du bruker, så en side med bare
knapper ikke laster CSS for en dialog:

```ts
// main.ts, øverst
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/button.css"
import "@fristil/designsystem/field.css"
```

Navnet på hvert stilark står i tabellene under. Pakken har ingen
avhengigheter, og ingenting registreres ved import alene, så en side som bare
bruker CSS-komponentene tar ikke med JavaScript fra pakken.

Trenger du alt i én fil, finnes `@fristil/designsystem/fristil.css`, men med
bundles er det sjelden riktig: da laster du CSS for komponenter siden ikke
bruker.

## 2. Hva som finnes

34 CSS-komponenter og 9 web components, og dette er hele lista. Klassene er
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
| `fs-help-text` | `@fristil/designsystem/help-text.css` | `data-variant`: strong, success, warning |
| `fs-input` | `@fristil/designsystem/input.css` | `data-state`: invalid, success<br>`data-variant`: date, datetime-local, time |
| `fs-label` | `@fristil/designsystem/label.css` | `data-required`: symbol, text |
| `fs-link` | `@fristil/designsystem/link.css` | ingen |
| `fs-list` | `@fristil/designsystem/list.css` | `data-variant`: plain, divided |
| `fs-pagination`<br>`fs-pagination__gap` | `@fristil/designsystem/pagination.css` | ingen |
| `fs-paragraph` | `@fristil/designsystem/paragraph.css` | `data-variant`: lead<br>`data-size`: small, large |
| `fs-progress` | `@fristil/designsystem/progress.css` | `data-color`: success, warning, danger |
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

Skrift: `--fs-font-size-l`, `--fs-font-size-m`, `--fs-font-size-mega`,
`--fs-font-size-reference`, `--fs-font-size-s`, `--fs-font-size-xl`,
`--fs-font-size-xs`, `--fs-font-size-xxl`, `--fs-font-size-xxs`,
`--fs-font-weight-bold`, `--fs-font-weight-medium`,
`--fs-font-weight-regular`, `--fs-font-weight-semibold`.

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

```html
<div data-theme="light">
  <button class="fs-button">Lagre</button>
</div>
```

Da er komponenten lys uansett hva maskinen står på, og verten røres ikke.

**Vertens CSS stopper ved grensen.** Verten har ofte regler uten lag, som
`button { background: none; border: none }` eller en normalize, og de slår
`@layer fristil`. Sett da `data-fs-boundary` på det samme rotelementet:

```html
<div data-fs-boundary data-theme="light">
  <button class="fs-button">Lagre</button>
</div>
```

Under rotelementet ser nettleseren bort fra CSS uten lag, innenfor
spesifisiteten under, og Fristils lag gjelder igjen. Regelen ligger i
`fristil.css` og i `@fristil/designsystem/boundary.css`. Skrift og annet som
arves kommer fortsatt fra verten, og `--fs-*`-variablene virker. Tre ting
følger av den:

- Egen CSS inne i grensen skal ligge i et lag etter `fristil`. CSS uten lag
  forsvinner der på samme måte som vertens.
- Elementer uten Fristil-klasse mister vertens CSS uten lag. Et lag verten har
  erklært før `fristil`, som Tailwinds Preflight i `base`, gjelder fortsatt
  der Fristil ikke setter noe.
- Grensen har spesifisiteten (0,2,0). En regel fra verten med samme
  spesifisitet vinner hvis den lastes etter grensen, og en med mer vinner
  alltid. Det samme gjør `!important` og lag verten har erklært etter
  `fristil`.

Fristil setter **ikke** `color-scheme` på `:root`. Egenskapen styrer
nettleserens egne flater, altså rullefelt, nedtrekkslister og kalenderpanel,
og den arves nedover. Et barn kan melde seg ut med `color-scheme: normal`, men
det er en motregel verten aldri ba om å måtte skrive: sto verdien på roten,
gjaldt den hele dokumentet, også der pakken bare er en gjest. Vil hele siden
følge systemet, skriver du `color-scheme: light dark` på `<html>` selv, på
samme måte som du selv setter lagrekkefølgen. Unntaket er temavelgeren under:
bruker du den, setter hvert valg `color-scheme` selv.

### La brukeren velge tema

`fs-theme-control` på en radioknapp gjør `value` til et temavalg. Det er ren
CSS, uten en linje JavaScript:

```html
<fieldset class="fs-toggle-group">
  <legend class="fs-sr-only">Tema</legend>
  <label class="fs-toggle-group__option">
    <input class="fs-theme-control" type="radio" name="tema"
           value="auto" checked /> Følg systemet
  </label>
  <label class="fs-toggle-group__option">
    <input class="fs-theme-control" type="radio" name="tema"
           value="light" /> Lyst
  </label>
  <label class="fs-toggle-group__option">
    <input class="fs-theme-control" type="radio" name="tema"
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

`light` og `dark` vinner over `data-theme` på `<html>`, slik at serveren kan
sende det lagrede valget mens et klikk likevel slår igjennom før svaret er
tilbake. `auto` gjør det ikke: den betyr «ingen overstyring fra meg», så har
serveren skrevet `data-theme`, er det serverens verdi som står. Skal «følg
systemet» virke med én gang, må det som lagrer valget også fjerne attributtet.

To ting den ikke gjør. Den **lagrer ingenting**: send gruppa i et skjema og
lagre valget i en cookie serveren leser, eller i `localStorage`. Og den må stå
i det **samme treet som `<html>`**, siden `:has()` ikke ser ut av sitt eget
tre; en kontroll inne i en skyggerot setter ikke tema på siden.

## 4. Web components

Tre regler gjelder alle sammen:

1. **`defineFs*()` kjøres én gang** øverst i inngangsmodulen, før appen
   monteres. Importen har ingen bivirkning alene; det er `define`-kallet som
   registrerer elementet.
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
| `<fs-suggestion>` | ramme | `@fristil/designsystem/suggestion.css` | `defineFsSuggestion()` fra `@fristil/designsystem/suggestion` | `prefiltered` (flag)<br>`count-none` (text)<br>`count-zero` (text)<br>`count-one` (text)<br>`count-two` (text)<br>`count-few` (text)<br>`count-many` (text)<br>`count-other` (text)<br>`server-controlled` (flag) | `fs-suggestion__field`<br>`fs-suggestion__list`<br>`fs-suggestion__option`<br>`fs-suggestion__empty` |
| `<fs-dialog>` | ramme | `@fristil/designsystem/dialog.css` | `defineFsDialog()` fra `@fristil/designsystem/dialog` | `open` (flag)<br>`server-controlled` (flag) | `fs-dialog`<br>`fs-dialog__body`<br>`fs-dialog__title`<br>`fs-dialog__footer`<br>`fs-dialog__header`<br>`fs-dialog__subtitle` |
| `<fs-toast>` | frittstaende | `@fristil/designsystem/toast.css` | `defineFsToast()` fra `@fristil/designsystem/toast` | `duration` (number)<br>`label` (text)<br>`close-label` (text) | `fs-toast`<br>`fs-toast__message`<br>`fs-toast__close` |
| `<fs-session-timeout>` | ramme | `@fristil/designsystem/session-timeout.css` | `defineFsSessionTimeout()` fra `@fristil/designsystem/session-timeout` | `warn-at` (number)<br>`expires-at` (number) | `fs-session-timeout`<br>`fs-session-timeout__dialog`<br>`fs-session-timeout__title`<br>`fs-session-timeout__text`<br>`fs-session-timeout__count`<br>`fs-session-timeout__actions` |
| `<fs-connection-status>` | frittstaende | `@fristil/designsystem/connection-status.css` | `defineFsConnectionStatus()` fra `@fristil/designsystem/connection-status` | `offline-text` (text)<br>`online-text` (text) | `fs-connection-status`<br>`fs-connection-status__bar` |

Ingen av dem bruker shadow DOM. Innholdet står i vanlig DOM, så
`querySelector`, `FormData` og vanlig CSS virker rett inn i det.

## 5. Registrering og markup

```ts
// main.ts, øverst, ikke i en livsløpskrok
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/field.css"
import { defineFsField } from "@fristil/designsystem/field"

defineFsField()
```

Kallet står i modulen, ikke i `mounted`, `onMount` eller en effekt. En krok
kjører etter første tegning, og elementene i markupen er da vanlige
`HTMLElement` i det rammeverket tegner dem, og et kall på `show()` eller
`reportFailure()` før kroken feiler med «is not a function».

Markupen er vanlig HTML, i malen rammeverket ditt bruker:

```html
<fs-field required-marker="symbol">
  <label>Fullt navn</label>
  <input class="fs-input" type="text" name="navn" required />
  <p class="fs-error-text">Fyll inn navnet ditt.</p>
</fs-field>

<button class="fs-button" type="submit">Send</button>
```

`class` og `for`, ikke `className` og `htmlFor`. Det er React som skriver om
attributtnavnene, og det gjelder ikke her.

## 6. Typede byggefunksjoner

Har prosjektet TypeScript, kan klassene komme fra `fs` i stedet for å skrives
som strenger. Da blir en variant som ikke finnes en kompileringsfeil:

```ts
import { fs } from "@fristil/designsystem"

fs.button({ variant: "secondary" })
// { class: "fs-button", "data-variant": "secondary" }
```

Byggefunksjonene gir et objekt med HTML-attributtnavn, som spres inn der
malspråket støtter spredning, eller leses ut felt for felt. De 44
byggefunksjonene:

`fs.accordion()`, `fs.alert()`, `fs.avatar()`, `fs.badge()`,
`fs.breadcrumbs()`, `fs.button()`, `fs.card()`, `fs.checkbox()`,
`fs.connectionStatus()`, `fs.dialog()`, `fs.divider()`, `fs.errorSummary()`,
`fs.errorText()`, `fs.field()`, `fs.fieldset()`, `fs.fileUpload()`,
`fs.heading()`, `fs.helpText()`, `fs.input()`, `fs.label()`, `fs.legend()`,
`fs.link()`, `fs.list()`, `fs.pagination()`, `fs.paragraph()`, `fs.popover()`,
`fs.progress()`, `fs.radio()`, `fs.search()`, `fs.select()`,
`fs.sessionTimeout()`, `fs.skeleton()`, `fs.skipLink()`, `fs.spinner()`,
`fs.srOnly()`, `fs.suggestion()`, `fs.switch()`, `fs.table()`, `fs.tabs()`,
`fs.tag()`, `fs.textarea()`, `fs.toast()`, `fs.toggleGroup()`, `fs.tooltip()`

Der malspråket ikke kan spre et objekt, setter `fs.setAttributes()`
attributtene på et element i vanlig DOM:

```ts
const felt = document.querySelector<HTMLInputElement>("#epost")
const kobling = fs.field({ id: "epost", error: true, invalid: true })

fs.setAttributes(felt, fs.input({ type: "email" }), kobling.control)
```

Kall den på nytt for å endre tilstand. Tre regler:

- **Har byggefunksjonen et valg for et attributt, eier den det.** Et kall uten
  valget tar attributtet bort, så valgene sendes på nytt hver gang.
  `fs.spinner()` uten `label` fjerner `role` og `aria-label`.
- **Det byggefunksjonen ikke har et valg for, står.** `fs.button()` rører ikke
  `disabled` eller `type`. `id` og `for` fjernes aldri.
- **To sett på samme element sendes hver for seg**, som over. Spres de sammen
  til ett objekt, `{ ...fs.input(), ...kobling.control }`, settes
  attributtene, men bare `data-*` ryddes ved neste kall.

## 7. Sjekk markupen

```bash
npx @fristil/designsystem sjekk src/komponenter/*.vue
```

Sjekken leser filer som tekst, så den virker på `.vue`, `.svelte`, `.html` og
hva malen din nå ligger i. Ett funn gir feilkode, så den hører i CI. Den
fanger `fs-buton`, `data-variant="secundary"`, `<fs-modal>` og `<fs-field>`
uten kontroll eller ledetekst, altså alt det typene ikke ser, fordi markupen
din er en streng for kompilatoren.

Lager koden HTML-en som strenger, finnes det ingen fil å sjekke. Kjør da den
samme sjekken i testene:

```js
import { diagnoseMarkup } from "@fristil/designsystem/diagnostics"

const funn = diagnoseMarkup(html)
// funn er tom når markupen stemmer
```

## Kjente fallgruver

| Symptom | Årsak |
| --- | --- |
| Stilene mangler | `tokens.css` er ikke lastet. Rekkefølgen mellom den og komponentens stilark betyr ikke noe |
| En `<fs-toast>` eller `<fs-connection-status>` viser ingenting, et `<fs-session-timeout>` varsler aldri, eller en annen komponent gjør ingenting | `define`-funksjonen har ikke kjørt. `<fs-toast>` og `<fs-connection-status>` lager innholdet sitt selv og er tomme uten den, og `<fs-session-timeout>` teller ikke tiden. Markupen i de andre er din og står der uansett |
| En komponent snakker norsk på en side på et annet språk | Teksten i markupen er din, og skrives med appens eget oppsett for oversettelse. De få standardtekstene pakken har byttes med `label` og `close-label` på `<fs-toast>`, `offline-text` og `online-text` på `<fs-connection-status>`, `count-none`, `count-one` og `count-other` på `<fs-suggestion>`, og `--fs-label-required-text`, `--fs-label-optional-text` og `--fs-label-required-symbol` i CSS. Tall og varigheter følger `lang` på `<html>`. Se https://fristil.sobernetics.no/oversettelse/ |
| Feltet er alltid ugyldig | `invalid="false"` er satt. Attributtet må fjernes, ikke settes til `false` |
| Komponenten gjør ingenting, og ingenting sier fra | Registreringen kjøres bare på serveren, der den ikke gjør noe. Den må også kjøre i nettleseren |

## Når CSS ikke strekker til

Komponentene tilpasses med tokens og `--fs-`-variabler. Holder ikke det,
kopierer `npx @fristil/designsystem overta <komponent>` kildekoden til én
komponent inn i prosjektet, så du eier den. Et helt fargetema av merkefargene
dine lages med `npx @fristil/designsystem tema`.

Alt dette, med levende eksempler: https://fristil.sobernetics.no/
