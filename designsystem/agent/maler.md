# Fristil i maler og serverskrevet HTML

Regelboka for Fristil der serveren lager markupen: Go-maler, Razor, PHP,
Blade, Twig, Jinja, Django, ERB, Liquid, Handlebars, Nunjucks og Edge, og HTML
bygget som strenger i Kotlin, Java, C# eller Python.

Dette er miljøet Fristil er laget for. Komponentene er CSS-klasser og web
components, altså ting nettleseren forstår direkte, så en Go-mal får de samme
komponentene som en React-app uten å ta inn noe JavaScript-rammeverk.

Det er også miljøet med minst sikkerhetsnett. Ingen kompilator ser på
attributtene i en mal, og ingen type stopper `data-variant="outline"`. Derfor
gjelder punkt 5 strengere her enn noe annet sted: sjekken er det eneste som
leser markupen din.

Dette er @fristil/designsystem 0.27.1. Fila er generert av pakken og følger
versjonen, så den kan aldri stå og si noe annet enn koden ved siden av.

## Kortversjon

1. **Én `<link>` til `fristil.css` i sidemalen,** én gang for hele appen.
   Mangler den, ser komponentene ustilte ut. Svaret er da å legge inn lenka,
   aldri å skrive egen CSS for å få dem til å se riktige ut.
2. **Bruk bare klassene og elementene i tabellene under.** `fs-modal`,
   `fs-datepicker` og `data-variant="outline"` finnes i andre designsystemer,
   ikke i Fristil. Er du usikker på om noe finnes, står det her eller så gjør
   det ikke det.
3. **Ingen hardkodede farger eller piksler.** `var(--fs-color-…)` og
   `var(--fs-spacing-…)`.
4. **Web components registreres én gang med `defineFs*()`** i sidemalen, og et
   boolsk attributt er sant så lenge det står der. I en mal betyr det en
   betingelse rundt hele attributtet, `{{if .Ugyldig}}invalid{{end}}`, ikke
   `invalid="{{.Ugyldig}}"`.
5. **Kjør sjekken på det du har skrevet:**
   `npx @fristil/designsystem sjekk maler/*.html`. Den kjenner hver klasse,
   hvert element, hvert attributt og hver lovlige verdi, skriver
   `fil:linje:kolonne: feil: melding`, eller `advarsel:`, og avslutter med
   feilkode hvis den finner noe.

## 1. Stilarket

