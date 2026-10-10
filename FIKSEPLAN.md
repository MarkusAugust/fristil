# Fikseplan for Fristil 0.32.1 (versjon 3, testet mot koden)

Planen samler funnene fra revisjonen.

- **Versjon 2** tok inn to lesende gjennomganger.
- **Versjon 3** tar inn to testere som gjorde tre ting for hvert punkt:
  1. gjenskapte funnet på uendret kode, i Chromium 141, med den native CLI-en, `cargo test` og pakken fra `npm pack`;
  2. la inn fiksen i en egen kopi av repoet;
  3. kjørte de eksisterende testene på nytt.

**Status:**

- Uten endringer er 1383 nettlesertester grønne.
- Firefox, WebKit, Kotlin/Gradle (Maven Central svarte 429) og skjermleser er **ikke** testet.
- Prototypene ligger i to lokale arbeidstrær som er gitignorert: ett for PR 0–3 og ett for PR 4–8.

**Merking i tabellene:**

- ✅ = gjenskapt og fiksen bekreftet i Chromium.
- 🔶 = gjenskapt, men fiksen er ikke prototypet eller bare delvis testet.
- 📖 = bare dokumentasjon eller lesing.
- ❓ = kan ikke testes her.

Testkonfigurasjonen for Chromium (`vitest.chromium.config.ts` med `executablePath: "/opt/pw-browsers/chromium"`) bør tas med i repoet, slik at testene kan kjøres i et miljø uten Playwrights egne nettlesere.

Hver PR skal gjennom `bun run sjekk` og få en oppføring i `designsystem/CHANGELOG.md`. Endrer en PR en byggefunksjon eller en kjerneregel, skal Kotlin-pariteten med i samme PR: `Handwritten.kt`, `ContractTest` og `kjerne/paritet`.

Merket **[BESLUTNING]** betyr at eieren må velge før arbeidet starter. Alvorlighet: **H** = høy, **M** = middels, **L** = lav.

---

## PR 0: Låsefila

| # | Alv. | Funn | Fiks |
|---|---|---|---|
| 0.1 ✅ | L | `bun.lock` har editor 0.7.0, mens `editor/package.json` har 0.8.0. **CI er ikke rødt:** `--frozen-lockfile` består med både bun 1.3.14 og 1.4.2. | Kjør `bun install` og commit låsefila. Den er bare utdatert, så den kan følge med en hvilken som helst PR. |

## PR 1: Dialog og popover

| # | Alv. | Funn | Fiks | Test |
|---|---|---|---|---|
| 1.1 ✅ | **H** | `returnValue` blir stående fra forrige lukking. **Rettet etter testing:** Escape etter «Slett» gir `""` i Chromium, fordi nettleseren nullstiller selv. Feilen viser seg i to andre tilfeller. (a) Lukker serveren eller appen dialogen med `close()` uten argument, melder den `{open:false, returnValue:"slett"}`. (b) En dialog som er flyttet i DOM åpnes ikke av serveren (`:modal` blir false). | Sett `dialog.returnValue = ""` rett før `showModal()` (`fs-dialog.ts:354`). **Ikke** før sjekken på `:328`. Innfør en bryter (`userClosedBeforeUpgrade`) som bare regnes ut ved den aller første `sync()`. Ikke nullstill i `handleClose`. Dokumentasjonen skal advare om `close()` uten argument, ikke om Escape. | 48/48 i `dialog.browser.test.ts` består med fiksen. Testene i prototypen dekker serverlukking og flytting. Firefox og WebKit er ikke testet. |
| 1.2 ✅ | M | Popover-utløseren sender inn skjemaet: ett `submit` per klikk. | Komponenten setter `type="button"` når `localName === "button"` og `type` mangler. Legg `"type"` i `attributeFilter` (`fs-popover.ts:118-126`). `popover()`-utløseren får `type: "button"`. `generate` endrer `manifest.json`, `byggetilfeller.json` og regelbøkene. `classes.ts` og `web-types` endres **ikke**. Snippetene kommer fra `popover.mdx`, så mdx-en (`:46,172,205`) må rettes for at de skal bli riktige. Kotlin (`Fs.kt`) må regenereres og testes. | Ingen `submit`, heller ikke etter at `type` er fjernet. |
| 1.3 ✅ | M | Escape i popoveren virker globalt og flytter fokus. | Gjør ingenting hvis `event.defaultPrevented`. Lukk bare når tastetrykket kom fra knappen eller panelet, eller når fokus står på `body`. **Rettet etter testing:** flytt fokus til knappen når fokus var i panelet, på knappen **eller på `body`**. Ellers brekker den eksisterende testen «lukker på Escape og gir fokus tilbake til knappen» (fokus står på `body` etter et museklikk i Safari). | Popover- og suggestion-testene er grønne med den rettede regelen. |
| 1.4 ✅ | M | `data-color="neutral"` på dialog gir 20 px luft mot 8 px uten attributtet. | `.fs-dialog:is(:not([data-color]), [data-color="neutral"])` (`dialog.css:204-217`). Skrevet som en selektorliste mister den `.fs-dialog`. | `css-vitne` og `build` er grønne. |
| 1.5 ✅ | L | En dialog som fjernes mens den er åpen sender ikke `open:false`. Flyttes den i samme oppgave, sendes en ekstra `open:true`. | Sjekk i en mikrooppgave om `!this.isConnected` fortsatt gjelder. Send da `open:false`. Send enten begge hendelsene i paret eller ingen av dem, styrt av en bryter. **Bryteren må nullstilles i `connectedCallback`.** | |

