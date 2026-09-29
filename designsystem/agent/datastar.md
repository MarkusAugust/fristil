# Fristil med Datastar

Regelboka for Fristil sammen med [Datastar](https://data-star.dev), som legger
reaktivitet på vanlig HTML med `data-*`-attributter. Ett skript, ingen
byggesteg, altså samme premiss som Fristil.

Det betyr to ting for denne fila: adressene er URL-er, siden en nettleser uten
bundles ikke slår opp et pakkenavn, og tilstanden styres med attributter, som
er nøyaktig det `ramme`-komponentene forventer.

Dette er @fristil/designsystem 0.21.0. Fila er generert av pakken og følger
versjonen, så den kan aldri stå og si noe annet enn koden ved siden av.

## Kortversjon

1. **Én `<link>` til `fristil.css`, før alt annet.** Mangler den, ser
   komponentene ustilte ut. Svaret er da å legge inn lenka, aldri å skrive
   egen CSS for å få dem til å se riktige ut.
2. **Bruk bare klassene og elementene i tabellene under.** `fs-modal`,
   `fs-datepicker` og `data-variant="outline"` finnes i andre designsystemer,
   ikke i Fristil. Er du usikker på om noe finnes, står det her eller så gjør
   det ikke det.
3. **Ingen hardkodede farger eller piksler.** `var(--fs-color-…)` og
   `var(--fs-spacing-…)`.
4. **`defineFs*()` kjøres én gang i en `<script type="module">` med hele
   URL-en,** og tilstanden settes med `data-attr:`, som legger på og fjerner
   attributtet. `invalid="false"` ville gjort feltet ugyldig.
5. **Kjør sjekken på det du har skrevet:**
   `npx @fristil/designsystem sjekk side.html`. Den kjenner hver klasse, hvert
   element, hvert attributt og hver lovlige verdi, skriver
   `fil:linje:kolonne: melding`, og avslutter med feilkode hvis den finner
   noe.

## 1. Stilarket og Datastar

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/dist/fristil.css">
<script
  type="module"
  src="https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.3/bundles/datastar.js"
></script>
```

`fristil.css` er rundt 75 kB, under 10 kB komprimert, og har alle
komponentene. Vil du bare ha det du bruker, gjelder at `tokens.css` definerer
alle variablene, og alle de andre stilarkene bygger på den. Den lastes derfor
først.

## 2. Hva som finnes

33 CSS-komponenter og 9 egendefinerte elementer, og dette er hele lista.
Klassene er `fs-` + kebab-case. Varianter er alltid `data-*`-attributter,
aldri egne klasser: `data-variant="secondary"`, ikke `fs-button--secondary`.
Standardvarianten har ingen attributt.

### CSS-komponenter (ingen JavaScript)

| Klasse | Stilark | Attributter |
| --- | --- | --- |
| `fs-accordion`<br>`fs-accordion__content` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/accordion/accordion.css` | `data-variant`: plain |
| `fs-alert`<br>`fs-alert__title` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/alert/alert.css` | `data-color`: info, success, warning, danger |
| `fs-avatar`<br>`fs-avatar-stack` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/avatar/avatar.css` | `data-variant`: square<br>`data-size`: small, large |
| `fs-badge` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/badge/badge.css` | `data-color`: success, warning, danger, neutral |
| `fs-breadcrumbs` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/breadcrumbs/breadcrumbs.css` | ingen |
| `fs-button` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/button/button.css` | `data-variant`: secondary, ghost, danger |
| `fs-card`<br>`fs-card__title` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/card/card.css` | `data-variant`: filled |
| `fs-checkbox`<br>`fs-checkbox-row` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/checkbox/checkbox.css` | `data-state`: invalid, success |
| `fs-divider` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/divider/divider.css` | `data-variant`: subtle, strong |
| `fs-error-text` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/error-text/error-text.css` | `data-variant`: warning |
| `fs-fieldset`<br>`fs-legend` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/fieldset/fieldset.css` | `data-state`: invalid, success<br>`data-required`: symbol, text |
| `fs-file-upload`<br>`fs-file-upload-list` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/file-upload/file-upload.css` | `data-state`: invalid, success |
| `fs-heading` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/heading/heading.css` | `data-size`: xs, s, m, xl, mega |
| `fs-help-text` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/help-text/help-text.css` | `data-variant`: default, success, warning |
| `fs-input` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/input/input.css` | `data-state`: invalid, success<br>`data-variant`: date, datetime-local, time |
| `fs-label` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/label/label.css` | `data-required`: symbol, text |
| `fs-link` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/link/link.css` | ingen |
| `fs-list` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/list/list.css` | `data-variant`: plain, divided |
| `fs-pagination`<br>`fs-pagination__gap` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/pagination/pagination.css` | ingen |
| `fs-paragraph` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/paragraph/paragraph.css` | `data-variant`: lead<br>`data-size`: small, large |
| `fs-radio`<br>`fs-radio-row` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/radio/radio.css` | `data-state`: invalid, success |
| `fs-search`<br>`fs-search-row` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/search/search.css` | `data-state`: invalid, success |
| `fs-select` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/select/select.css` | `data-state`: invalid, success<br>`data-picker`: styled |
| `fs-skeleton` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/skeleton/skeleton.css` | `data-variant`: text, circle |
| `fs-skip-link` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/skip-link/skip-link.css` | ingen |
| `fs-spinner` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/spinner/spinner.css` | `data-size`: small, large |
| `fs-sr-only` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/sr-only/sr-only.css` | ingen |
| `fs-switch`<br>`fs-switch-row` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/switch/switch.css` | ingen |
| `fs-table`<br>`fs-table-scroll` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/table/table.css` | `data-variant`: striped |
| `fs-tag` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/tag/tag.css` | `data-variant`: filled |
| `fs-textarea` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/textarea/textarea.css` | `data-state`: invalid, success |
| `fs-toggle-group`<br>`fs-toggle-group__option` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/toggle-group/toggle-group.css` | ingen |
| `fs-tooltip`<br>`fs-tooltip__bubble` | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/css/tooltip/tooltip.css` | ingen |

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

## 4. Web components

Tre regler gjelder alle sammen:

1. **`defineFs*()` kjøres én gang** i en `<script type="module">` i sidemalen.
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
| `<fs-field>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/ramme/field/field.css` | `defineFsField()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/dist/components/ramme/field/fs-field.js` | `invalid` (flag)<br>`disabled` (flag)<br>`optional` (flag)<br>`required-marker`: symbol, text, none<br>`control-id` (text)<br>`described-by` (text) | ingen |
| `<fs-tabs>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/ramme/tabs/tabs.css` | `defineFsTabs()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/dist/components/ramme/tabs/fs-tabs.js` | `server-controlled` (flag) | `fs-tabs__list`<br>`fs-tabs__panel` |
| `<fs-error-summary>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/ramme/error-summary/error-summary.css` | `defineFsErrorSummary()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/dist/components/ramme/error-summary/fs-error-summary.js` | `data-autofocus`: false<br>`hidden` (flag) | `fs-error-summary`<br>`fs-error-summary__title` |
| `<fs-popover>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/ramme/popover/popover.css` | `defineFsPopover()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/dist/components/ramme/popover/fs-popover.js` | `open` (flag)<br>`placement`: bottom-start, bottom-end, top-start, top-end<br>`server-controlled` (flag) | `fs-popover` |
| `<fs-suggestion>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/ramme/suggestion/suggestion.css` | `defineFsSuggestion()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/dist/components/ramme/suggestion/fs-suggestion.js` | `prefiltered` (flag)<br>`server-controlled` (flag) | `fs-suggestion__field`<br>`fs-suggestion__list`<br>`fs-suggestion__option`<br>`fs-suggestion__empty` |
| `<fs-dialog>` | ramme | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/ramme/dialog/dialog.css` | `defineFsDialog()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/dist/components/ramme/dialog/fs-dialog.js` | `open` (flag)<br>`server-controlled` (flag) | `fs-dialog`<br>`fs-dialog__body`<br>`fs-dialog__title`<br>`fs-dialog__footer`<br>`fs-dialog__header`<br>`fs-dialog__subtitle` |
| `<fs-toast>` | frittstaende | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/frittstaende/toast/toast.css` | `defineFsToast()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/dist/components/frittstaende/toast/fs-toast.js` | `duration` (number)<br>`label` (text) | `fs-toast`<br>`fs-toast__close` |
| `<fs-session-timeout>` | frittstaende | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/frittstaende/session-timeout/session-timeout.css` | `defineFsSessionTimeout()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/dist/components/frittstaende/session-timeout/fs-session-timeout.js` | `warn-at` (number)<br>`expires-at` (number) | `fs-session-timeout`<br>`fs-session-timeout__dialog`<br>`fs-session-timeout__title`<br>`fs-session-timeout__text`<br>`fs-session-timeout__count`<br>`fs-session-timeout__actions` |
| `<fs-connection-status>` | frittstaende | `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/src/components/frittstaende/connection-status/connection-status.css` | `defineFsConnectionStatus()` fra `https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/dist/components/frittstaende/connection-status/fs-connection-status.js` | `offline-text` (text)<br>`online-text` (text) | `fs-connection-status`<br>`fs-connection-status__bar` |

Ingen av dem bruker shadow DOM. Innholdet står i vanlig DOM, så
`querySelector`, `FormData` og vanlig CSS virker rett inn i det.

## 5. Et skjema med Datastar

```html
<form
  data-signals="{navn: '', beroert: false}"
  data-computed:ugyldig="$beroert && $navn.trim() === ''"
>
  <fs-field required-marker="symbol" data-attr:invalid="$ugyldig">
    <label>Fullt navn</label>
    <input
      class="fs-input"
      type="text"
      name="navn"
      data-bind:navn
      data-on:blur="$beroert = true"
    />
    <p class="fs-error-text">Fyll inn navnet ditt.</p>
  </fs-field>

  <button class="fs-button" type="submit">Send</button>
</form>

<script type="module">
  import { defineFsField } from
    "https://cdn.jsdelivr.net/npm/@fristil/designsystem@0.21.0/dist/components/ramme/field/fs-field.js"

  defineFsField()
</script>
```

`data-signals` oppretter tilstanden, `data-computed:ugyldig` utleder
valideringen av den, `data-bind:navn` binder feltet begge veier, og
`data-on:blur` markerer at brukeren har forlatt det.

`data-attr:invalid` er koblingen til komponenten: den setter attributtet når
uttrykket er sant og fjerner det når det er usant, nøyaktig slik `<fs-field>`
forventer. Ingen av React-fellene finnes her. Datastar jobber direkte på
attributtene.

## 6. HTML fra serveren

Datastar kan la serveren sende HTML underveis, over Server-Sent Events. Et
egendefinert element oppgraderer seg selv når det settes inn i dokumentet, så
lenge `defineFsField()` har kjørt én gang. Serveren kan derfor sende dette som
ren HTML:

```html
<fs-field required-marker="text" invalid>
  <label>E-postadresse</label>
  <input class="fs-input" type="email" value="ola@" />
  <p class="fs-help-text">Vi sender kvittering hit.</p>
  <p class="fs-error-text">Skriv en gyldig adresse.</p>
</fs-field>
```

Komponenten kobler da `for` og `id`, setter `fs-label`, legger på
`aria-invalid` og bygger `aria-describedby`, uten at det sendes JavaScript med
for akkurat dette feltet. Det er poenget med at `ramme`-komponentene bor i
vanlig DOM: markupen er dataen, og tilgjengeligheten kobles der den lander.

Patcher serveren en komponent som holder tilstand, er spørsmålet hvem som eier
den. Som standard eier komponenten den: `<fs-tabs>` husker fanen brukeren
valgte, og setter den tilbake når en patch river den bort. Skal serveren kunne
flytte den, sier du det med `server-controlled`:

```html
<fs-tabs server-controlled data-on:tab-select="$fane = evt.detail.index">
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
tilstand.

`fs` kan brukes på serveren eller i et byggesteg. Datastar trenger den ikke i
nettleseren.

## Kjente fallgruver

| Symptom | Årsak |
| --- | --- |
| Stilene mangler | `tokens.css` er ikke lastet, eller lastes etter komponentens eget stilark |
| Elementet vises ikke, siden ser tom ut | `define`-funksjonen har ikke kjørt |
| Feltet er alltid ugyldig | `invalid="false"` er satt. Attributtet må fjernes, ikke settes til `false` |
| `SyntaxError` i nettleseren | TypeScript-syntaks i en `<script type="module">` uten byggesteg |

## Når CSS ikke strekker til

Komponentene tilpasses med tokens og `--fs-`-variabler. Holder ikke det,
kopierer `npx @fristil/designsystem overta <komponent>` kildekoden til én
komponent inn i prosjektet, så du eier den. Et helt fargetema av merkefargene
dine lages med `npx @fristil/designsystem tema`.

Alt dette, med levende eksempler: https://fristil.netlify.app/
