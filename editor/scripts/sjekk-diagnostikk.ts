/**
 * At diagnostikken feller hver feiltype den skal, og bare dem.
 *
 * Elementene leses fra generatoren i minnet, ikke fra `elements.json` på
 * disk, så sjekken bruker den samme kilden som utvidelsen ville fått etter
 * `bun run generate`. Hvert tilfelle sier hvor mange funn det skal gi og
 * hva meldingen skal nevne, og de rene tilfellene skal gi null. Snippetene
 * fra komponentsidene er med som rene tilfeller: gir en av dem funn, er
 * enten regelen eller oppskriften feil, og begge deler skal fram.
 *
 * Tilfellene dekker også parseren, ikke bare reglene: en verdi med `>` i,
 * en verdi uten anførselstegn, enkle anførselstegn, en tagg over flere
 * linjer, et felt uten lukketagg. En gren uten tilfelle overlever at den
 * fjernes, og da vet ingen at den virker.
 *
 * Kjør med: bun scripts/sjekk-diagnostikk.ts
 */

import { type Classes, diagnose, type Elements } from "../src/diagnostics"
import { classesData, diagnosticsData, snippets } from "./generate"

const all: Elements = diagnosticsData()
const classes: Classes = classesData()
const findings: string[] = []

type Case = {
  name: string
  html: string
  count: number
  mentions?: string[]
  severity?: "error" | "warning"
  /** Teksten funnet skal dekke, når posisjonen er poenget. */
  covers?: string
  /** Det meldingen ikke skal nevne. */
  notMentions?: string[]
  /** Rettelsen anvendt på html skal gi dette. */
  fixed?: string
  fixTitle?: string
  fixPreferred?: boolean
  /** Hvor lang tid tilfellet får, når farten er poenget. */
  maxMs?: number
}

const FIELD_OK = `<fs-field id="f"><label>Navn</label><input class="fs-input" name="navn"></fs-field>`