## PR 2: Tema og kontrast

| # | Alv. | Funn | Fiks | Test |
|---|---|---|---|---|
| 2.1 ✅ | **H** | En `<div data-theme="dark">` på en lys side har gjennomsiktig bakgrunn, så teksten blir lys på hvitt. Det bryter «alt under det får temaet» (`tilpasning.mdx:57`). I auto-modus på hele siden mangler `kom-i-gang` linjene du må skrive selv. | Pakken styler med vilje ikke rota (`tilpasning.mdx:121`, `sideskjelett.mdx:93`), og det skal den fortsatt ikke. Legg i `@layer fristil` (generert fra `tokens.ts`): `:where([data-theme="light"], [data-theme="dark"]) { background-color: var(--fs-color-neutral-canvas); color: var(--fs-color-neutral-text); }`. `:where` gir spesifisitet 0, så en `fs-card` med `data-theme` beholder sin egen bakgrunn (testet). **Rettet etter testing:** bare `light` og `dark`, siden bar `[data-theme]` også treffer `auto`, skrivefeil og andre bibliotekers `data-theme`, som daisyUI. Målt: nøstet `.fs-paragraph` hadde 1,23:1, og med fiksen har diven `rgb(17,18,18)`. Docs-siden har `<html data-theme="dark">` og må sjekkes. I «Kom i gang» legges sideskjelettets linjer inn (`color-scheme: light dark` og bakgrunn og farge på `body`). **[BESLUTNING]** Skal `:where([data-theme])` også treffe `<html data-theme>`? Anbefaling: ja, siden konsumenten der selv har valgt tema. Legg også `color-scheme: dark` i mediespørringsblokka hvis den mangler for `[data-theme]`-valgene. | `<div data-theme="dark">` på lys side har mørk bakgrunn. `<div data-theme="dark" class="fs-card">` beholder kortets bakgrunn. axe i nøstet tema. **Merk:** `monter()` setter selv bakgrunn på `body` (`testing/a11y.ts:24`), og det skjulte feilen. |
| 2.2 ✅ | **H** | Fokusringen og avslått tilstand følger ikke et nøstet tema. Målt: ringen i en mørk seksjon var `rgb(57,96,140)` mot forventet `rgb(133,174,223)`. Fiksen er testet, også med et generert tema. | Én generert regel: `:root, [data-theme] { --fs-focus-ring: …; --fs-color-disabled-surface: …; --fs-color-disabled-text: … }`. Temageneratoren trenger ingen endring, fordi `var()` da regnes ut mot fargene på hvert temaelement. Dokumenter at en overstyring av `--fs-focus-ring` på `:root` ikke gjelder inne i et nøstet `[data-theme]`, slik det alt er for fargene. | Beregnet `outline-color` og avslått bakgrunn i `<div data-theme="dark">` på lys side, og omvendt. Også med et generert tema nøstet inne i siden. |
| 2.3 ✅ | **H** | Fokusringen på valgt Toggle Group er 1,23:1 i lyst og 2,01:1 i mørkt tema. Fiksen gir ≥ 3:1 i begge. | Mønsteret fra `select.css:264-266`: `.fs-toggle-group__option:has(input:checked:focus-visible) { outline-color: var(--fs-color-accent-content) }`. Kontrasten `content` mot `fill` er alt lovet. **Ikke** positiv `outline-offset`, siden gruppa har `overflow: hidden` (`toggle-group.css:11`) og ringen da klippes. Ingen andre komponenter tegner ringen oppå `fill` (sjekket med grep). | Kontrast mellom ring og valgt flate ≥ 3:1 i begge temaer. |
| 2.4 📖 | L | Haken i Checkbox følger ikke en `accent-content` som er overstyrt for hånd. | `mask-image` på `<input>` klipper hele boksen, og Firefox tegner ikke pseudoelementer på `<input>`. Dokumenter i `tilpasning.mdx` at den som overstyrer `accent-content` eller `fill` for hånd også må sette `--fs-icon-check` og `--fs-icon-dash`. Valgfritt: la temageneratoren (`theme.ts` og `mod.rs`) bake `accent-content` inn i ikonene. | |
| 2.5 ✅ | L | Sporet i Progress er 1,12:1 mot `canvas`. Ikke et sikkert brudd på 1.4.11. | Behold sporet `neutral-surface` og legg på `border: 1px solid var(--fs-color-neutral-border)`. | Målt: kanten mot `canvas` er 4,37/5,27 og fyllet mot sporet 4,73/4,81 (lyst/mørkt). |
| 2.6 | — | Kanten på `fs-tag[data-selectable]` | **Tas ut.** En knapp med tekst trenger ikke kant etter 1.4.11, og `borderSubtle` står med vilje uten løfte. | |

## PR 3: CSS-tilgjengelighet