Én lenke i sidemalen, med alle komponentene:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/dist/fristil.css">
```

Eller fra egen server, hvis du kopierer fila inn i de statiske ressursene
dine. `fristil.css` er 90 kB, 11 kB komprimert, og har alt flatet ut uten
`@import`, og er det raskeste valget når du lenker.

Vil du bare ha stilarkene sidene faktisk bruker, gjelder at `tokens.css`
definerer alle variablene, og alle de andre stilarkene bygger på den. Den må
lastes, og står først av vane: rekkefølgen mellom den og de andre har ikke noe
å si. Deretter ett stilark per komponent, fra tabellene under. Uten bundles er
det flere rundturer, og én glemt lenke er nok til at noe ser ustilt ut. For en
mal er én fil nesten alltid riktig valg.

## 2. Hva som finnes

34 CSS-komponenter og 9 web components, og dette er hele lista. Klassene er
`fs-` + kebab-case. Varianter er alltid `data-*`-attributter, aldri egne
klasser: `data-variant="secondary"`, ikke `fs-button--secondary`.
Standardvarianten har ingen attributt.

### CSS-komponenter (ingen JavaScript)

| Klasse | Stilark | Attributter |
| --- | --- | --- |
| `fs-accordion`<br>`fs-accordion__content` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/accordion/accordion.css` | `data-variant`: plain |
| `fs-alert`<br>`fs-alert__title` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/alert/alert.css` | `data-color`: info, success, warning, danger |
| `fs-avatar`<br>`fs-avatar-stack` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/avatar/avatar.css` | `data-variant`: square<br>`data-size`: small, large |
| `fs-badge` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/badge/badge.css` | `data-color`: success, warning, danger, neutral |
| `fs-breadcrumbs` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/breadcrumbs/breadcrumbs.css` | ingen |
| `fs-button` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/button/button.css` | `data-variant`: secondary, ghost, danger |
| `fs-card`<br>`fs-card__title` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/card/card.css` | `data-variant`: filled |
| `fs-checkbox`<br>`fs-checkbox-row` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/checkbox/checkbox.css` | `data-state`: invalid, success |
| `fs-divider` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/divider/divider.css` | `data-variant`: subtle, strong |
| `fs-error-text` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/error-text/error-text.css` | `data-variant`: warning |
| `fs-fieldset`<br>`fs-legend` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/fieldset/fieldset.css` | `data-state`: invalid, success<br>`data-required`: symbol, text |
| `fs-file-upload`<br>`fs-file-upload-list` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/file-upload/file-upload.css` | `data-state`: invalid, success |
| `fs-heading` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/heading/heading.css` | `data-size`: xs, s, m, xl, mega |
| `fs-help-text` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/help-text/help-text.css` | `data-variant`: strong, success, warning |
| `fs-input` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/input/input.css` | `data-state`: invalid, success<br>`data-variant`: date, datetime-local, time |
| `fs-label` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/label/label.css` | `data-required`: symbol, text |
| `fs-link` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/link/link.css` | ingen |
| `fs-list` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/list/list.css` | `data-variant`: plain, divided |
| `fs-pagination`<br>`fs-pagination__gap` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/pagination/pagination.css` | ingen |
| `fs-paragraph` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/paragraph/paragraph.css` | `data-variant`: lead<br>`data-size`: small, large |
| `fs-progress` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/progress/progress.css` | `data-color`: success, warning, danger |
| `fs-radio`<br>`fs-radio-row` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/radio/radio.css` | `data-state`: invalid, success |
| `fs-search`<br>`fs-search-row` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/search/search.css` | `data-state`: invalid, success |
| `fs-select` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/select/select.css` | `data-state`: invalid, success<br>`data-picker`: styled |
| `fs-skeleton` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/skeleton/skeleton.css` | `data-variant`: text, circle |
| `fs-skip-link` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/skip-link/skip-link.css` | ingen |
| `fs-spinner` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/spinner/spinner.css` | `data-size`: small, large |
| `fs-sr-only` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/sr-only/sr-only.css` | ingen |
| `fs-switch`<br>`fs-switch-row` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/switch/switch.css` | ingen |
| `fs-table`<br>`fs-table-scroll` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/table/table.css` | `data-variant`: striped |
| `fs-tag` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/tag/tag.css` | `data-variant`: filled |
| `fs-textarea` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/textarea/textarea.css` | `data-state`: invalid, success |
| `fs-toggle-group`<br>`fs-toggle-group__option` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/toggle-group/toggle-group.css` | ingen |
| `fs-tooltip`<br>`fs-tooltip__bubble` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/css/tooltip/tooltip.css` | ingen |

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

```html
<div data-theme="light">
  <button class="fs-button">Lagre</button>