const cases: Case[] = [
  {
    name: "et element som ikke finnes",
    html: `<fs-dialog><fs-dialog-header>Tittel</fs-dialog-header></fs-dialog>`,
    count: 1,
    mentions: ["<fs-dialog-header> finnes ikke", "fs-dialog"],
    severity: "error",
    covers: "fs-dialog-header",
  },
  {
    name: "et attributt elementet ikke har",
    html: `<fs-popover placemnet="top-start"></fs-popover>`,
    count: 1,
    mentions: ["«placemnet»", "placement"],
    severity: "warning",
    covers: "placemnet",
  },
  {
    name: "globale attributter, data-, aria- og hendelser slipper gjennom",
    html: `<fs-popover id="p" class="x" data-on-click="@get('/x')" aria-label="Hjelp" onclick="1" role="dialog" hidden></fs-popover>`,
    count: 0,
  },
  {
    name: "HTMX, Alpine og Vue sine prefikser slipper gjennom",
    html: `<fs-popover hx-get="/x" x-data="{}" v-if="c"></fs-popover>`,
    count: 0,
  },
  {
    name: "Alpine, Svelte og Angular sine tegn slipper gjennom",
    html: `<fs-popover @click="a" :open="b" on:click="d" bind:open="e" [open]="f" (close)="g"></fs-popover>`,
    count: 0,
  },
  {
    name: "Angulars strukturdirektiver og i18n, og hyperscripts _, slipper gjennom",
    html: `<fs-popover *ngIf="x" i18n placement="top-start"></fs-popover><fs-dialog _="on click toggle @open"></fs-dialog>`,
    count: 0,
  },
  {
    name: "ledetekst via kontrollens id når control-id peker et annet sted",
    html: `<label for="epost">E-post</label><fs-field control-id="x"><input id="epost"></fs-field>`,
    count: 0,
  },
  {
    name: "et egendefinert element som begynner på select er ingen kontroll",
    html: `<fs-field><label-x>N</label-x><select-all></select-all></fs-field>`,
    count: 1,
    mentions: ["fant ingen kontroll"],
  },
  {
    name: "Alpine i taggen gjør ikke resten til en mal",
    html: `<fs-popover @click="a" placemnet="top-start"></fs-popover>`,
    count: 1,
    mentions: ["«placemnet»"],
  },
  {
    name: "en Razor-partial inne i feltet",
    html: `<fs-field><label>Navn</label>@Html.Partial("Input")</fs-field>`,
    count: 0,
  },
  {
    name: "en verdi utenfor lista",
    html: `<fs-field required-marker="stjerne"><label>N</label><input></fs-field>`,
    count: 1,
    mentions: ["«stjerne»", "Lovlige verdier"],
    severity: "error",
    covers: "required-marker",
  },
  {
    name: "et listeattributt uten verdi",
    html: `<fs-field required-marker><label>N</label><input></fs-field>`,
    count: 1,
    mentions: ["Lovlige verdier"],
    severity: "error",
  },
  {
    name: "et boolsk attributt med «false»",
    html: `<fs-field invalid="false"><label>N</label><input></fs-field>`,
    count: 1,
    mentions: ["boolsk", 'invalid="false" betyr det samme som invalid'],
    severity: "warning",
  },
  {
    name: "et boolsk attributt med sitt eget navn eller tom verdi er greit",
    html: `<fs-field invalid="invalid" disabled=""><label>N</label><input></fs-field>`,
    count: 0,
  },
  {
    name: "hidden=until-found er HTML",
    html: `<fs-error-summary hidden="until-found"></fs-error-summary>`,
    count: 0,
  },
  {
    name: "et tall som ikke er et tall",
    html: `<fs-toast duration="lenge"></fs-toast>`,
    count: 1,
    mentions: ["skal være et tall", "«lenge»"],
    severity: "error",
  },
  {
    name: "et tall som er et tall",
    html: `<fs-toast duration="5000"></fs-toast>`,
    count: 0,
  },
  {
    name: "et felt uten kontroll",
    html: `<fs-field><label>Navn</label><p class="fs-help-text">Hjelp</p></fs-field>`,
    count: 1,
    mentions: ["fant ingen kontroll", "<input>, <textarea> eller <select>"],
    severity: "warning",
    covers: "fs-field",
  },
  {
    name: "en skjult input er ingen kontroll, som i komponenten",
    html: `<fs-field><label>X</label><input type="hidden" name="csrf"></fs-field>`,
    count: 1,
    mentions: ["fant ingen kontroll"],
  },
  {
    name: "kontrollen etter en skjult input teller",
    html: `<fs-field><input type="hidden" name="csrf"><input aria-label="Søk"></fs-field>`,
    count: 0,
  },
  {
    name: "et felt uten ledetekst",
    html: `<fs-field><input class="fs-input"></fs-field>`,
    count: 1,
    mentions: ["fant ingen <label>", "uten navn"],
    severity: "warning",
  },
  {
    name: "et tomt felt er et område serveren ikke har fylt",
    html: `<fs-field id="senere"></fs-field>`,
    count: 0,
  },
  {
    name: "ledetekst utenfor, med for",
    html: `<label for="epost">E-post</label><fs-field><input id="epost"></fs-field>`,
    count: 0,
  },
  {
    name: "ledetekst utenfor, med for uten anførselstegn",
    html: `<label for=epost>E-post</label><fs-field><input id="epost"></fs-field>`,
    count: 0,
  },
  {
    name: "ledetekst utenfor via control-id",
    html: `<label for="epost">E-post</label><fs-field control-id="epost"><input></fs-field>`,
    count: 0,
  },
  {
    name: "en id med klammer og parenteser kaster ikke",
    html: `<label for="a[0].x(1)">X</label><fs-field><input id="a[0].x(1)"></fs-field>`,
    count: 0,
  },
  {
    name: "punktum i id-en er et punktum, ikke hva som helst",
    html: `<label for="ab">X</label><fs-field><input id="a.b"></fs-field>`,
    count: 1,
    mentions: ["fant ingen <label>"],
  },
  {
    name: "aria-label på kontrollen",
    html: `<fs-field><input aria-label="Søk"></fs-field>`,
    count: 0,
  },
  {
    name: "aria-labelledby på kontrollen",
    html: `<fs-field><input aria-labelledby="tittel"></fs-field>`,
    count: 0,
  },
  {
    name: "Go-mal i taggen",
    html: `<fs-field {{ if .Feil }}invalid{{ end }}><label>N</label><input></fs-field>`,
    count: 0,
  },
  {
    name: "Jinja i taggen og i verdien",
    html: `<fs-popover {% if x %}open{% endif %} placement="{{ p }}"></fs-popover>`,
    count: 0,
  },
  {
    name: "PHP i taggen",
    html: `<fs-field <?= $invalid ? 'invalid' : '' ?>><label>N</label><input></fs-field>`,
    count: 0,
  },
  {
    name: "Razor i verdien",
    html: `<fs-field invalid="@Model.Invalid"><label>N</label><input></fs-field>`,
    count: 0,
  },
  {
    name: "en partial inne i feltet er ikke et felt uten kontroll",
    html: `<fs-field><label>Navn</label>{{ template "input" . }}</fs-field>`,
    count: 0,
  },
  {
    name: "et ukjent element meldes også i en mal",
    html: `<fs-feild {{ if .X }}invalid{{ end }}></fs-feild>`,
    count: 1,
    mentions: ["finnes ikke"],
  },
  {
    name: "kommentarer, skript og stilark leses ikke",
    html: `<!-- <fs-finnes-ikke> --><script>"<fs-nei>"</script><style>/* <fs-nei> */</style>${FIELD_OK}`,
    count: 0,
  },
  {
    name: "posisjonen står selv om en kommentar går over flere linjer",
    html: `<!--\n<fs-nei>\n-->\n<fs-tull></fs-tull>`,
    count: 1,
    covers: "fs-tull",
  },
  {
    name: "store bokstaver i tagg og attributt, og selvlukking",
    html: `<FS-TOAST DURATION="x"/>`,
    count: 1,
    mentions: ["skal være et tall"],
    covers: "DURATION",
  },
  {
    name: "en verdi med > i",
    html: `<fs-toast label="a > b" duration="5"></fs-toast>`,
    count: 0,
  },
  {
    name: "en verdi uten anførselstegn",
    html: `<fs-popover placement=top-start></fs-popover><fs-popover placement=topp></fs-popover>`,
    count: 1,
    mentions: ["«topp»"],
  },
  {
    name: "enkle anførselstegn",
    html: `<fs-popover placement='top-start'></fs-popover><fs-popover placement='topp'></fs-popover>`,
    count: 1,
    mentions: ["«topp»"],
  },
  {
    name: "en tagg over flere linjer",
    html: `<fs-popover\n  placement="top-start"\n  open\n></fs-popover>`,
    count: 0,
  },
  {
    name: "felt i felt",
    html: `<fs-field><label>A</label><input><fs-field><label>B</label><input></fs-field></fs-field>`,
    count: 0,
  },
  {
    name: "et felt uten lukketagg",
    html: `<fs-field><label>A</label><input>`,
    count: 0,
  },
  {
    name: "Alpine på kontrollen gjør ikke feltet til en mal",
    html: `<fs-field><input @input="x = 1"></fs-field>`,
    count: 1,
    mentions: ["fant ingen <label>"],
  },
  {
    name: "Alpine på en knapp i feltet heller",
    html: `<fs-field><label>N</label><button @click="x">Send</button></fs-field>`,
    count: 1,
    mentions: ["fant ingen kontroll"],
  },
  {
    name: "store bokstaver i felt: tomt felt er stille",
    html: `<FS-FIELD id="senere"></FS-FIELD>\n<p>tekst</p>`,
    count: 0,
  },
  {
    name: "store bokstaver i felt: uten ledetekst felles",
    html: `<FS-FIELD><INPUT></FS-FIELD>\n<label>x</label>`,
    count: 1,
    mentions: ["fant ingen <label>"],
  },
  {
    name: "en skrivefeil som ligner et kjent attributt",
    html: `<fs-connection-status onlinetext="Tilkoblet"></fs-connection-status>`,
    count: 1,
    mentions: ["Mente du online-text?"],
    covers: "onlinetext",
  },
  {
    name: "en skrivefeil uten bindestrek",
    html: `<fs-field requiredMarker="symbol"><label>N</label><input></fs-field>`,
    count: 1,
    mentions: ["Mente du required-marker?"],
  },
  {
    name: "en uavsluttet kontroll leser ikke resten som sine attributter",
    html: `<fs-field><input placeholder=it's><span aria-label="x"></span></fs-field>`,
    count: 1,
    mentions: ["fant ingen"],
  },
  {
    name: "tall slik komponentene leser dem",
    html: `<fs-toast duration=" 5000 "></fs-toast><fs-toast duration="1e3"></fs-toast><fs-toast duration=""></fs-toast>`,
    count: 1,
    mentions: ["skal være et tall"],
  },
  {
    name: "en Jinja-kommentar i taggen",
    html: `<fs-popover {# note #} placement="top-start"></fs-popover>`,
    count: 0,
  },
  {
    name: "PHP i taggen avslutter den ikke, og feilen etter felles",
    html: `<fs-field <?= $x ?> required-marker="stjerne"><label>N</label><input></fs-field>`,
    count: 1,
    mentions: ["«stjerne»"],
  },
  {
    name: "en klasse som ikke finnes, med forslag og rettelse",
    html: `<button class="fs-buton">Send</button>`,
    count: 1,
    mentions: ["«fs-buton» finnes ikke", "Mente du fs-button?"],
    severity: "warning",
    covers: "fs-buton",
    fixed: `<button class="fs-button">Send</button>`,
    fixTitle: "Bytt til fs-button",
  },
  {
    name: "en klasse langt fra alle kjente får ikke forslag",
    html: `<button class="fs-knapp">Send</button>`,
    count: 1,
    mentions: ["«fs-knapp» finnes ikke"],
    notMentions: ["Mente du"],
  },
  {
    name: "en ren verdi i en tagg med mal sjekkes likevel",
    html: `<button class="fs-button" {{ if .X }}disabled{{ end }} data-variant="ghots"></button>`,
    count: 1,
    mentions: ["«ghots»"],
  },
  {
    name: "en klasse med mal i navnet er ingen skrivefeil",
    html: `<div class="fs-{{ .Type }} kort"></div><div class="fs-<?= $x ?>"></div>`,
    count: 0,
  },
  {
    name: "kjente klasser, også flere i samme attributt og med mal",
    html: `<input class="fs-input fs-search" type="search"><div class="{{ .Klasse }} fs-card"></div><p class="kort fs-paragraph"></p>`,
    count: 0,
  },
  {
    name: "en variant utenfor lista, med forslag og rettelse",
    html: `<button class="fs-button" data-variant="ghots">Send</button>`,
    count: 1,
    mentions: [
      "data-variant kan ikke være «ghots» på button",
      "secondary, ghost, danger",
      "primary uten attributt",
    ],
    fixed: `<button class="fs-button" data-variant="ghost">Send</button>`,
    fixTitle: "Bytt til ghost",
  },
  {
    name: "lovlige varianter, standardverdien og type på input",
    html: `<button class="fs-button" data-variant="danger"></button><button class="fs-button" data-variant="primary"></button><input class="fs-input" type="email"><h2 class="fs-heading" data-size="xl"></h2>`,
    count: 0,
  },
  {
    name: "et attributt en annen klasse tar, sjekkes ikke her",
    html: `<div class="fs-card" data-variant="ghost"></div><span class="fs-badge" data-size="xl"></span>`,
    count: 1,
    mentions: ["data-variant kan ikke være «ghost» på card"],
  },
  {
    name: "variantverdi fra en mal sjekkes ikke",
    html: `<button class="fs-button" data-variant="{{ .Variant }}"></button><button class="fs-button" data-variant="@Model.V"></button>`,
    count: 0,
  },
  {
    name: "rettelsen for et attributtnavn",
    html: `<fs-connection-status onlinetext="Tilkoblet"></fs-connection-status>`,
    count: 1,
    fixed: `<fs-connection-status online-text="Tilkoblet"></fs-connection-status>`,
    fixTitle: "Bytt til online-text",
  },
  {
    name: "rettelsen for et boolsk attributt tar med verdien og mellomrommet",
    html: `<fs-field invalid="false" id="x"><label>N</label><input></fs-field>`,
    count: 1,
    fixed: `<fs-field id="x"><label>N</label><input></fs-field>`,
    fixTitle: "Ta bort invalid",
    fixPreferred: true,
  },
  {
    name: "rettelsen for et boolsk attributt sist i taggen",
    html: `<fs-field id="x" invalid="false"><label>N</label><input></fs-field>`,
    count: 1,
    fixed: `<fs-field id="x"><label>N</label><input></fs-field>`,
  },
  {
    name: "rettelsen for et felt uten ledetekst",
    html: `<fs-field><input class="fs-input"></fs-field>`,
    count: 1,
    fixed: `<fs-field><label>Ledetekst</label><input class="fs-input"></fs-field>`,
    fixTitle: "Sett inn en ledetekst",
  },
  {
    name: "ledeteksten får sin egen linje med samme innrykk",
    html: `<fs-field>\n  <input class="fs-input">\n</fs-field>`,
    count: 1,
    fixed: `<fs-field>\n  <label>Ledetekst</label>\n  <input class="fs-input">\n</fs-field>`,
  },
  {
    name: "data-required på ledetekst og legend",
    html: `<label class="fs-label" data-required="stjerne">N</label><legend class="fs-legend" data-required="text">G</legend>`,
    count: 1,
    mentions: ["data-required kan ikke være «stjerne»", "symbol, text"],
  },
  {
    name: "data-variant på input, som CSS-en leser",
    html: `<input class="fs-input" data-variant="dato" type="date"><input class="fs-input" data-variant="date" type="date">`,
    count: 1,
    mentions: [
      "data-variant kan ikke være «dato»",
      "date, datetime-local, time",
    ],
    fixed: `<input class="fs-input" data-variant="date" type="date"><input class="fs-input" data-variant="date" type="date">`,
  },
  {
    name: "type på input er HTML sitt eget, og sjekkes ikke, heller ikke hidden",
    html: `<input class="fs-input" type="color"><input class="fs-input" type="hidden"><input class="fs-input" type="file">`,
    count: 0,
  },
  {
    name: "et kort navn får ikke forslag to tegn unna",
    html: `<div class="fs-tabs"></div>`,
    count: 1,
    notMentions: ["Mente du"],
  },
  {
    name: "en byttet plass er én feil, og forslaget er ikke foretrukket",
    html: `<button class="fs-button" data-variant="ghots"></button>`,
    count: 1,
    fixTitle: "Bytt til ghost",
    fixPreferred: false,
  },
  {
    name: "samme bokstaver er den sikre rettelsen",
    html: `<fs-connection-status onlinetext="x"></fs-connection-status>`,
    count: 1,
    mentions: ["Mente du online-text"],
    fixPreferred: true,
  },
  {
    name: "et langt navn får to tegns slingring",
    html: `<p class="fs-eror-txt"></p>`,
    count: 1,
    mentions: ["Mente du fs-error-text?"],
  },
  {
    name: "lengdefilteret slipper gjennom akkurat på grensen",
    html: `<a class="fs-lin"></a>`,
    count: 1,
    mentions: ["Mente du fs-link?"],
  },
  {
    name: "ved lik avstand vinner den som deler begynnelsen",
    html: `<table class="fs-tabel"></table>`,
    count: 1,
    mentions: ["Mente du fs-table?"],
  },
  {
    name: "«Ta bort» over flere linjer",
    html: `<fs-field\n  invalid="false"\n  id="x"><label>N</label><input></fs-field>`,
    count: 1,
    fixed: `<fs-field\n  id="x"><label>N</label><input></fs-field>`,
  },
  {
    name: "rettelse på en klasse uten anførselstegn",
    html: `<p class=fs-buton></p>`,
    count: 1,
    fixed: `<p class=fs-button></p>`,
  },
  {
    name: "rettelse på en verdi uten anførselstegn",
    html: `<button class=fs-button data-variant=ghots></button>`,
    count: 1,
    fixed: `<button class=fs-button data-variant=ghost></button>`,
  },
  {
    name: "to klasser som tar samme attributt gir ett funn",
    html: `<input class="fs-input fs-search" data-state="ugyldig">`,
    count: 1,
  },
  {
    name: "en tom verdi er ingen verdi",
    html: `<button class="fs-button" data-variant=""></button>`,
    count: 0,
  },
  {
    name: "samme bokstaver i en klasse er den sikre rettelsen",
    html: `<p class="fs-error_text"></p>`,
    count: 1,
    fixTitle: "Bytt til fs-error-text",
    fixPreferred: true,
  },
  {
    name: "samme ukjente klasse mange ganger går fort",
    html: Array.from(
      { length: 3000 },
      () => `<td class="fs-cell fs-celle">x</td>`,
    ).join("\n"),
    count: 6000,
    maxMs: 60,
  },
  {
    name: "funnene kommer i tekstens rekkefølge",
    html: `<fs-popover placemnet="x"></fs-popover><button class="fs-buton"></button><fs-tull></fs-tull>`,
    count: 3,
    mentions: ["placemnet"],
  },
  {
    name: "flere funn i samme tagg meldes hver for seg",
    html: `<fs-popover placemnet="top-start" open="false"></fs-popover>`,
    count: 2,
  },
  {
    name: "en ren fil",
    html: `<!doctype html><html><body>${FIELD_OK}<fs-popover placement="top-start" open></fs-popover></body></html>`,
    count: 0,
  },
]