| # | Alv. | Funn | Fiks | Test |
|---|---|---|---|---|
| 3.1 🔶 | **H** | `hidden` virker ikke. Testet: **42 klasser, 8 elementer og 2 tilfeller med høy spesifisitet**, flere enn de 25 versjon 2 nevnte. | Én regel i `@layer fristil` (`tokens.ts`): `:is([class^="fs-"], [class*=" fs-"], fs-field, fs-tabs, fs-suggestion, fs-dialog, fs-popover, fs-toast, fs-error-summary, fs-session-timeout, fs-connection-status)[hidden]:not([hidden="until-found" i]) { display: none !important; }`. **Rettet etter testing:** (a) `[class*="fs-"]` traff fremmede klasser som `gifs-grid`, så det må være `^=`/`*=" "`. (b) Barn uten `fs-`-klasse er ikke dekket: `.fs-select[data-picker=styled] option[hidden]` og `.fs-pagination span[aria-disabled][hidden]` er fortsatt synlige, så de trenger egne regler: `.fs-select option[hidden]` og `.fs-pagination [hidden]`. (c) Versjon 2 sa feilaktig at konsumenten kan overstyre med `!important` uten lag. `!important` i et lag slår `!important` uten lag, og det er målt. Dette må dokumenteres. (d) Biome krever `biome-ignore` for `noImportantStyles`. **[BESLUTNING]** Godtar vi at `hidden` ikke kan overstyres? Alternativet er én regel `.fs-x[hidden]` per komponent uten `!important`, men da taper den mot varianter med høyere spesifisitet. | Alle klassene × 22 tagger × variantene. Ingen eksisterende test feilet. |
| 3.2 🔶 | **H** | Avslått lenke kan følges med Enter (testet: `location.hash` blir `#fulgt`). | `link()` skriver aldri `href`, så fiksen ligger i dokumentasjonen og diagnostikken. Avslått lenke skrives uten `href`, med `role="link"`, `aria-disabled="true"` og eventuelt `tabindex="0"`. `link({ disabled: true })` returnerer `role="link"`. Ny kjerneregel melder `fs-link` eller `fs-button` med både `aria-disabled="true"` og `href`. Rett `link.mdx:53` (viser `href="#"`) og `button.mdx:96`. Kotlin: `link` er generert fra manifestet. `Handwritten.kt:26` i versjon 2 var feil (det er `marked()` for label og legend). Kjerneregelen og Kotlin er ikke prototypet. | Kjernefikstur. Byggefunksjonen med `disabled` gir `role`. |
| 3.3 ✅ | M | Gjeldende side i Pagination blir **hvit på hvit** under musa i høykontrast (målt). | `@media (forced-colors: active) { .fs-pagination [aria-current="page"], .fs-pagination [aria-current="page"]:hover { … } }`. **Brekker vakten** «lista er komplett» i `hover.browser.test.ts`, som må oppdateres i samme PR. | Høykontrasttest med hover. |
| 3.4 ✅ | M | Ubestemt Progress blir en tom boks i høykontrast. | `.fs-progress:indeterminate { forced-color-adjust: none }` i `forced-colors`, med gradienten i systemfarger (`Canvas`/`Highlight`) og ramme i `CanvasText`. Legg Progress i tabellen i `tilgjengelighet.mdx`. | Del av 7.1. |
| 3.5 ✅ | M | Skilletegnet i Breadcrumbs leses opp i hver sti. Målt: 2 tekstnoder «/» i tilgjengelighetstreet. Etter fiksen er det 0. | `content: "/"` og så `@supports (content: "/" / "") { … { content: "/" / ""; } }`. **Rettet etter testing:** versjon 2 brukte `"x"` i `@supports`, og da stopper `sjekk:tekster` bygget. Uten det faller hele deklarasjonen bort i Safari < 17.4 og Firefox < 128, og da forsvinner skilletegnet. To `content` etter hverandre stoppes trolig av Biome. Rett kommentaren i `breadcrumbs.css:23-24`. | CDP `Accessibility.getFullAXTree` med `frameId` for testens iframe. Uten `frameId` gir den 0 noder og blir grønn uten å teste noe. |
| 3.6 ✅(a,c) | M | Tooltip bryter 1.4.13. Gapet lukker boblen, og Escape mangler. En skjult boble ved høyre kant gir overløp: `scrollWidth` 449 mot `clientWidth` 360, og 360 med fiksen. **(c) brekker to eksisterende tester:** `tooltip.browser.test.ts` («holder teksten i tilgjengelighetstreet», som krever `visibility`, ikke `display`) og `retning.browser.test.ts` (måler en skjult boble). Begge må skrives om i samme PR. Beskrivelsen fra en boble med `display:none` virker i Chromium, men Firefox og WebKit er ikke verifisert. | (a) En usynlig bro (`::before` på boblen) over gapet. (c) `display: none` når skjult, `transition-behavior: allow-discrete` og `@starting-style` for inntoning (uten støtte blir det bare ingen toning). Oppdater kommentaren på `tooltip.css:24-26`. (b) Escape **[BESLUTNING]**: en ny liten `ramme`-komponent som setter `data-dismissed` på Escape og fjerner det på `pointerleave`/`focusout`, mens CSS respekterer attributtet. Det har stort omfang (eksport, register, manifest, metadata, Kotlin, regelbøker, dokumentasjon), så det blir en **egen PR**. Alternativet er å dokumentere tydelig at Tooltip ikke oppfyller 1.4.13 alene. `popover="hint"` og `interestfor` finnes bare i Chromium. | Hover fra knappen til boblen beholder boblen. En skjult boble ved høyre kant gir ikke `scrollWidth > clientWidth`. Escape (hvis b). |
| 3.7 ✅ | L | Accordion-pila peker sidelengs i høyre-til-venstre. | `:dir(rtl)` med `rotate(-45deg) translate(2px, -2px)` lukket og `rotate(-225deg) …` åpen; fortegnet på `translate` må også snus. Fysiske kanter er stengt av `pakke-css.browser.test.ts:151-161`. | `retning.browser.test.ts`: beregnet `transform`. |
| 3.8 ✅ | L | Select-pila står 6 px fra kanten i høyre-til-venstre, mot 12 px ellers (målt). | For `:dir(rtl)` flyttes begge bitene i pila 0,35rem, til `0.75rem` og `1rem`. Gjør testen (`retning.browser.test.ts:86`) strengere enn «ulike». | |
| 3.9 📖 | L | `--fs-accordion-padding` gjelder bare `summary`. | Ny `--fs-accordion-padding-inline`, brukt av både `summary` og innhold. Dokumenter. | |
| 3.10 ✅ | L | `<summary><h3>` er ustylet: marg og skrift er 18,72 px. | `.fs-accordion summary > :is(h2,h3,h4,h5,h6) { margin: 0; font: inherit; }`. Det gir 0 px og 16 px. Regelen overstyrer også `.fs-heading` på en slik overskrift, med spesifisitet (0,1,2). Vurder `:where()` hvis `.fs-heading` skal vinne. | |
| 3.11 🔶 | L | Avslått og ugyldig samtidig viser ugyldig. | Legg `:disabled`-reglene etter `[data-state]`-reglene i input, select, textarea, file-upload, checkbox og radio. Toggle Group og Tag beholder den valgte flaten (dempet) når de er avslått. | |
| 3.12 ❓ | L (uavklart) | Datofelt i Firefox får trolig to ikoner. | Verifiser i Firefox først. Tegn så Fristils ikon og `padding-inline-end` bare innenfor `@supports selector(::-webkit-calendar-picker-indicator)`. | Firefox-test. |
| 3.13 ❓ | M | Spinner med `label` blir ikke lest opp når den settes inn ferdig fylt. Dette er ikke testet, siden det krever skjermleser. | Teksten som innhold i en `fs-sr-only` i stedet for `aria-label`. Dokumenter at et levende område må finnes i DOM før teksten settes. **Merk:** `spinner()` returnerer bare attributter, så dette er en API-endring. Byggefunksjonen kan ikke levere innhold, og `label` må få ny betydning eller fases ut. Verifiser i NVDA og VoiceOver før det endres. | |
| 3.14 | — | `aria-disabled` på `<label>`, `<legend>` og `<span>` | **Ut av denne runden.** Lav gevinst. Gjøres eventuelt senere og ikke-brytende: CSS treffer både `[data-disabled]` og `[aria-disabled="true"]`, og diagnostikken varsler med hurtigretting. Må da også ta med `fs-field.ts:41,523`, `field-core.ts:66,125`, `Handwritten.kt:131` og `kjerne/paritet`. | |
| 3.15 ✅ | L | Badge har `nowrap` og er ikke testet på smal skjerm. Målt: 48 tegn går greit ved 320 px, mens 66 tegn gir `scrollWidth` 419. | Ta Badge med i testen (7.4). Avgjør om lange merker skal kunne bryte. | |