</div>
```

Da er komponenten lys uansett hva maskinen står på, og verten røres ikke.

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

1. **`defineFs*()` kjøres én gang** i sidemalen, ikke én gang per komponent.
   Importen har ingen bivirkning alene; det er `define`-kallet som registrerer
   elementet.
2. **Boolske attributter er sanne så lenge de finnes.** `invalid="false"`,
   `disabled="false"` og `open="false"` slår *på*. Skal noe av det bort, må
   attributtet fjernes helt.
3. **Du skriver markupen, komponenten fester oppførselen.** `<fs-field>` lager
   ikke ledeteksten eller kontrollen din. Den kobler sammen dem du har lagt
   inn, med `id`, `for` og `aria-describedby`. Et `<fs-field>` uten kontroll,
   eller uten ledetekst, er en feil komponenten melder fra om.

| Element | Kategori | Stilark | Registrering | Attributter | Klasser inni |
| --- | --- | --- | --- | --- | --- |
| `<fs-field>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/ramme/field/field.css` | `defineFsField()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/dist/components/ramme/field/fs-field.js` | `invalid` (flag)<br>`disabled` (flag)<br>`optional` (flag)<br>`required-marker`: symbol, text, none<br>`control-id` (text)<br>`described-by` (text) | ingen |
| `<fs-tabs>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/ramme/tabs/tabs.css` | `defineFsTabs()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/dist/components/ramme/tabs/fs-tabs.js` | `server-controlled` (flag) | `fs-tabs__list`<br>`fs-tabs__panel` |
| `<fs-error-summary>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/ramme/error-summary/error-summary.css` | `defineFsErrorSummary()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/dist/components/ramme/error-summary/fs-error-summary.js` | `data-autofocus`: false<br>`hidden` (flag) | `fs-error-summary`<br>`fs-error-summary__title` |
| `<fs-popover>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/ramme/popover/popover.css` | `defineFsPopover()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/dist/components/ramme/popover/fs-popover.js` | `open` (flag)<br>`placement`: bottom-start, bottom-end, top-start, top-end<br>`server-controlled` (flag) | `fs-popover` |
| `<fs-suggestion>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/ramme/suggestion/suggestion.css` | `defineFsSuggestion()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/dist/components/ramme/suggestion/fs-suggestion.js` | `prefiltered` (flag)<br>`server-controlled` (flag) | `fs-suggestion__field`<br>`fs-suggestion__list`<br>`fs-suggestion__option`<br>`fs-suggestion__empty` |
| `<fs-dialog>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/ramme/dialog/dialog.css` | `defineFsDialog()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/dist/components/ramme/dialog/fs-dialog.js` | `open` (flag)<br>`server-controlled` (flag) | `fs-dialog`<br>`fs-dialog__body`<br>`fs-dialog__title`<br>`fs-dialog__footer`<br>`fs-dialog__header`<br>`fs-dialog__subtitle` |
| `<fs-toast>` | frittstaende | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/frittstaende/toast/toast.css` | `defineFsToast()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/dist/components/frittstaende/toast/fs-toast.js` | `duration` (number)<br>`label` (text) | `fs-toast`<br>`fs-toast__message`<br>`fs-toast__close` |
| `<fs-session-timeout>` | frittstaende | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/frittstaende/session-timeout/session-timeout.css` | `defineFsSessionTimeout()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/dist/components/frittstaende/session-timeout/fs-session-timeout.js` | `warn-at` (number)<br>`expires-at` (number) | `fs-session-timeout`<br>`fs-session-timeout__dialog`<br>`fs-session-timeout__title`<br>`fs-session-timeout__text`<br>`fs-session-timeout__count`<br>`fs-session-timeout__actions` |
| `<fs-connection-status>` | frittstaende | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/src/components/frittstaende/connection-status/connection-status.css` | `defineFsConnectionStatus()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/dist/components/frittstaende/connection-status/fs-connection-status.js` | `offline-text` (text)<br>`online-text` (text) | `fs-connection-status`<br>`fs-connection-status__bar` |

Ingen av dem bruker shadow DOM. Innholdet står i vanlig DOM, så
`querySelector`, `FormData` og vanlig CSS virker rett inn i det.

## 5. Et felt i en mal

```html
<fs-field {{if .Feil}}invalid{{end}} required-marker="symbol">
  <label>Fullt navn</label>
  <input class="fs-input" type="text" name="navn" value="{{.Navn}}" required />
  {{if .Feil}}<p class="fs-error-text">{{.Feil}}</p>{{end}}
</fs-field>
```

Registreringen, én gang i sidemalen:

```html
<script type="module">
  import { defineFsField } from
    "https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.27.1/dist/components/ramme/field/fs-field.js"

  defineFsField()
</script>
```

## 6. Når serveren sender ny HTML