// Snippetene fra komponentsidene skal være rene.
for (const [tag, snippet] of Object.entries(snippets()))
  cases.push({
    name: `snippeten for <${tag}>`,
    html: snippet.body.join("\n").replace(/\\\$/g, "$").replace(/\\\\/g, "\\"),
    count: 0,
  })

const started = performance.now()
for (const c of cases) {
  const fail = (message: string) => findings.push(`${c.name}: ${message}`)
  let found: ReturnType<typeof diagnose>
  const before = performance.now()
  try {
    found = diagnose(c.html, all, classes)
  } catch (error) {
    fail(`kastet: ${error instanceof Error ? error.message : String(error)}`)
    continue
  }
  // Tidsgrensen er en lokal vakt for hurtigbufferen, ikke en påstand om en
  // delt CI-maskin: der kan veggklokka gi rødt uten at noe er galt.
  const took = performance.now() - before
  if (c.maxMs && took > c.maxMs && !process.env.CI)
    fail(`tok ${Math.round(took)} ms, og skal ta under ${c.maxMs}`)
  if (found.length !== c.count) {
    fail(
      `ventet ${c.count} funn, fikk ${found.length}: ${found.map((f) => f.message).join(" | ") || "ingen"}`,
    )
    continue
  }
  if (!found.length) continue
  const first = found[0]
  for (const m of c.mentions ?? [])
    if (!first.message.includes(m))
      fail(`meldingen nevner ikke «${m}»: ${first.message}`)
  for (const m of c.notMentions ?? [])
    if (first.message.includes(m))
      fail(`meldingen nevner «${m}»: ${first.message}`)
  if (c.severity && first.severity !== c.severity)
    fail(`ventet ${c.severity}, fikk ${first.severity}`)
  if (c.covers) {
    const covered = c.html.slice(first.start, first.end)
    if (covered !== c.covers)
      fail(`funnet dekker «${covered}», ikke «${c.covers}»`)
  }
  if (!first.link.startsWith("https://fristil.netlify.app/"))
    fail(`lenken peker ikke på dokumentasjonen: ${first.link}`)
  if (c.fixed !== undefined || c.fixTitle || c.fixPreferred !== undefined) {
    if (!first.fix) fail("funnet har ingen rettelse")
    else {
      const applied =
        c.html.slice(0, first.fix.start) +
        first.fix.text +
        c.html.slice(first.fix.end)
      if (c.fixed !== undefined && applied !== c.fixed)
        fail(`rettelsen ga «${applied}», ikke «${c.fixed}»`)
      if (c.fixTitle && first.fix.title !== c.fixTitle)
        fail(`rettelsen heter «${first.fix.title}», ikke «${c.fixTitle}»`)
      const preferred = first.fix.preferred ?? false
      if (c.fixPreferred !== undefined && preferred !== c.fixPreferred)
        fail(
          `rettelsen er ${preferred ? "" : "ikke "}foretrukket, og skulle ${c.fixPreferred ? "" : "ikke "}vært det`,
        )
    }
  }
}

const elapsed = performance.now() - started
if (elapsed > 2000)
  findings.push(
    `alle tilfellene tok ${Math.round(elapsed)} ms, og skal ta under 2000`,
  )

if (findings.length) {
  console.error(
    `Diagnostikken feiler på ${findings.length} punkt:\n  ${findings.join("\n  ")}`,
  )
  process.exit(1)
}
console.log(
  `Diagnostikken består ${cases.length} tilfeller, ${Object.keys(all).length} elementer og ${Object.keys(classes).length} klasser.`,
)