## PR 4: Web-komponentene ellers

| # | Alv. | Funn | Fiks | Test |
|---|---|---|---|---|
| 4.1 🔶 | M (designhull) | Session Timeout teller aktivitet bare i nettleseren. Testet: rulling fra kode (`scrollTop=100`) holdt dialogen lukket, og verken tastetrykk eller wheel sendte noen hendelse. | Ny hendelse `session-activity`. Bytt ut `scroll` med `wheel` og `touchmove`. **Rettet etter testing:** struping bare i forkant er feil. Ved aktivitet hvert 10. sekund i 50 sekunder får appen bare hendelsen fra 0 s, og serveren logger da ut opptil `activity-interval` før klientens nedtelling er ferdig. Send både forkant og etterkant (en hendelse ved intervallets slutt hvis det har vært aktivitet), eller la klienten telle fra sist rapporterte aktivitet. **Må også endres:** den eksisterende testen «teller rulling i en boks som aktivitet» skrives om. Det nye attributtet `activity-interval` må inn i `src/jsx/react.ts` (en vakttest fanger det), `editor/metadata.ts`, `elements.ts`, manifestet, `web-types` og regelbøkene. Hendelsen går inn i 6.2. **[BESLUTNING]** Ny hendelse (anbefalt) eller `session-extend`. | Én hendelse i forkant og én i etterkant per intervall. `wheel` teller, `scroll` gjør det ikke. |
| 4.2 ✅ | L | Terskelopplesningen kan hoppe over et sekund. Testet: fra 61 til 59 sto opplesningen fast på «1 minutt og 9 sekunder». | Lagre `prevLeft` og sett den i `openDialog()` (`:480`). Les opp når en terskel krysses, én gang per tikk. | Fiksen gir «59 sekunder». 31/31 eksisterende tester er grønne. |
| 4.3 ✅ (funn) | M | Toast og tilkoblingsstatus blir inerte og stumme under en åpen modal. | Topplaget hjelper ikke, og det er **testet i Chromium**: en `popover="manual"` som vises etter `showModal()` gir `{popoverOpen:true, fokus:false, treff:false, klikk:false}`. En `<fs-toast>` inne i dialogen kan både få fokus og klikkes. Det eneste som virker er et meldingsområde inne i den øverste `dialog:modal`. **[BESLUTNING]** Enten (a) støtte for en `<fs-toast>` inne i dialogen, der `show()` på sidens toast sender videre til den når en modal er åpen (ingen flytting av noder, som ville kollidert med morfing og React), eller (b) dokumentere begrensningen og anbefale meldinger inne i dialogen. Anbefaling: (b) nå og (a) senere. | |
| 4.4 ✅ | L | Datastar-oppskriften for Error Summary lover fokus ved hver innsending. Testet: ved andre innsending blir fokus stående i feltet. Å skru `hidden` av og på flytter fokus igjen, også innenfor samme oppgave. | **Bare dokumentasjonen.** Oppførselen er bevisst (`fs-error-summary.ts:141-160`, `error-summary.mdx:233`). Rett oppskriften (`:175`) så den slår `hidden` av og på, for eksempel med to patcher. Valgfritt senere: et nytt `data-attempt`-attributt som serveren endrer per innsending, og som nullstiller fokusflagget. | |
| 4.5 🔶 | M | Skjemamønsteret skriver om `role="alert"` ved hvert tastetrykk. Testet: `innerHTML` med likt innhold gir fortsatt mutasjoner. | I `SkjemaDemo.astro`: bygg oppsummeringen bare ved innsending, og skriv ikke `innerHTML` når innholdet er likt. Rollen kan ikke flyttes, fordi komponenten setter `role="alert"` tilbake (`fs-error-summary.ts:118`). `monster/skjema.mdx:24` argumenterer **for** å bygge oppsummeringen på nytt, så den teksten må skrives om, ikke bare rettes. | |
| 4.6 ✅ | M | Valg i Suggestion når ikke en kontrollert React-input. Testet med etterlignet value tracker: `onChange` ble ikke kalt, verken for `<input>` eller `<textarea>`. | **Rettet etter testing:** bruk setteren fra elementets egen prototype, `Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), "value")?.set`, med `control.value = …` som reserve. Typevalget i versjon 2 kastet «Illegal invocation» for en `[role=combobox]` på en `<div>`. | Begge typene gir `["Bergen"]`, og 40/40 eksisterende tester er grønne. Ekte React er ikke testet. |
| 4.7 📖 | M | Tabs og Suggestion skjuler innhold før registrering. Det motsier «markupen vises uansett». | **Bare dokumentasjonen** (`kom-i-gang.mdx:117`, `rammeverk.mdx:338`). CSS-en er dokumentert i `markup-og-oppforsel.mdx:364-379`, og CSS kan ikke skille «skriptet kommer» fra «skriptet feilet». | |
| 4.8 ✅ | L | Tabs og Error Summary holder fast utskiftede noder. Målt: etter 10 bytter av fanene lå det 30 løsrevne noder i `bound`. | Én delegert `click`- og `keydown`-lytter på verten. **Rettet etter testing:** avgrens til egne faner med `this.tabs.indexOf(target.closest('[role=tab]'))`, ellers tar den nøstede faner. | Testen måler noder som holdes fast, ikke antall lyttere: lytterne blir ikke flere i dag. Med fiksen er det 0 noder, og 42/42 tabs- og 21/21 error-summary-tester er grønne. |
| 4.9 ✅ | L | `clear()` i Toast mister fokus, og det samme gjør `dismiss()` når den siste meldingen fjernes. Begge gir `activeElement = body`. | Husk elementet fokus kom fra (`relatedTarget` på `focusin`). **Tillegg:** `relatedTarget` er `null` når fokus kommer fra skjermleser eller F6, så det trengs en reserve, for eksempel `<main>` eller knappen som viste meldingen. | 24/24 er grønne. |
| 4.10 ✅ | L | Toast: når `label` fjernes, blir `aria-label` stående. **Nytt funn:** `label` overskriver en `aria-label` forfatteren har satt selv. | Bryteren `ownsLabel`. Når `label` fjernes, sett `DEFAULT_LABEL` («Varsler»). | |
| 4.11 ✅ | L | Tabs: pil opp og ned i en vannrett liste. | Bare venstre og høyre i vannrett. Les `aria-orientation` hvis forfatteren har satt den, men skriv den ikke (vannrett er standard). Liten atferdsendring. | |