Patcher du siden underveis, med htmx, Turbo, Datastar eller en egen
`innerHTML`-oppdatering, er spørsmålet hvem som eier tilstanden. Som standard
eier komponenten den: `<fs-tabs>` husker fanen brukeren valgte, og setter den
tilbake når en patch river den bort. Malen trenger ingenting for det.

Skal serveren kunne flytte tilstanden, som i «gå videre til steg 2», sier du
det med `server-controlled`. Da bestemmer hver patch, og komponenten slutter å
sette brukerens valg tilbake:

```html
<fs-tabs server-controlled>
  <div class="fs-tabs__list" aria-label="Deler av saken">
    <button>Søknaden</button>
    <button>Vedlegg</button>
  </div>
  <div class="fs-tabs__panel">…</div>
  <div class="fs-tabs__panel" hidden>…</div>
</fs-tabs>
```

Attributtet finnes på `<fs-tabs>`, `<fs-popover>`, `<fs-dialog>` og
`<fs-suggestion>`. Uten det ville serveren og komponenten kjempet om samme
tilstand. Merk at tilstanden alltid står i markupen serveren sendte, altså
`aria-selected` på fanen, `hidden` på panelet, ikke i et eget attributt.

## 7. Sjekken er det eneste som leser markupen din

```bash
npx @fristil/designsystem sjekk maler/*.html
```

Ett funn gir feilkode, så den hører i CI ved siden av testene. Den fanger
`fs-buton`, `data-variant="secundary"`, `<fs-modal>` og `<fs-field>` uten
kontroll eller ledetekst.

Den er laget for maler. Kommentarer, `<script>` og `<style>` hoppes over, og
`<?…?>` og `<%…%>` inne i en tagg avslutter den ikke før tiden. Disse er
etterprøvde og gir ingen falske funn:

```html
<button class="fs-button {{.Ekstra}}">Send</button>
<button class="fs-button" data-variant="{{.Variant}}">Send</button>
<span class="fs-badge" data-color="{% if x %}danger{% endif %}">1</span>
<button class="fs-button" data-variant="<?= $variant ?>">Send</button>
<button class="fs-button" data-variant="@variant">Send</button>
<button class="fs-button" data-variant="<%= variant %>">Send</button>
```

Lager koden HTML-en som strenger, finnes det ingen fil å sjekke. Kjør da den
samme sjekken i testene:

```js
import { diagnoseMarkup } from "@fristil/designsystem/diagnostics"

const funn = diagnoseMarkup(html)
// funn er tom når markupen stemmer
```

Sjekken finnes også i editoren mens du skriver. VS Code-utvidelsen «Fristil»
gir fullføring, forklaring, feilmeldinger og hurtigrettelser i seksten
malspråk, og WebStorm og IntelliJ IDEA Ultimate leser `web-types.json` fra
pakken uten noen utvidelse.

## Kjente fallgruver

| Symptom | Årsak |
| --- | --- |
| Stilene mangler | `tokens.css` er ikke lastet. Rekkefølgen mellom den og komponentens stilark betyr ikke noe |
| En `<fs-toast>`, `<fs-session-timeout>` eller `<fs-connection-status>` viser ingenting, eller en annen komponent gjør ingenting | `define`-funksjonen har ikke kjørt. De tre lager innholdet sitt selv og er tomme uten den. Markupen i de andre er din og står der uansett |
| Feltet er alltid ugyldig | `invalid="false"` er satt. Attributtet må fjernes, ikke settes til `false` |
| Komponenten gjør ingenting, og ingenting sier fra | Registreringen kjøres bare på serveren, der den ikke gjør noe. Den må også kjøre i nettleseren |
| `SyntaxError` i nettleseren | TypeScript-syntaks i en `<script type="module">` uten byggesteg |

## Når CSS ikke strekker til

Komponentene tilpasses med tokens og `--fs-`-variabler. Holder ikke det,
kopierer `npx @fristil/designsystem overta <komponent>` kildekoden til én
komponent inn i prosjektet, så du eier den. Et helt fargetema av merkefargene
dine lages med `npx @fristil/designsystem tema`.

Alt dette, med levende eksempler: https://fristil.sobernetics.no/
