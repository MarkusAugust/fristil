# LO-TEK med Datastar

Regelboka for LO-TEK sammen med [Datastar](https://data-star.dev), som legger
reaktivitet på vanlig HTML med `data-*`-attributter. Ett skript, ingen
byggesteg, altså samme premiss som LO-TEK.

Det betyr to ting for denne fila: adressene er URL-er, siden en nettleser uten
bundles ikke slår opp et pakkenavn, og tilstanden styres med attributter, som
er nøyaktig det `ramme`-komponentene forventer.

Dette er @lo-tek/interfaces 0.36.0. Fila er generert av pakken og følger
versjonen, så den kan aldri stå og si noe annet enn koden ved siden av.

## Kortversjon

1. **Én `<link>` til `lotek.css`, før alt annet.** Mangler den, ser
   komponentene ustilte ut. Svaret er da å legge inn lenka, aldri å skrive
   egen CSS for å få dem til å se riktige ut.
2. **Bruk bare klassene og elementene i tabellene under.** `lt-modal`,
   `lt-datepicker` og `data-variant="outlined"` finnes i andre designsystemer,
   ikke i LO-TEK. Er du usikker på om noe finnes, står det her eller så gjør
   det ikke det.
3. **Ingen hardkodede farger eller piksler.** `var(--lt-color-…)` og
   `var(--lt-spacing-…)`.
4. **`defineLt*()` kjøres én gang i en `<script type="module">` med hele
   URL-en,** og tilstanden settes med `data-attr:`, som legger på og fjerner
   attributtet. `hidden="false"` ville skjult feilmeldingen likevel.
5. **Kjør sjekken på det du har skrevet:**
   `npx @lo-tek/interfaces sjekk side.html`. Den kjenner hver klasse, hvert
   element, hvert attributt og hver lovlige verdi, skriver
   `fil:linje:kolonne: feil: melding`, eller `advarsel:`, og avslutter med
   feilkode hvis den finner noe. Med appen i gang, sjekk også hver side du har
   endret: `npx @lo-tek/interfaces sjekk http://localhost:8080/side`. Da
   kreves det i tillegg at hver `for` og `aria-describedby` peker på en id som
   finnes, og at hvert felt har en ledetekst. Du er ferdig når begge svarer
   «Markupen stemmer med LO-TEK».

## 1. Stilarket og Datastar

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/dist/lotek.css">
<script
  type="module"
  src="https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.4/bundles/datastar.js"
></script>
```

`lotek.css` er 103 kB, 13 kB komprimert, og har alle komponentene. Vil du bare
ha det du bruker, gjelder at `tokens.css` definerer alle variablene, og alle
de andre stilarkene bygger på den. Den må lastes, og står først av vane:
rekkefølgen mellom den og de andre har ikke noe å si.

## 2. Hva som finnes

35 CSS-komponenter og 9 web components, og dette er hele lista. Klassene er
`lt-` + kebab-case. Varianter er alltid `data-*`-attributter, aldri egne
klasser: `data-variant="secondary"`, ikke `lt-button--secondary`.
Standardvarianten har ingen attributt.

### CSS-komponenter (ingen JavaScript)

| Klasse | Stilark | Attributter |
| --- | --- | --- |
| `lt-accordion`<br>`lt-accordion__content` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/accordion/accordion.css` | `data-variant`: plain |
| `lt-alert`<br>`lt-alert__title` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/alert/alert.css` | `data-color`: info, success, warning, danger |
| `lt-avatar`<br>`lt-avatar-stack` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/avatar/avatar.css` | `data-variant`: square<br>`data-size`: small, large |
| `lt-badge` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/badge/badge.css` | `data-color`: success, warning, danger, neutral |
| `lt-breadcrumbs` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/breadcrumbs/breadcrumbs.css` | ingen |
| `lt-button` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/button/button.css` | `data-variant`: secondary, ghost, danger |
| `lt-card`<br>`lt-card__title` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/card/card.css` | `data-variant`: filled<br>`data-interactive` (flag) |
| `lt-checkbox`<br>`lt-checkbox-row` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/checkbox/checkbox.css` | `data-state`: invalid, success |
| `lt-divider` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/divider/divider.css` | `data-variant`: subtle, strong |
| `lt-error-text` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/error-text/error-text.css` | `data-variant`: warning |
| `lt-fieldset`<br>`lt-legend` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/fieldset/fieldset.css` | `data-state`: invalid, success<br>`data-required`: symbol, text<br>`data-optional` (flag) |
| `lt-file-upload`<br>`lt-file-upload-list` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/file-upload/file-upload.css` | `data-state`: invalid, success |
| `lt-heading` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/heading/heading.css` | `data-size`: xs, s, m, xl, mega |
| `lt-help-text` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/help-text/help-text.css` | `data-variant`: strong, success, warning |
| `lt-icon` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/icon/icon.css` | ingen |
| `lt-input` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/input/input.css` | `data-state`: invalid, success<br>`data-variant`: date, datetime-local, time |
| `lt-label` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/label/label.css` | `data-required`: symbol, text<br>`data-optional` (flag) |
| `lt-link` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/link/link.css` | ingen |
| `lt-list` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/list/list.css` | `data-variant`: plain, divided |
| `lt-pagination`<br>`lt-pagination__gap` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/pagination/pagination.css` | ingen |
| `lt-paragraph` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/paragraph/paragraph.css` | `data-variant`: lead<br>`data-size`: small, large |
| `lt-progress` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/progress/progress.css` | `data-color`: success, warning, danger |
| `lt-radio`<br>`lt-radio-row` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/radio/radio.css` | `data-state`: invalid, success |
| `lt-search`<br>`lt-search-row` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/search/search.css` | `data-state`: invalid, success |
| `lt-select` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/select/select.css` | `data-state`: invalid, success<br>`data-picker`: styled |
| `lt-skeleton` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/skeleton/skeleton.css` | `data-variant`: text, circle |
| `lt-skip-link` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/skip-link/skip-link.css` | ingen |
| `lt-spinner` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/spinner/spinner.css` | `data-size`: small, large |
| `lt-sr-only` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/sr-only/sr-only.css` | ingen |
| `lt-switch`<br>`lt-switch-row` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/switch/switch.css` | ingen |
| `lt-table`<br>`lt-table__sort`<br>`lt-table-scroll` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/table/table.css` | `data-variant`: striped<br>`data-hoverable` (flag) |
| `lt-tag` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/tag/tag.css` | `data-variant`: filled<br>`data-selectable` (flag) |
| `lt-textarea` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/textarea/textarea.css` | `data-state`: invalid, success |
| `lt-toggle-group`<br>`lt-toggle-group__option` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/toggle-group/toggle-group.css` | ingen |
| `lt-tooltip`<br>`lt-tooltip__bubble` | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/css/tooltip/tooltip.css` | ingen |

I tillegg finnes `lt-theme-control`, en klasse på en radioknapp som lar
brukeren velge tema. Den står i `tokens.css`, og er beskrevet under Tokens.

## 3. Tokens

Ett lag. En farge er en celle i en matrise av **familie**, altså hva den
betyr, og **rolle**, altså hva den gjør, og navnet er
`--lt-color-<familie>-<rolle>`. Hver familie har hver rolle, så
`--lt-color-danger-border` og `--lt-color-success-border` finnes begge.
Rollene er de samme uansett familie: `surface` er en tonet flate, `fill` en
fylt, `content` teksten oppå `fill`, `border` en ramme, og `text` familiens
farge som tekst. Kant og tekst har et svakere og et sterkere trinn ved siden
av.

```
Familier: `accent`, `visited`, `brand1`, `brand2`, `brand3`, `neutral`, `danger`, `warning`, `success`.

Roller: `surface`, `border-subtle`, `border`, `border-strong`, `fill`, `text`, `text-strong`, `text-subtle`, `content`.

Utenfor matrisen: `--lt-color-disabled-surface`, `--lt-color-disabled-text`, `--lt-color-neutral-canvas`, `--lt-color-neutral-raised`, `--lt-color-overlay`, `--lt-focus-ring`, `--lt-icon-calendar`, `--lt-icon-check`, `--lt-icon-clock`, `--lt-icon-dash`, `--lt-icon-search`, `--lt-shadow-overlay`.
```

Mål: `--lt-spacing-0-5`, `--lt-spacing-1`, `--lt-spacing-10`,
`--lt-spacing-12`, `--lt-spacing-16`, `--lt-spacing-2`, `--lt-spacing-3`,
`--lt-spacing-4`, `--lt-spacing-5`, `--lt-spacing-6`, `--lt-spacing-7`,
`--lt-spacing-8`, `--lt-spacing-px`.

Skrift: `--lt-font-size-l`, `--lt-font-size-m`, `--lt-font-size-mega`,
`--lt-font-size-reference`, `--lt-font-size-s`, `--lt-font-size-xl`,
`--lt-font-size-xs`, `--lt-font-size-xxl`, `--lt-font-size-xxs`,
`--lt-font-weight-bold`, `--lt-font-weight-medium`,
`--lt-font-weight-regular`, `--lt-font-weight-semibold`.

Linjehøyde: `--lt-line-height-article`, `--lt-line-height-compact`,
`--lt-line-height-default`, `--lt-line-height-heading`.

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

Det er dette en innebygd komponent skal bruke. Legger du LO-TEK inn i en side
du ikke eier, setter du attributtet på komponentens eget rotelement:

```html
<div data-theme="light">
  <button class="lt-button">Lagre</button>
</div>
```

Da er komponenten lys uansett hva maskinen står på, og verten røres ikke.

**Vertens CSS stopper ved grensen.** Verten har ofte regler uten lag, som
`button { background: none; border: none }` eller en normalize, og de slår
`@layer lotek`. Sett da `data-lt-boundary` på det samme rotelementet:

```html
<div data-lt-boundary data-theme="light">
  <button class="lt-button">Lagre</button>
</div>
```

Under rotelementet ser nettleseren bort fra CSS uten lag, innenfor
spesifisiteten under, og LO-TEKs lag gjelder igjen. Regelen ligger i
`lotek.css` og i `@lo-tek/interfaces/boundary.css`. Skrift og annet som arves
kommer fortsatt fra verten, og `--lt-*`-variablene virker. Tre ting følger av
den:

- Egen CSS inne i grensen skal ligge i et lag etter `lotek`. CSS uten lag
  forsvinner der på samme måte som vertens.
- Elementer uten LO-TEK-klasse mister vertens CSS uten lag. Et lag verten har
  erklært før `lotek`, som Tailwinds Preflight i `base`, gjelder fortsatt der
  LO-TEK ikke setter noe.
- Grensen har spesifisiteten (0,2,0). En regel fra verten med samme
  spesifisitet vinner hvis den lastes etter grensen, og en med mer vinner
  alltid. Det samme gjør `!important` og lag verten har erklært etter `lotek`.

LO-TEK setter **ikke** `color-scheme` på `:root`. Egenskapen styrer
nettleserens egne flater, altså rullefelt, nedtrekkslister og kalenderpanel,
og den arves nedover. Et barn kan melde seg ut med `color-scheme: normal`, men
det er en motregel verten aldri ba om å måtte skrive: sto verdien på roten,
gjaldt den hele dokumentet, også der pakken bare er en gjest. Vil hele siden
følge systemet, skriver du `color-scheme: light dark` på `<html>` selv, på
samme måte som du selv setter lagrekkefølgen. Unntaket er temavelgeren under:
bruker du den, setter hvert valg `color-scheme` selv.

### La brukeren velge tema

`lt-theme-control` på en radioknapp gjør `value` til et temavalg. Det er ren
CSS, uten en linje JavaScript:

```html
<fieldset class="lt-toggle-group">
  <legend class="lt-sr-only">Tema</legend>
  <label class="lt-toggle-group__option">
    <input class="lt-theme-control" type="radio" name="tema"
           value="auto" checked /> Følg systemet
  </label>
  <label class="lt-toggle-group__option">
    <input class="lt-theme-control" type="radio" name="tema"
           value="light" /> Lyst
  </label>
  <label class="lt-toggle-group__option">
    <input class="lt-theme-control" type="radio" name="tema"
           value="dark" /> Mørkt
  </label>
</fieldset>
```

Valget styrer to ting. LO-TEKs farger kommer fra tokenene, og nettleserens
**egne** flater fra `color-scheme`: `light` gir `light`, `dark` gir `dark`, og
`auto` gir `light dark`. `light dark` er ikke et tema, men beskjeden om at
siden fungerer i begge, så nettleseren kan velge etter systemet.

«Følg systemet» har ingen temablokk, og det er med vilje: en verdi uten blokk
treffer ingenting, og da gjelder mediespørringen igjen.

Du skal ikke skrive `color-scheme` selv når velgeren er i bruk. En slik regel
utenfor et lag slår `@layer lotek` og låser nettleserens flater til systemet
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

1. **`defineLt*()` kjøres én gang** i en `<script type="module">` i sidemalen.
   Importen har ingen bivirkning alene; det er `define`-kallet som registrerer
   elementet.
2. **Boolske attributter er sanne så lenge de finnes.** `hidden="false"`,
   `disabled="false"` og `open="false"` slår *på*. Skal noe av det bort, må
   attributtet fjernes helt.
3. **Du skriver markupen, komponenten fester oppførselen.** `<lt-field>` lager
   ikke ledeteksten eller kontrollen din. Du skriver `for` på ledeteksten og
   `id` på kontrollen, eller legger `<label>` rundt den, så feltet har navn
   også uten JavaScript. Komponenten kobler hjelpeteksten og feilmeldingen med
   `aria-describedby` og `aria-invalid`, og skriver aldri id på kontrollen: en
   id serveren ikke sendte, gjør at en oppdatering fra serveren bytter ut
   feltet, med fokus og det brukeren har skrevet. Feltet er ugyldig når
   feilmeldingen står uten `hidden`.

| Element | Kategori | Stilark | Registrering | Attributter | Hendelser | Klasser inni |
| --- | --- | --- | --- | --- | --- | --- |
| `<lt-field>` | frame | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/frame/field/field.css` | `defineLtField()` fra `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/dist/components/frame/field/lt-field.js` | `disabled` (flag)<br>`optional` (flag)<br>`described-by` (text) | ingen | ingen |
| `<lt-tabs>` | frame | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/frame/tabs/tabs.css` | `defineLtTabs()` fra `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/dist/components/frame/tabs/lt-tabs.js` | `server-controlled` (flag)<br>`activation`: manual, automatic | `tab-select` (index) | `lt-tabs__list`<br>`lt-tabs__panel` |
| `<lt-error-summary>` | frame | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/frame/error-summary/error-summary.css` | `defineLtErrorSummary()` fra `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/dist/components/frame/error-summary/lt-error-summary.js` | `data-autofocus`: false, true<br>`hidden` (flag) | ingen | `lt-error-summary`<br>`lt-error-summary__title` |
| `<lt-popover>` | frame | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/frame/popover/popover.css` | `defineLtPopover()` fra `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/dist/components/frame/popover/lt-popover.js` | `open` (flag)<br>`placement`: bottom-start, bottom-end, top-start, top-end<br>`server-controlled` (flag) | `popover-toggle` (open) | `lt-popover` |
| `<lt-suggestion>` | frame | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/frame/suggestion/suggestion.css` | `defineLtSuggestion()` fra `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/dist/components/frame/suggestion/lt-suggestion.js` | `prefiltered` (flag)<br>`count-none` (text)<br>`count-zero` (text)<br>`count-one` (text)<br>`count-two` (text)<br>`count-few` (text)<br>`count-many` (text)<br>`count-other` (text)<br>`server-controlled` (flag) | `suggestion-select` (value, label) | `lt-suggestion__list`<br>`lt-suggestion__option`<br>`lt-suggestion__value`<br>`lt-suggestion__empty` |
| `<lt-dialog>` | frame | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/frame/dialog/dialog.css` | `defineLtDialog()` fra `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/dist/components/frame/dialog/lt-dialog.js` | `open` (flag)<br>`server-controlled` (flag) | `dialog-toggle` (open, returnValue) | `lt-dialog` (`data-color`: brand, info, success, warning, danger)<br>`lt-dialog__body`<br>`lt-dialog__title`<br>`lt-dialog__footer`<br>`lt-dialog__header`<br>`lt-dialog__subtitle` |
| `<lt-toast>` | standalone | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/standalone/toast/toast.css` | `defineLtToast()` fra `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/dist/components/standalone/toast/lt-toast.js` | `duration` (number)<br>`label` (text)<br>`close-label` (text) | `toast-dismiss` | `lt-toast`<br>`lt-toast__message`<br>`lt-toast__close` |
| `<lt-session-timeout>` | frame | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/frame/session-timeout/session-timeout.css` | `defineLtSessionTimeout()` fra `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/dist/components/frame/session-timeout/lt-session-timeout.js` | `warn-at` (number)<br>`expires-at` (number)<br>`activity-interval` (number) | `session-warn`<br>`session-extend`<br>`session-logout`<br>`session-expired`<br>`session-activity` | `lt-session-timeout`<br>`lt-session-timeout__dialog`<br>`lt-session-timeout__title`<br>`lt-session-timeout__text`<br>`lt-session-timeout__count`<br>`lt-session-timeout__actions` |
| `<lt-connection-status>` | standalone | `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/src/components/standalone/connection-status/connection-status.css` | `defineLtConnectionStatus()` fra `https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/dist/components/standalone/connection-status/lt-connection-status.js` | `offline-text` (text)<br>`online-text` (text) | `connection-lost`<br>`connection-restored` | `lt-connection-status`<br>`lt-connection-status__bar` |

Ingen av dem bruker shadow DOM. Innholdet står i vanlig DOM, så
`querySelector`, `FormData` og vanlig CSS virker rett inn i det.

## 5. Et skjema med Datastar

```html
<form
  data-signals="{navn: '', beroert: false}"
  data-computed:ugyldig="$beroert && $navn.trim() === ''"
>
  <lt-field>
    <label class="lt-label" for="navn" data-required="symbol">Fullt navn</label>
    <input
      class="lt-input"
      id="navn"
      type="text"
      name="navn"
      data-bind:navn
      data-on:blur="$beroert = true"
    />
    <p class="lt-error-text" hidden data-attr:hidden="!$ugyldig">Fyll inn navnet ditt.</p>
  </lt-field>

  <button class="lt-button" type="submit">Send</button>
</form>

<script type="module">
  import { defineLtField } from
    "https://cdn.jsdelivr.net/npm/@lo-tek/interfaces@0.36.0/dist/components/frame/field/lt-field.js"

  defineLtField()
</script>
```

`data-signals` oppretter tilstanden, `data-computed:ugyldig` utleder
valideringen av den, `data-bind:navn` binder feltet begge veier, og
`data-on:blur` markerer at brukeren har forlatt det.

`data-attr:hidden` på feilmeldingen er koblingen til komponenten: den setter
`hidden` når feltet er gyldig og fjerner det når det er ugyldig, og
`<lt-field>` regner feltet som ugyldig når feilmeldingen synes. Ingen av
React-fellene finnes her. Datastar jobber direkte på attributtene.

## 6. HTML fra serveren

Datastar kan la serveren sende HTML underveis, over Server-Sent Events. En web
component oppgraderer seg selv når den settes inn i dokumentet, så lenge
`defineLtField()` har kjørt én gang. Serveren kan derfor sende dette som ren
HTML:

```html
<lt-field>
  <label class="lt-label" for="epost" data-required="text">E-postadresse</label>
  <input class="lt-input" id="epost" type="email" value="ola@" />
  <p class="lt-help-text">Vi sender kvittering hit.</p>
  <p class="lt-error-text">Skriv en gyldig adresse.</p>
</lt-field>
```

Komponenten setter da `lt-label`, gir hjelpeteksten og feilmeldingen id,
legger på `aria-invalid` fordi feilmeldingen synes, og bygger
`aria-describedby`, uten at det sendes JavaScript med for akkurat dette
feltet. Det er poenget med at `ramme`-komponentene bor i vanlig DOM: markupen
er dataen, og tilgjengeligheten kobles der den lander.

Patcher serveren en komponent som holder tilstand, er spørsmålet hvem som
bestemmer den. Som standard gjør web-komponenten det: `<lt-tabs>` husker fanen
brukeren valgte, og setter den tilbake når en patch med `outer` river den
bort: `outer` morfer, og valget er knyttet til selve lenken. `inner` og
`replace` bytter ut nodene, og da velger komponenten fanen adressen peker på,
ellers den serveren skjulte de andre panelene for med `hidden="until-found"`,
ellers den første. Og `outer` morfer bare når id-ene stemmer: et element med
en id serveren ikke sendte byttes ut. Komponentene skriver derfor aldri id på
det brukeren rører. Fanene er lenker uten id, og panelene har den id-en lenken
peker på, den samme ved hver rendring, som `lt.tabs()` skriver den. Panelet i
`<lt-popover>` trenger id på samme måte; komponenten lager ingen. Kontrollen i
`<lt-field>` og feltet i `<lt-suggestion>` får aldri id fra komponenten: `for`
og `id` skriver malen, som HTML krever for at feltet skal ha navn uten
JavaScript, eller så står ledeteksten rundt feltet og ingen id trengs.
Komponenten sier fra i konsollen første gang en patch bytter ut noe brukeren
hadde rørt. Skal serveren kunne flytte fanen, sier du det med
`server-controlled`:

```html
<lt-tabs server-controlled data-on:tab-select="$fane = evt.detail.index">
  <ul class="lt-tabs__list" aria-label="Deler av saken">
    <li><a href="#soknaden">Søknaden</a></li>
    <li><a href="#vedlegg">Vedlegg</a></li>
  </ul>
  <section class="lt-tabs__panel" id="soknaden">…</section>
  <section class="lt-tabs__panel" id="vedlegg" hidden="until-found">…</section>
</lt-tabs>
```

Attributtet finnes på `<lt-tabs>`, `<lt-popover>`, `<lt-dialog>` og
`<lt-suggestion>`. Uten det ville serveren og komponenten kjempet om samme
tilstand.

`lt` kan brukes på serveren eller i et byggesteg. Datastar trenger den ikke i
nettleseren.

## Kjente fallgruver

| Symptom | Årsak |
| --- | --- |
| Stilene mangler | `tokens.css` er ikke lastet. Rekkefølgen mellom den og komponentens stilark betyr ikke noe |
| En `<lt-toast>` eller `<lt-connection-status>` viser ingenting, et `<lt-session-timeout>` varsler aldri, eller en annen komponent gjør ingenting | `define`-funksjonen har ikke kjørt. `<lt-toast>` og `<lt-connection-status>` lager innholdet sitt selv og er tomme uten den, og `<lt-session-timeout>` teller ikke tiden. Markupen i de andre er din og står der uansett, bortsett fra at `<lt-tabs>` bare viser ett panel, det adressen peker på eller det første, og `<lt-suggestion>` skjuler lista til de er registrert |
| En komponent snakker norsk på en side på et annet språk | Teksten i markupen er din, og skrives med appens eget oppsett for oversettelse. De få standardtekstene pakken har byttes med `label` og `close-label` på `<lt-toast>`, `offline-text` og `online-text` på `<lt-connection-status>`, `count-none`, `count-one` og `count-other` på `<lt-suggestion>`, og `--lt-label-required-text`, `--lt-label-optional-text` og `--lt-label-required-symbol` i CSS. Tall og varigheter følger `lang` på `<html>`. Se https://lo-tek.sobernetics.no/translation/ |
| Feilmeldingen vises aldri, og feltet regnes som gyldig | `hidden="false"` er satt på feilmeldingen, og det skjuler den like fullt. Attributtet må fjernes, ikke settes til `false` |
| `SyntaxError` i nettleseren | TypeScript-syntaks i en `<script type="module">` uten byggesteg |

## Når CSS ikke strekker til

Komponentene tilpasses med tokens og `--lt-`-variabler. Holder ikke det,
kopierer `npx @lo-tek/interfaces overta <komponent>` kildekoden til én
komponent inn i prosjektet, så du eier den. Et helt fargetema av merkefargene
dine lages med `npx @lo-tek/interfaces tema`.

Alt dette, med levende eksempler: https://lo-tek.sobernetics.no/