## PR 5: Kommandolinjen og kjernen

| # | Alv. | Funn | Fiks | Test |
|---|---|---|---|---|
| 5.1 ✅ | **H** | `sjekk --css` følger ikke `@import "@fristil/designsystem/…"`. Testet med pakken fra `npm pack`: hver klasse meldes som ustylet, og kommandoen avslutter med kode 1. Det gjelder både den native CLI-en og `dist/cli.js`. | Finn `node_modules/<pakke>/package.json` ved å gå oppover fra stilarkets mappe. Tolk `exports` både som streng og som betingelsesobjekt. Fall tilbake til den direkte stien. `url()` og `layer()` leses allerede, så den delen trengs ikke. | 0 funn fra rota og fra undermappe. `sjekk-cli` har 182 kjøringer OK. |
| 5.2 ✅ | M | `sjekk-tema` sjekker bar `:root` bare som lyst. Testet: `#0d4e8c` gir «holder hvert løfte», men har 2,22:1 i mørkt. | Sjekk mørkt mot en sammensetning av grunnverdier, så `:root`, så de mørke blokkene. Meld bare tokens som ingen mørk blokk overstyrer. En blokk med `color-scheme: light` unntas. **Må også endres:** 4 Rust-tester (`reads_a_value_with_important`, `a_semicolon_in_a_string…`, `a_brace_in_a_url…`, `counts_the_consumers_own_values…`) og 4 fasiter i `kjerne/tema/` som `sjekk-kjerne` bruker. Alle bruker bar `:root` med mørk rød og forventer i dag ingen funn. | Firblokksmønsteret og `fristil tema --aksent=#7c3aed` gir 0 funn. |
| 5.3 ✅ | M | `sjekk-tema` leser «dark» inne i `:not()`. | Se bort fra innholdet i `:not(…)`. **Rettet etter testing:** `:root:not([data-theme="dark"])` er ikke «lyst». Den treffer også systemets mørke modus når `data-theme` mangler, og slår der Fristils mørke blokk. Den skal behandles som bar `:root`, altså mot begge temaer. | |
| 5.4 🔶 | M | Flagg med malverdi slipper gjennom. Testet: 0 funn for alle seks malsyntaksene. | Meld bare for `{{`, `{%`, `<?` og `<%`. **Rettet etter testing:** `${` skal **ikke** med. JTE fjerner usanne boolske attributter selv, og repoets egen fikstur `kjerne/maler/jte.kte` venter null funn. Med `${` feiler `sjekk-kjerne`. Bruk den eksisterende regelen `boolsk-med-verdi`; en ny regel må registreres i `types.rs`/`lib.rs` og i Kotlin. | `sjekk-diagnostikk` har 156 tilfeller OK. Kotlin-pariteten er ikke kjørt. |
| 5.5 ✅ | L | Bootstraps `fs-1` til `fs-6` gir falske funn. | Unnta `fs-\d+` fra «ukjent klasse». | |
| 5.6 🔶 | L | `data-color=""` godtas. | **Rettet etter testing:** regelen i versjon 2 («tom verdi for attributter med verdiliste») er selvmotsigende. Den melder `data-required=""`, som har verdiliste, og bryter testen «en tom verdi er ingen verdi» (`sjekk-diagnostikk.ts:608`). En tom verdi skader bare der CSS spør om at attributtet finnes. Det gjelder bare `fs-dialog:not([data-color])`. Snevre inn til `data-color` på `fs-dialog`, eller la manifestet merke slike attributter. | |
| 5.7 ✅ | L | `writingsuggestions`, `autocorrect` og `headingoffset` er ukjente. | Legg dem i `GLOBAL` (`diagnose.rs:16-46`). | |

## PR 6: Metadata, editor, regelbøker og Kotlin

| # | Alv. | Funn | Fiks |
|---|---|---|---|
| 6.1 | **H** | Regelbøkene og VS Code mangler `data-interactive`, `data-selectable`, `data-hoverable` og `data-optional` (label og legend). `data-color` på dialog vises ikke, fordi `fs-dialog` står i tabellen over web components. | La `classesData()` (`editor/scripts/generate.ts:291`) ta flaggene fra samme kilde som manifestet (`generate-manifest.ts:493-497`). Vis klasseattributtene også for `fs-dialog`. |
| 6.2 | M | Ingen hendelser i manifestet, `web-types`, JSX-typene eller regelbøkene. | `metadata.ts` blir kilden (navn og form på `detail`). Generer til et nytt manifestfelt (oppdater skjemaet og sjekk at `manifest.rs`, IntelliJ og Kotlin tåler det), `js.events` i `web-types`, JSX og regelbøkene (særlig Datastar). Legges i samme PR som 4.1 eller rett etter. |
| 6.3 | L | `fs-theme-control` står ikke i tabellen som kalles «hele lista». | Ta den med i tabellen. |
| 6.4 | L | Regelbøkene kaller `data-variant="outline"` oppfunnet. Det er standardverdien. | Rett `generate-agent.ts`. |
| 6.5 ✅ | M | `fristil sjekk` gir **feil** på `<fs-error-summary data-autofocus="true">` («kan ikke være «true»»), men komponenten godtar verdien. | Legg `"true"` i verdilista i `editor/metadata.ts:148`, og regenerer. |
| 6.6 | L | `required-marker="text"` beskrives som «må fylles ut». | «(påkrevd)» (`metadata.ts:118`). |
| 6.7 | L | Utdatert om IntelliJ. | Rett `editor/README.md:86` og `generate-agent.ts:584`. Ta med `assertFristil`, `fristil.jar` og Gradle-pluginen i `maler.md`. |
| 6.8 ✅ (algoritme) | L | `jsNumber` i Kotlin skriver ikke tall som JavaScript. | Kravet er JDK 17. Prøv `BigDecimal(d).round(MathContext(p, HALF_EVEN))` for p = 1..17 til verdien går rundt, og formater med JS sine eksponentregler. Testet i Java mot Node: **0 avvik på 220 018 tall**. Selve Kotlin-koden er ikke kjørt. Lav prioritet. |
| 6.9 | L | `ParityTest` lover mer enn den dekker. | Rett kommentaren og README. Legg fiksturer for reglene som mangler (`ikke-tall`, flagg på klasse, `ustylet-*` og flere). Sammenlign `READ_RENDERED_PAGE` med `diagnostics/index.ts:96`. |
| 6.10 📖 | L | Gradle-pluginen skriver alltid `build/fristil/manifest.json`, og språkserveren foretrekker den. | Skriv den bare når prosjektet har fragmenter, og **slett** en gammel fil når fragmentene fjernes. Ellers blir den liggende. |
| 6.11 | M | Språkserveren leter bare ved rota. | Let oppover fra fila mot nærmeste `node_modules/@fristil/designsystem` eller `build/fristil`. |
| 6.12 | L | IntelliJ sjekker mot sitt eget manifest. | Les prosjektets manifest som språkserveren gjør. Rett versjonskravet `0.1.0-SNAPSHOT`. |
| 6.13 ❓ | L (uavklart) | Gradle-oppskriften mangler trolig `pluginManagement`. Plugin Portal videresender (303) til Maven Central, så det trengs kanskje ikke. Dette kunne ikke verifiseres (429). | Prøv oppskriften i et tomt prosjekt. Legg inn `pluginManagement { repositories { mavenCentral(); gradlePluginPortal() } }` hvis den feiler. |
| 6.14 | L | «Hver tråd får sin egen instans» stemmer ikke. | Beskriv poolen. |

## PR 7: Tester og prosess (helst tidlig, og parallelt med de andre)

| # | Alv. | Funn | Fiks |
|---|---|---|---|
| 7.1 | M | Progress mangler test. | `progress.browser.test.ts`: axe, bestemt og ubestemt, høykontrast og mindre bevegelse. |
| 7.2 | M | Ingen sjekk krever testfila. | En sjekk som feiler når en komponentmappe mangler `*.browser.test.ts`. |
| 7.3 ✅ | M | `bun run sjekk` kjører ikke det samme som CI. I tillegg kjører `sjekk` `playwright install`, så den feiler lokalt uten nett eller med en annen Playwright-versjon. | Behold de parallelle jobbene i CI (xvfb, JDK). Utvid `sjekk` med `sjekk-rendret`, LSP-stegene, `cargo fmt` og `clippy` og «ingenting er ugenerert». Legg en sjekk som sammenligner stegene i `ci.yml` med `sjekk`, så de ikke glir fra hverandre igjen. |
| 7.4 | M | Testen for smal skjerm dekker 11 komponenter. | Ta med alle, også web-komponentene i åpen tilstand. |
| 7.5 | M | axe ignorerer «incomplete» og kjører bare lyst tema. | Kjør `forventIngenTilgjengelighetsbrudd` i begge temaer. Logg og tell «incomplete», men ikke la dem feile (gradienter og pseudoelementer gir mange). La `monter()` kunne slås av for bakgrunn på `body`, så 2.1 kan testes. |
| 7.6 ✅ | L | Kontrakten testes bare med varierende merkefarge. | Et rutenett av nøytral × merkefarge i `tests.rs`. Prototypet: 10 nøytrale × 12 merkefarger × 2 temaer gir 240 kombinasjoner og 0 brudd. |
| 7.7 ✅ | L | `pakke-css` sjekker bare starten av fila. | Sjekk at ingenting står etter lagets avsluttende `}`. |
| 7.8 | L | `sjekk-dokumentasjon` bruker `includes`. | Bruk ordgrense, og fjern «hver `part`». |

## PR 8: Dokumentasjon

| # | Alv. | Funn | Fiks |
|---|---|---|---|
| 8.1 | M | «Kom i gang» lover at API-et ikke brytes uten ny hovedversjon. | Legg inn forbeholdet før 1.0, og fjern `part` (`kom-i-gang.mdx:178`). |
| 8.2 | L | Størrelsen på `fristil.css` er utdatert (90/11 kB mot 95/12 kB). | Generer tallet fra bygget. |
| 8.3 | L | `design-tokens.mdx:93` sier at `--fs-focus-ring` endrer ringen overalt. | Rett teksten: tokenet styrer bredde og stil, men fargen byttes med vilje i noen tilfeller. **Rettet liste:** ugyldig og vellykket tilstand i input, textarea, select, checkbox og radio; skip-link; feiloppsummering; Select med stylet valgliste (`select.css:264`); og Toggle Group etter 2.3. |
| 8.4 | L | `design-tokens.mdx:52-53` | Nevn løftet om `content` på `text`. Kortet kan ha `canvas` eller `surface`. |
| 8.5 | L | Tabellen for mindre bevegelse mangler komponenter. | Legg til Progress og Select (`tilgjengelighet.mdx:61-67`). **Rettet:** Error Summary har ingen regel for mindre bevegelse og overlater rullingen til sidens `scroll-behavior` (`fs-error-summary.ts:263`). Det kan stå som en fotnote. |
| 8.6 | L | `tailwind.mdx:94` sier at alt peker på tokens. | `max-w-fs-*` er faste verdier. |
| 8.7 | — | «12 merkefarger» | **Tas ut. Funnet var feil**: testen har tolv (`tests.rs:138-139`). |
| 8.8 ✅ | L | Ingen CommonJS. | Skriv at pakken er ren ESM. Legg `"./package.json": "./package.json"` i `exports`. Testet: `require.resolve` finner fila, `sjekk-eksport` gir 109 inngangspunkter, og publint sier «All good». |

---

## Rekkefølge

1. **PR 7.1–7.3** tidlig, så de andre PR-ene fanges av de nye sjekkene. Ta også med testkonfigurasjonen for Chromium. Låsefila (0.1) kan følge med en hvilken som helst PR.
2. **PR 1** og **PR 2**: data og kjerneløftet om kontrast. Små og avgrensede.
3. **PR 5.1**, **6.1** og **6.5**: verktøyene som gir feil svar i dag.
4. **PR 3** og **PR 4**: flest endringer, krever testing i alle tre nettleserne.
5. Resten av **PR 5**, **6**, **7** og **8**. En dokumentasjonsrettelse følger helst PR-en som gjør påstanden sann.
6. **Egne PR-er senere:** Tooltip-komponenten (3.6b), meldingsområde i dialog (4.3a) og eventuelt 3.14.

## Beslutninger som må tas

| # | Spørsmål | Anbefaling |
|---|---|---|
| 2.1 | Skal `:where([data-theme="light"], [data-theme="dark"])` også gi bakgrunn på `<html data-theme>`? | Ja. Sjekk docs-siden. |
| 3.1 | `hidden` med `!important` i laget kan ikke overstyres av konsumenten. Godtar vi det? | Ja, siden nettleseren selv oppfører seg slik. Dokumenter det. |
| 3.6 | Escape på Tooltip: ny komponent, eller dokumentere at den ikke oppfyller 1.4.13? | Dokumentere nå, komponent senere |
| 4.1 | Ny hendelse `session-activity`, eller sende `session-extend` ved aktivitet? | Ny hendelse |
| 4.3 | Meldinger under modal: støtte i komponenten, eller dokumentasjon? | Dokumentasjon nå |

## Endret fra versjon 2 (etter testing)

**Funn som var feil beskrevet**

- **1.1:** eksempelet med Escape holder ikke i Chromium. Feilen gjelder `close()` uten argument og en dialog som er flyttet.
- **3.3:** resultatet er hvit på hvit, ikke svart på svart.
- **0.1:** CI er ikke rødt.
- **5.3:** `:not([data-theme="dark"])` betyr begge temaer, ikke lyst.

**Fikser som ikke virket eller brakk noe**

- **3.1:** dekket ikke barn uten `fs-`-klasse. `[class*="fs-"]` traff fremmede klasser. Påstanden om at konsumenten kan overstyre var feil.
- **3.5:** `"x"` i `@supports` stoppet bygget.
- **1.3:** brakk fokustesten.
- **4.1:** struping bare i forkant logger brukeren ut for tidlig.
- **4.6:** typevalget kastet for `<div role=combobox>`.
- **5.4:** `${` ga falske funn for JTE.
- **5.6:** regelen var selvmotsigende.

**Eksisterende tester som må skrives om, og som planen ikke nevnte**

- 3.3: `hover`
- 3.6c: `tooltip` og `retning`
- 4.1: scroll-testen
- 5.2: 4 Rust-tester og 4 fasiter

**Mangler som er lagt til**

- 1.5: nullstill bryteren.
- 4.1: fem filer for det nye attributtet.
- 4.8: avgrensning for nøstede faner, og hva testen skal måle.
- 4.9: reserve når `relatedTarget` er `null`.
- 4.10: nytt funn om forfatterens `aria-label`.
- 6.10: slette en gammel fil.
- 3.13: API-endring.

**Andre rettelser**

- **Referanser:** 3.2 `Handwritten.kt:26` → generert, 4.5 `:122` → `:118`, 6.1 `:250` → `:291`.
- **Lister:** 8.3 (Toggle Group og Select) og 8.5 (Error Summary).
- **6.5:** gikk fra uavklart til bekreftet, med kilden `metadata.ts:148`.

## Endret fra versjon 1

- **Tatt ut:** 8.7 (funnet var feil), gamle 1.4 (dekket av 1.3), 2.6 (ikke et brudd) og 3.14 (utsatt). 5.6 er snevret inn til `data-color=""`.
- **Snudd fra kode til dokumentasjon:** 4.4 (oppførselen er bevisst; kodefiksen ville revet fokus ut av feltet), 4.7 og 3.2 (`link()` eier ikke `href`).
- **Fiksen var feil og er byttet ut:**
  - 2.3: positiv `outline-offset` klippes av `overflow: hidden`.
  - 2.4: `mask-image` virker ikke på `<input>`.
  - 3.1: selektoren dekket ikke custom elements og tapte mot regler med (0,2,1).
  - 4.3: et topplag over en modal er fortsatt inert.
  - 4.8: `WeakSet` kan ikke itereres.
  - 4.9: når den siste meldingen fjernes, finnes det ingen nabo.
  - 5.2: ville gitt falske funn for firblokksmønsteret.
- **Fiksen var ufullstendig og er utvidet:**
  - 1.1: plassering og flytting.
  - 1.2: `attributeFilter` og bare `<button>`.
  - 2.1: rota skal ikke styles, `:where`.
  - 2.2: enklere, uten endring i generatoren.
  - 3.5: `@supports`-reserve.
  - 3.7: `translate`-fortegnet.
  - 4.6: `<textarea>`.
  - 5.1: oppslag fra stilarkets mappe.
  - 5.4: bare tekstmaler.
  - 6.8: JDK 17.
  - 7.3: behold jobbene i CI.
- **Tester som ikke kunne bestås, er skrevet om:** 3.5, 4.1, 4.2 og 4.3.
- **Alvorlighet:** 1.1 er nå øverst, og 3.5, 4.6 og 3.13 er hevet. 2.1, 4.1, 4.12 (nå 4.11), 6.8 og 6.14 er senket.
